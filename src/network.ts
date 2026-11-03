import Peer, { type DataConnection } from "peerjs";
import { dictionary } from "./dictionary";
import {
  addPlayer,
  assertTurn,
  createGame,
  evaluate,
  exchange,
  materialize,
  pass,
  play,
  playerById,
  resign,
  restart,
  startGame,
  uid,
  validateSnapshot,
  type Game,
  type Placement,
} from "./engine";
import { readGame, saveGame, readSeat, saveSeat, identity } from "./storage";
export type Status =
  "connecting" | "connected" | "hosting" | "recovering" | "offline" | "error";
export type Member = {
  node: string;
  name: string;
  playerId: string | null;
  seen: number;
};
export type Event = {
  game: Game | null;
  status: Status;
  members: Member[];
  error: string;
  isHost: boolean;
  storageError: string;
};
export type Command = {
  type: string;
  id: string;
  actor: string;
  recovery: string;
  payload: Record<string, unknown>;
};
type Message = { type: string; [key: string]: unknown };
const PREFIX = "hearth-v1-";
const options = {
  debug: 0 as const,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" },
    ],
  },
};
export class TableNetwork {
  game: Game | null;
  status: Status = "connecting";
  members: Member[] = [];
  error = "";
  storageError = "";
  isHost = false;
  node = uid();
  private peer: Peer | null = null;
  private beacon: Peer | null = null;
  private upstream: DataConnection | null = null;
  private links = new Map<string, DataConnection>();
  private peers = new Map<string, Member>();
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private election: ReturnType<typeof setTimeout> | null = null;
  private dead = false;
  private lastHost = Date.now();
  private claiming = false;
  private hostReady = 0;
  private pending = new Map<
    string,
    {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private myPlayer: string | null = null;
  private myName = "Table display";
  private upstreamAttempt = 0;
  private replicatedVersion = -1;
  constructor(
    public code: string,
    private creating = false,
    private title = "Scrabble night",
    private rules: Game["dictionary"] = "enable",
  ) {
    this.game = readGame(code);
    const seat = readSeat(code);
    if (seat) {
      this.myPlayer = seat.playerId;
      this.myName =
        this.game?.players.find((p) => p.id === seat.playerId)?.name ||
        "Player";
    }
  }
  subscribe = (f: () => void) => {
    this.listeners.add(f);
    return () => {
      this.listeners.delete(f);
    };
  };
  private emit() {
    for (const f of this.listeners) f();
  }
  private store() {
    if (!this.game) return;
    try {
      saveGame(this.game);
      this.storageError = "";
    } catch {
      this.storageError =
        "Browser storage is full or unavailable. Export a backup before closing this device.";
    }
  }
  private setStatus(s: Status, error = "") {
    this.status = s;
    this.error = error;
    this.emit();
  }
  start() {
    if (this.dead) return;
    this.connectPeer();
    this.timer = setInterval(() => this.tick(), 2000);
  }
  private connectPeer() {
    if (this.dead) return;
    this.peer?.destroy();
    const p = new Peer(PREFIX + this.node, options);
    this.peer = p;
    p.on("open", () => {
      if (this.creating || this.game)
        this.scheduleElection(this.creating ? 0 : 2200);
      this.dial();
    });
    p.on("disconnected", () => {
      if (!this.dead && !p.destroyed) {
        try {
          p.reconnect();
        } catch {
          this.setStatus(
            "offline",
            "Signaling is unavailable. Existing connections can still play.",
          );
        }
      }
    });
    p.on("error", (e) => {
      if (this.dead) return;
      if (e.type === "peer-unavailable") {
        if (this.game || this.creating) this.scheduleElection(500);
        else
          this.setStatus(
            "error",
            "No active table found. Check the code, or ask someone with a saved copy to reopen the table.",
          );
      } else if (
        e.type === "network" ||
        e.type === "server-error" ||
        e.type === "socket-error"
      ) {
        if (!this.upstream?.open && !this.isHost)
          this.setStatus(
            "offline",
            "Cannot reach PeerJS. Check your connection and retry.",
          );
      } else if (e.type === "webrtc") {
        this.setStatus(
          "error",
          "This network blocked the direct connection. Try the same Wi-Fi or a different network.",
        );
      }
    });
  }
  private dial() {
    if (this.dead || this.isHost || !this.peer?.open || this.upstream?.open)
      return;
    if (this.upstream && Date.now() - this.upstreamAttempt < 12000) return;
    this.upstream?.close();
    this.upstreamAttempt = Date.now();
    const c = this.peer.connect(PREFIX + "room-" + this.code, {
      reliable: true,
      serialization: "json",
    });
    this.upstream = c;
    c.on("open", () => {
      if (this.dead) {
        c.close();
        return;
      }
      this.lastHost = Date.now();
      this.send(c, {
        type: "hello",
        node: this.node,
        playerId: this.myPlayer,
        name: this.myName,
        snapshot: this.game,
        code: this.code,
      });
    });
    c.on("data", (d) => this.receive(d as Message, c, false));
    c.on("close", () => {
      if (this.dead || this.upstream !== c) return;
      this.upstream = null;
      if (this.game) {
        this.setStatus("recovering");
        this.scheduleElection();
      } else
        this.setStatus(
          "error",
          "The table disconnected before a saved game arrived. Try joining again.",
        );
    });
    c.on("error", () => {
      if (this.game) this.scheduleElection();
    });
  }
  private scheduleElection(delay?: number) {
    if (this.dead || this.isHost || this.claiming || this.election) return;
    const nodes = [...this.members.map((m) => m.node), this.node]
      .filter((n, i, a) => a.indexOf(n) === i)
      .sort();
    const rank = Math.max(0, nodes.indexOf(this.node));
    this.election = setTimeout(
      () => {
        this.election = null;
        this.claim();
      },
      delay ?? 1200 + rank * 900 + Math.random() * 400,
    );
  }
  private claim() {
    if (
      this.dead ||
      this.isHost ||
      this.claiming ||
      (!this.game && !this.creating)
    )
      return;
    this.claiming = true;
    const b = new Peer(PREFIX + "room-" + this.code, options);
    this.beacon = b;
    b.on("open", () => {
      if (this.dead) {
        b.destroy();
        return;
      }
      this.claiming = false;
      this.upstream?.close();
      this.upstream = null;
      this.isHost = true;
      this.hostReady = Date.now() + 1200;
      if (!this.game)
        this.game = createGame(this.code, this.node, this.title, this.rules);
      this.game.leader = this.node;
      this.game.epoch++;
      this.store();
      this.setStatus("hosting");
      this.updateMembers();
      this.broadcast();
    });
    b.on("connection", (c) => {
      c.on("data", (d) => this.receive(d as Message, c, true));
      c.on("close", () => {
        for (const [node, conn] of this.links)
          if (conn === c) {
            this.links.delete(node);
            const m = this.peers.get(node);
            if (m) m.seen = 0;
          }
        this.updateMembers();
      });
      c.on("error", () => {});
    });
    b.on("error", (e) => {
      if (this.dead) return;
      this.claiming = false;
      b.destroy();
      if (this.beacon === b) this.beacon = null;
      if (e.type === "unavailable-id") {
        this.dial();
      } else {
        this.setStatus(
          "offline",
          "PeerJS is unavailable. Your saved game is safe on this device.",
        );
      }
    });
    b.on("disconnected", () => {
      if (this.dead) return;
      try {
        b.reconnect();
      } catch {
        this.loseLeadership();
      }
    });
    b.on("close", () => {
      if (!this.dead && this.beacon === b && this.isHost) this.loseLeadership();
    });
  }
  private loseLeadership() {
    this.isHost = false;
    this.links.forEach((c) => c.close());
    this.links.clear();
    this.setStatus("recovering");
    this.dial();
    this.scheduleElection(1500);
  }
  private send(c: DataConnection | null, m: unknown) {
    try {
      if (c?.open) c.send(m);
    } catch {}
  }
  private updateMembers() {
    const me: Member = {
      node: this.node,
      playerId: this.myPlayer,
      name: this.myName,
      seen: Date.now(),
    };
    this.members = [
      me,
      ...[...this.peers.values()].filter((m) => Date.now() - m.seen < 10000),
    ];
    this.emit();
  }
  private broadcast() {
    if (!this.isHost || !this.game) return;
    this.updateMembers();
    const m = { type: "snapshot", game: this.game, members: this.members };
    for (const c of this.links.values()) this.send(c, m);
  }
  private receive(m: Message, c: DataConnection, host: boolean) {
    if (this.dead || !m || typeof m !== "object") return;
    if (host) {
      if (m.type === "hello") {
        if (typeof m.node !== "string" || m.code !== this.code) return;
        const node = m.node;
        this.links.get(node)?.close();
        this.links.set(node, c);
        this.peers.set(node, {
          node,
          name: String(m.name || "Table display").slice(0, 20),
          playerId: typeof m.playerId === "string" ? m.playerId : null,
          seen: Date.now(),
        });
        const offered = m.snapshot;
        if (
          validateSnapshot(offered) &&
          this.game &&
          offered.id === this.game.id &&
          offered.version > this.game.version
        ) {
          const epoch = this.game.epoch;
          this.game = structuredClone(offered);
          this.game.leader = this.node;
          this.game.epoch = Math.max(epoch, offered.epoch) + 1;
          this.store();
        }
        this.broadcast();
      } else if (m.type === "ping") {
        for (const [node, conn] of this.links)
          if (conn === c) {
            const member = this.peers.get(node);
            if (member) {
              member.seen = Date.now();
              member.playerId =
                typeof m.playerId === "string" ? m.playerId : null;
              member.name = String(m.name || "Table display").slice(0, 20);
            }
          }
        this.send(c, { type: "pong", members: this.members });
      } else if (m.type === "ack") {
        if (
          [...this.links.values()].includes(c) &&
          m.gameId === this.game?.id &&
          Number.isSafeInteger(m.version) &&
          Number(m.version) <= this.game!.version
        ) {
          this.replicatedVersion = Math.max(
            this.replicatedVersion,
            Number(m.version),
          );
        }
      } else if (m.type === "command") {
        if (![...this.links.values()].includes(c)) return;
        const cmd = m.command as Command;
        try {
          const result = this.apply(cmd);
          this.send(c, { type: "result", id: cmd.id, result });
        } catch (e) {
          this.send(c, {
            type: "result",
            id: cmd?.id,
            error:
              e instanceof Error
                ? e.message
                : "Unable to complete this action.",
          });
        }
      }
    } else {
      if (m.type === "snapshot" && validateSnapshot(m.game)) {
        const next = m.game;
        if (next.code !== this.code) return;
        if (this.game && this.game.id !== next.id) {
          this.setStatus(
            "error",
            "This room code belongs to a different game. Export your saved copy before joining a new table.",
          );
          c.close();
          return;
        }
        if (!this.game || next.version >= this.game.version) {
          this.game = next;
          this.store();
        }
        this.members = Array.isArray(m.members) ? (m.members as Member[]) : [];
        this.lastHost = Date.now();
        if (!this.storageError)
          this.send(c, {
            type: "ack",
            gameId: this.game!.id,
            version: this.game!.version,
          });
        this.setStatus("connected");
      } else if (m.type === "pong") {
        this.lastHost = Date.now();
        if (Array.isArray(m.members)) this.members = m.members as Member[];
        this.emit();
      } else if (m.type === "result") {
        const pending = this.pending.get(String(m.id));
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(String(m.id));
          if (m.error) pending.reject(Error(String(m.error)));
          else pending.resolve(m.result);
        }
      }
    }
  }
  private apply(cmd: Command): unknown {
    if (!this.game) throw Error("The table is still opening.");
    if (Date.now() < this.hostReady)
      throw Error("Restoring the table. Try again in a moment.");
    if (!cmd || typeof cmd.id !== "string" || typeof cmd.type !== "string")
      throw Error("Invalid request.");
    if (this.game.receipts.includes(cmd.id)) return { ok: true };
    const g = structuredClone(this.game);
    const data = cmd.payload || {};
    let result: unknown = { ok: true };
    if (cmd.type === "join") {
      const name = String(data.name || "");
      addPlayer(g, cmd.actor, name, cmd.recovery);
      result = { playerId: cmd.actor, recovery: cmd.recovery };
    } else if (cmd.type === "recover") {
      const p = g.players.find(
        (p) =>
          p.recovery ===
          String(data.key || "")
            .trim()
            .toUpperCase(),
      );
      if (!p)
        throw Error("That recovery key does not match a seat at this table.");
      result = { playerId: p.id, recovery: p.recovery };
    } else {
      const p = g.players.find(
        (p) => p.id === cmd.actor && p.recovery === cmd.recovery,
      );
      const seated = !!p;
      const isLocalDisplay = cmd.actor === identity() && this.isHost; // Display-only host may start and skip absent turns.
      if (cmd.type === "start") {
        if (!seated && !isLocalDisplay)
          throw Error("A player needs to start the game.");
        startGame(g);
      } else if (cmd.type === "skip") {
        if (!seated && !isLocalDisplay)
          throw Error("Join as a player to skip an absent turn.");
        const current = g.players[g.turn];
        if (!current) throw Error("No turn to skip.");
        const online = this.members.some(
          (m) => m.playerId === current.id && Date.now() - m.seen < 10000,
        );
        if (online || Date.now() - g.turnStarted < 60000)
          throw Error(
            "You can skip a disconnected player after their turn has been waiting for one minute.",
          );
        pass(g, current.id, true);
      } else {
        if (!seated)
          throw Error(
            "Your seat credentials are missing. Recover your seat to continue.",
          );
        if (cmd.type === "draft") {
          const draft = data.placements as Placement[];
          materialize(g, p.id, draft);
          g.draft = draft;
        } else if (cmd.type === "play")
          play(g, p.id, data.placements as Placement[], (w) =>
            dictionary.has(w),
          );
        else if (cmd.type === "pass") pass(g, p.id);
        else if (cmd.type === "exchange")
          exchange(g, p.id, data.ids as string[]);
        else if (cmd.type === "resign") resign(g, p.id);
        else if (cmd.type === "rematch") {
          this.game = restart(g);
          this.game.version++;
          this.game.updated = Date.now();
          this.game.receipts.push(cmd.id);
          this.store();
          this.broadcast();
          return result;
        } else if (cmd.type === "leave-lobby") {
          if (g.phase !== "lobby")
            throw Error("Use resign to leave a running game.");
          g.players = g.players.filter((x) => x.id !== p.id);
        } else throw Error("Unknown action.");
      }
    }
    g.version++;
    g.updated = Date.now();
    g.receipts = [...g.receipts, cmd.id].slice(-100);
    this.game = g;
    this.store();
    this.broadcast();
    return result;
  }
  async command(
    type: string,
    payload: Record<string, unknown> = {},
  ): Promise<unknown> {
    const seat = readSeat(this.code);
    const cmd: Command = {
      type,
      payload,
      id: uid(),
      actor: seat?.playerId || identity(),
      recovery: seat?.recovery || "",
    };
    if (type === "join") {
      cmd.actor = identity();
      cmd.recovery = randomKey();
    }
    const localHost = this.isHost;
    let result: unknown;
    if (this.isHost) result = this.apply(cmd);
    else {
      if (!this.upstream?.open)
        throw Error(
          "Reconnecting the table. Your move has not been submitted.",
        );
      result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(cmd.id);
          reject(
            Error(
              "The table did not confirm the action. Reconnect and check the board before trying again.",
            ),
          );
        }, 12000);
        this.pending.set(cmd.id, { resolve, reject, timer });
        this.send(this.upstream, { type: "command", command: cmd });
      });
    }
    if (type === "join" || type === "recover") {
      const data = result as { playerId: string; recovery: string };
      if (data?.playerId) {
        saveSeat(this.code, data.playerId, data.recovery);
        this.myPlayer = data.playerId;
        this.myName =
          this.game?.players.find((p) => p.id === data.playerId)?.name ||
          "Player";
        this.emit();
      }
    }
    if (localHost && this.links.size && this.game) {
      const version = this.game.version;
      const deadline = Date.now() + 4000;
      await new Promise<void>((resolve, reject) => {
        const check = () => {
          if (this.replicatedVersion >= version) resolve();
          else if (this.dead || Date.now() >= deadline)
            reject(
              Error(
                "This change is saved here, but another device has not confirmed its recovery copy. Keep this browser open or export a backup.",
              ),
            );
          else setTimeout(check, 60);
        };
        check();
      });
    }
    return result;
  }
  private tick() {
    if (this.dead) return;
    if (this.isHost) {
      this.updateMembers();
      for (const c of this.links.values())
        this.send(c, { type: "pong", members: this.members });
    } else {
      if (this.upstream?.open) {
        this.send(this.upstream, {
          type: "ping",
          playerId: this.myPlayer,
          name: this.myName,
        });
        if (Date.now() - this.lastHost > 12000) {
          this.upstream.close();
          this.upstream = null;
          this.setStatus("recovering");
          this.scheduleElection();
        }
      } else {
        this.dial();
        if (this.game || this.creating) this.scheduleElection();
      }
    }
  }
  retry() {
    if (this.dead) return;
    this.error = "";
    if (!this.peer?.open) this.connectPeer();
    else {
      this.dial();
      if (this.game || this.creating) this.scheduleElection(1000);
    }
  }
  close() {
    this.dead = true;
    if (this.timer) clearInterval(this.timer);
    if (this.election) clearTimeout(this.election);
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(Error("Table closed."));
    }
    this.pending.clear();
    this.links.forEach((c) => c.close());
    this.upstream?.close();
    this.beacon?.destroy();
    this.peer?.destroy();
    this.listeners.clear();
  }
}
export function randomKey() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return [...bytes].map((b) => chars[b % chars.length]).join("");
}
export function roomCode() {
  return randomKey().slice(0, 6);
}
