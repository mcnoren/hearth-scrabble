import Peer, { type DataConnection } from "peerjs";
import { TableNetwork, roomCode } from "../src/network";
import { identity, forgetGame, readGame } from "../src/storage";
import { uid, type Game } from "../src/engine";
const log = document.getElementById("log")!;
function note(s: string) {
  log.textContent += s + "\n";
}
function assert(ok: unknown, s: string) {
  if (!ok) throw Error(s);
  note("PASS · " + s);
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function wait(f: () => boolean, label: string, ms = 35000) {
  const start = Date.now();
  while (!f()) {
    if (Date.now() - start > ms) throw Error("Timeout: " + label);
    await delay(150);
  }
  note("Ready · " + label);
}
const code = roomCode();
const instances: TableNetwork[] = [];
let raw: Peer | null = null;
let conn: DataConnection | null = null;
let snapshot: Game | null = null;
const replies = new Map<string, (x: any) => void>();
async function rawCommand(
  type: string,
  actor: string,
  recovery: string,
  payload: Record<string, unknown> = {},
  id = uid(),
) {
  const command = { type, id, actor, recovery, payload };
  return new Promise<any>((resolve, reject) => {
    const t = setTimeout(() => reject(Error("Command timeout " + type)), 10000);
    replies.set(id, (m) => {
      clearTimeout(t);
      if (m.error) reject(Error(m.error));
      else resolve(m.result);
    });
    conn!.send({ type: "command", command });
  });
}
function make() {
  const net = new TableNetwork(code);
  instances.push(net);
  net.start();
  return net;
}
try {
  // A guest may arrive before the host is online. Retry must retire the failed
  // attempt immediately instead of keeping a dead DataConnection installed.
  const lateCode = roomCode();
  const earlyGuest = new TableNetwork(lateCode);
  instances.push(earlyGuest);
  earlyGuest.start();
  await wait(
    () => earlyGuest.status === "error",
    "guest reports a missing host",
  );
  const lateHost = new TableNetwork(lateCode, true, "Late host check");
  instances.push(lateHost);
  lateHost.start();
  await wait(
    () => lateHost.isHost,
    "host opened after the first lookup failed",
  );
  earlyGuest.retry();
  await wait(
    () => earlyGuest.status === "connected",
    "explicit Retry joins the newly available host",
    10000,
  );
  assert(
    earlyGuest.game?.id === lateHost.game?.id,
    "retry receives the real host's saved game",
  );
  // An isolated failed WebRTC negotiation must not unregister an active host.
  const rendezvous = (lateHost as unknown as { beacon: Peer }).beacon;
  rendezvous.emit(
    "error",
    Object.assign(new Error("Simulated device negotiation failure"), {
      type: "webrtc",
    }),
  );
  assert(
    lateHost.isHost && !rendezvous.destroyed,
    "one failed device cannot destroy the table host",
  );
  earlyGuest.close();
  lateHost.close();
  forgetGame(lateCode);
  note("Room " + code + " — using the real public PeerJS signaling service.");
  const host = new TableNetwork(code, true, "Integration check", "friendly");
  instances.push(host);
  host.start();
  await wait(() => host.isHost, "original host registered");
  await delay(1500);
  raw = new Peer("hearth-qa-" + uid());
  await new Promise<void>((resolve, reject) => {
    raw!.on("open", () => resolve());
    raw!.on("error", reject);
  });
  conn = raw.connect("hearth-v1-room-" + code, {
    reliable: true,
    serialization: "json",
  });
  conn.on("data", (m: any) => {
    if (m.type === "snapshot") snapshot = m.game;
    if (m.type === "result") replies.get(m.id)?.(m);
  });
  await new Promise<void>((r, j) => {
    conn!.on("open", () => r());
    conn!.on("error", j);
  });
  conn.send({
    type: "hello",
    node: uid(),
    name: "Alice",
    playerId: "alice",
    code,
  });
  await wait(() => !!snapshot, "direct WebRTC data channel");
  await rawCommand("join", "alice", "ALICEKEY23456", { name: "Alice" });
  const backup = make();
  await wait(
    () => backup.status === "connected",
    "first recovery device connected",
  );
  await backup.command("join", { name: "Bob" });
  const backup2 = make();
  await wait(
    () => backup2.status === "connected",
    "second recovery device connected",
  );
  assert(
    backup.game?.players.length === 2,
    "two independent seats join and replicate",
  );
  await rawCommand("start", "alice", "ALICEKEY23456");
  await wait(
    () => backup2.game?.phase === "playing",
    "start/deal propagated to every device",
  );
  assert(
    backup2.game!.bag.length === 86,
    "seven-tile racks and correct bag count",
  );
  const active = backup2.game!.players[backup2.game!.turn];
  const actor = active.id;
  const key = active.recovery;
  const p = [
    {
      index: 112,
      tileId: active.rack[0].id,
      ...(active.rack[0].letter === "?" ? { letter: "A" } : {}),
    },
  ];
  await rawCommand("draft", actor, key, { placements: p });
  await wait(
    () => backup2.game!.draft.length === 1,
    "unfinished move replicated",
  );
  const original = structuredClone(host.game!);
  const previousVersion = backup2.game!.version;
  host.close();
  note("Original host CLOSED. Waiting for automatic takeover.");
  await wait(
    () => backup.isHost || backup2.isHost,
    "a recovery device became host",
    45000,
  );
  const successor = backup.isHost ? backup : backup2;
  const follower = backup.isHost ? backup2 : backup;
  await wait(
    () => follower.status === "connected",
    "remaining device reconnected to successor",
    45000,
  );
  await delay(1500);
  assert(
    successor.game!.version === previousVersion,
    "host departure preserved exact committed version",
  );
  assert(
    successor.game!.draft.length === 1,
    "host departure preserved unfinished placement",
  );
  assert(
    JSON.stringify(successor.game!.players) ===
      JSON.stringify(original.players),
    "host departure preserved every rack and score",
  );
  await successor.command("recover", { key });
  await successor.command("pass");
  await wait(
    () => follower.game!.history.length === 1,
    "play continues after original host exits",
  );
  assert(successor.game!.draft.length === 0, "passing recalls draft");
  const recovered = await follower.command("recover", { key: "ALICEKEY23456" });
  assert(
    (recovered as any).playerId === "alice",
    "seat recovery restores original identity",
  );
  const stale = new TableNetwork(code);
  stale.game = original;
  instances.push(stale);
  stale.start();
  await wait(
    () =>
      stale.status === "connected" &&
      stale.game!.version === successor.game!.version,
    "stale original host rejoins and receives current state",
  );
  assert(
    stale.game!.history.length === 1,
    "stale copy cannot roll back accepted moves",
  );
  const latestVersion = successor.game!.version;
  instances.forEach((n) => n.close());
  raw.destroy();
  raw = null;
  note("EVERY DEVICE CLOSED. Reopening browser save.");
  await delay(3000);
  const reopened = make();
  await wait(
    () => reopened.isHost,
    "saved table reopens with nobody else online",
    45000,
  );
  assert(
    reopened.game!.version === latestVersion,
    "all-closed reopen preserves latest version",
  );
  assert(
    reopened.game!.history.length === 1,
    "all-closed reopen preserves move history",
  );
  assert(
    readGame(code)?.version === latestVersion,
    "complete snapshot is in browser localStorage",
  );
  note("\nALL LIVE NETWORK CHECKS PASSED.");
} catch (e) {
  note("\nFAIL · " + (e instanceof Error ? e.stack : String(e)));
} finally {
  instances.forEach((n) => n.close());
  raw?.destroy();
  forgetGame(code);
}
