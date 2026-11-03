import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  Expand,
  HelpCircle,
  Home,
  Laptop,
  Link,
  LoaderCircle,
  Maximize2,
  Monitor,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Share2,
  ShieldCheck,
  Shuffle,
  Smartphone,
  Upload,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import {
  PREMIUM,
  VALUES,
  evaluate,
  materialize,
  uid,
  validateSnapshot,
  type Game,
  type Placement,
  type Tile,
} from "./engine";
import { dictionary } from "./dictionary";
import { TableNetwork, roomCode, type Status } from "./network";
import {
  exportGame,
  forgetGame,
  identity,
  readSeat,
  saveGame,
  savedRooms,
  type SavedRoom,
} from "./storage";
const COLORS = ["#bd674c", "#4d7e91", "#998149", "#7e6999"];
const coordinate = (i: number) =>
  `${String.fromCharCode(65 + Math.floor(i / 15))}${(i % 15) + 1}`;
const statusText: Record<Status, string> = {
  connecting: "Connecting to table",
  connected: "Connected",
  hosting: "Hosting on this device",
  recovering: "Finding the next host",
  offline: "Connection interrupted",
  error: "Unable to connect",
};
function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="icon-button"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button className="logo" onClick={onClick} aria-label="Hearth home">
      <span className="logo-tile">
        H<sub>4</sub>
      </span>
      <span>
        hearth<span className="logo-dot">.</span>
        <small>SCRABBLE NIGHT</small>
      </span>
    </button>
  );
}
function TileView({
  tile,
  selected,
  onClick,
  small = false,
  blank = false,
  disabled = false,
}: {
  tile: Tile;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  blank?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={`tile ${small ? "small" : ""} ${selected ? "selected" : ""} ${blank ? "blank" : ""}`}
      onClick={onClick}
      disabled={disabled}
      draggable={!disabled && !!onClick}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", tile.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      aria-label={`${tile.letter === "?" ? "Blank" : tile.letter}, ${tile.value} points${selected ? ", selected" : ""}`}
      aria-pressed={selected}
    >
      <span>{tile.letter === "?" ? "" : tile.letter}</span>
      <sub>{blank ? "★" : tile.value}</sub>
    </button>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-title">
        <h2>{title}</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
function Rules() {
  return (
    <div className="rules">
      <p>Make yourself at home. Here’s how the table works.</p>
      <h3>The classic game</h3>
      <p>
        2–4 players, 100 tiles, seven on each rack. Place a word across the
        center star to begin. Every later word must connect to the board. New
        tiles go in a single row or column, with no gaps.
      </p>
      <p>
        All words formed count, including crosswords. Letter and word premiums
        apply only to newly placed tiles. Blanks always score zero. Playing
        seven tiles earns a 50-point bonus.
      </p>
      <h3>Your turn</h3>
      <p>
        Tap a rack tile, then an empty square. Tap a placed tile to return it.
        You can also drag tiles, or select a board square and type. Use the
        direction button to switch across/down. Recall takes back your draft;
        Play word commits it.
      </p>
      <p>
        You can pass, or exchange any tiles when at least seven remain in the
        bag. Six consecutive turns without scoring end the game. When the bag is
        empty and someone plays their last tile, remaining rack values are
        deducted and added to the player who went out.
      </p>
      <h3>Words at this table</h3>
      <p>
        Standard tables use the public-domain ENABLE word list, with automatic
        validation of every word. It differs from current tournament
        dictionaries. Friendly tables accept any connected word so your group
        can agree on house words. Choose before creating a table.
      </p>
      <h3>Saved here, shared around the table</h3>
      <p>
        The host browser stores the complete game in local storage. Connected
        devices keep recovery copies and can take over when the host leaves. A
        player who disconnects keeps their seat and rack. After one minute,
        another player can skip an absent player’s turn.
      </p>
      <p>
        If everybody closes the app, reopen a saved table on any device that has
        a copy. Keep browser data to keep saved games. Export a backup for extra
        safekeeping. A recovery key restores a seat on another device once the
        table is online.
      </p>
      <p>
        This is a personal game among friends: racks are hidden in the
        interface, but complete recovery copies include all game data. PeerJS
        provides connection signaling; gameplay travels directly between
        browsers. Some restricted networks block direct connections—try the same
        Wi-Fi or another network.
      </p>
      <small>
        Personal, unofficial project. SCRABBLE is a trademark of its respective
        owners. No affiliation or endorsement. Board and tile artwork created
        for this app.
      </small>
    </div>
  );
}
function DemoBoard() {
  const letters = "SCRABBLE";
  return (
    <div className="demo-scene" aria-hidden="true">
      <div className="demo-caption">
        <span className="tiny-star">✳</span> THE ORIGINAL WORD NIGHT
      </div>
      <div className="demo-board">
        {Array.from({ length: 225 }, (_, i) => {
          const r = Math.floor(i / 15),
            c = i % 15;
          let l = "";
          if (r === 7 && c >= 4 && c < 12) l = letters[c - 4];
          if (c === 8 && r >= 4 && r < 7) l = "TEA"[r - 4];
          if (c === 5 && r >= 8 && r < 11) l = "OSE"[r - 8];
          return (
            <div
              key={i}
              className={`demo-cell ${PREMIUM[i] || ""} ${l ? "has-letter" : ""}`}
            >
              {l ? (
                <>
                  <span>{l}</span>
                  <sub>{VALUES[l]}</sub>
                </>
              ) : (
                <small>{i === 112 ? "★" : PREMIUM[i]}</small>
              )}
            </div>
          );
        })}
        <span className="board-brand">
          SCRABBLE<span>© PERSONAL EDITION</span>
        </span>
      </div>
      <div className="demo-rack">
        {"TONIGHT".split("").map((l, i) => (
          <span
            key={i}
            className="demo-tile"
            style={{ transform: `rotate(${[-5, 2, -3, 4, -2, 3, -4][i]}deg)` }}
          >
            {l}
            <sub>{VALUES[l]}</sub>
          </span>
        ))}
      </div>
      <div className="hand-note">
        Good company.
        <br />
        Great words.
        <svg width="64" height="36" viewBox="0 0 64 36">
          <path
            d="M2 2C10 25 38 25 57 22M46 14l12 8-9 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    </div>
  );
}
export default function App() {
  const [net, setNet] = useState<TableNetwork | null>(null);
  const [, render] = useState(0);
  const [rooms, setRooms] = useState<SavedRoom[]>([]);
  const [roomInput, setRoomInput] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("Scrabble night");
  const [friendly, setFriendly] = useState(false);
  const [modal, setModal] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [direction, setDirection] = useState<"across" | "down">("across");
  const [view, setView] = useState<"rack" | "table">("rack");
  const [rackOrder, setRackOrder] = useState<string[]>([]);
  const [swapIds, setSwapIds] = useState<string[]>([]);
  const [recoverKey, setRecoverKey] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState("");
  const [sound, setSound] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [boardSize, setBoardSize] = useState(0);
  const boardStage = useRef<HTMLDivElement>(null);
  const [blankTarget, setBlankTarget] = useState<{
    tileId: string;
    index: number;
  } | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const cursorRef = useRef<number | null>(null);
  const keyQueue = useRef<string[]>([]);
  const processingKeys = useRef(false);
  const importing = useRef<HTMLInputElement>(null);
  const networkRef = useRef<TableNetwork | null>(null);
  const soundRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    try {
      identity();
      setRooms(savedRooms());
    } catch {
      setStorageAvailable(false);
    }
    const hash = new URLSearchParams(location.hash.slice(1));
    const code = hash.get("room");
    if (code && /^[A-Z2-9]{6}$/.test(code.toUpperCase()))
      openTable(
        code.toUpperCase(),
        false,
        hash.get("view") === "table" ? "table" : "rack",
      );
    const interval = setInterval(() => setNow(Date.now()), 3000);
    return () => {
      clearInterval(interval);
      networkRef.current?.close();
    };
  }, []);
  useEffect(() => {
    if (!net) return;
    return net.subscribe(() => render((x) => x + 1));
  }, [net]);
  useEffect(() => {
    document.documentElement.classList.toggle("at-table", !!net);
    return () => document.documentElement.classList.remove("at-table");
  }, [net]);
  const g = net?.game || null;
  const seat = g ? readSeat(g.code) : null;
  const me = g?.players.find((p) => p.id === seat?.playerId);
  const active = g?.players[g.turn];
  const myTurn = !!(
    g?.phase === "playing" &&
    me &&
    active?.id === me.id &&
    !me.resigned
  );
  const draft = g?.draft || [];
  const available = (me?.rack || []).filter(
    (t) => !draft.some((p) => p.tileId === t.id),
  );
  const sorted = [...available].sort((a, b) => {
    const ai = rackOrder.indexOf(a.id),
      bi = rackOrder.indexOf(b.id);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  let preview: { score: number; words: string[]; bingo: boolean } | null = null;
  let validation = "";
  if (g && draft.length) {
    try {
      preview = evaluate(g, active!.id, draft, (w) => dictionary.has(w));
    } catch (e) {
      validation = (e as Error).message;
    }
  }
  useEffect(() => {
    setSelected(null);
    setSwapIds([]);
    setCursor(null);
  }, [g?.turn, g?.history.length, g?.phase]);
  useEffect(() => {
    if (modal !== "share" || !g) return;
    QRCode.toDataURL(inviteLink(g.code), {
      width: 240,
      margin: 2,
      color: { dark: "#163c33", light: "#fffcf6" },
    })
      .then(setQr)
      .catch(() => setQr(""));
  }, [modal, g?.code]);
  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);
  useEffect(() => {
    async function pumpKeys() {
      if (processingKeys.current) return;
      processingKeys.current = true;
      setBusy(true);
      setError("");
      try {
        while (keyQueue.current.length) {
          const key = keyQueue.current.shift()!;
          const current = networkRef.current;
          const game = current?.game;
          const saved = game ? readSeat(game.code) : null;
          if (
            !current ||
            !game ||
            game.phase !== "playing" ||
            game.players[game.turn].id !== saved?.playerId
          ) {
            keyQueue.current = [];
            break;
          }
          const player = game.players[game.turn];
          let index = cursorRef.current;
          if (key.startsWith("Arrow")) {
            const delta =
              key === "ArrowRight"
                ? 1
                : key === "ArrowLeft"
                  ? -1
                  : key === "ArrowDown"
                    ? 15
                    : -15;
            const n = (index ?? 112) + delta;
            if (n >= 0 && n < 225) {
              cursorRef.current = n;
              setCursor(n);
            }
            continue;
          }
          if (key === "Enter") {
            if (game.draft.length) {
              await current.command("play", { placements: game.draft });
              chime();
              cursorRef.current = null;
              setCursor(null);
            }
            continue;
          }
          if (index === null) continue;
          if (key === "Backspace") {
            if (game.draft.some((p) => p.index === index))
              await current.command("draft", {
                placements: game.draft.filter((p) => p.index !== index),
              });
            continue;
          }
          const used = new Set(game.draft.map((p) => p.tileId));
          const available = player.rack.filter((t) => !used.has(t.id));
          const tile =
            available.find((t) => t.letter === key.toUpperCase()) ||
            available.find((t) => t.letter === "?");
          if (!tile) continue;
          while (
            index < 225 &&
            (game.board[index] || game.draft.some((p) => p.index === index))
          )
            index += direction === "across" ? 1 : 15;
          if (index >= 225) continue;
          await current.command("draft", {
            placements: [
              ...game.draft,
              {
                index,
                tileId: tile.id,
                ...(tile.letter === "?" ? { letter: key.toUpperCase() } : {}),
              },
            ],
          });
          chime();
          const n = index + (direction === "across" ? 1 : 15);
          cursorRef.current = n < 225 ? n : null;
          setCursor(cursorRef.current);
          setSelected(null);
        }
      } catch (e) {
        setError((e as Error).message);
        keyQueue.current = [];
      } finally {
        processingKeys.current = false;
        setBusy(false);
      }
    }
    function key(e: KeyboardEvent) {
      if (
        !g ||
        !myTurn ||
        (busy && !processingKeys.current) ||
        modal ||
        blankTarget ||
        (e.target as HTMLElement)?.closest("input,textarea,select,dialog")
      )
        return;
      if (e.key === "Escape") {
        setSelected(null);
        return;
      }
      if (
        [
          "ArrowRight",
          "ArrowDown",
          "ArrowLeft",
          "ArrowUp",
          "Backspace",
          "Enter",
        ].includes(e.key) ||
        (/^[a-z]$/i.test(e.key) && cursorRef.current !== null)
      ) {
        e.preventDefault();
        keyQueue.current.push(e.key);
        void pumpKeys();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [g, myTurn, busy, modal, blankTarget, direction]);
  useEffect(() => {
    const stage = boardStage.current;
    if (!stage) return;
    const fit = () => {
      const { width, height } = stage.getBoundingClientRect();
      const size = Math.max(0, Math.floor(Math.min(width, height)) - 2);
      setBoardSize((previous) => (previous === size ? previous : size));
    };
    fit();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", fit);
      return () => window.removeEventListener("resize", fit);
    }
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [net, g?.phase, view, !!me, zoom]);
  useEffect(() => {
    if (g?.phase === "finished") setModal("results");
  }, [g?.phase]);
  function openTable(
    code: string,
    creating = false,
    nextView: "rack" | "table" = "rack",
  ) {
    if (networkRef.current) networkRef.current.close();
    setError("");
    setNotice("");
    setModal("");
    setSelected(null);
    const n = new TableNetwork(
      code,
      creating,
      title,
      friendly ? "friendly" : "enable",
    );
    networkRef.current = n;
    setNet(n);
    setView(nextView);
    location.hash = new URLSearchParams({
      room: code,
      view: nextView,
    }).toString();
    n.start();
  }
  function goHome() {
    networkRef.current?.close();
    networkRef.current = null;
    setNet(null);
    setError("");
    setModal("");
    location.hash = "";
    try {
      setRooms(savedRooms());
    } catch {}
  }
  function inviteLink(code: string) {
    const url = new URL(location.href);
    url.hash = new URLSearchParams({ room: code }).toString();
    return url.toString();
  }
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      setNotice(
        "Copy is unavailable in this browser. Select and copy the displayed text.",
      );
    }
  }
  function chime() {
    if (!sound) return;
    try {
      const ctx = soundRef.current ?? new AudioContext();
      soundRef.current = ctx;
      void ctx.resume();
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }
  async function doCommand(
    type: string,
    payload: Record<string, unknown> = {},
  ) {
    if (!net || busy) return false;
    setBusy(true);
    setError("");
    try {
      await net.command(type, payload);
      if (type === "play") {
        chime();
        setSelected(null);
        setCursor(null);
      }
      if (
        [
          "join",
          "recover",
          "exchange",
          "pass",
          "resign",
          "rematch",
          "leave-lobby",
        ].includes(type)
      )
        setModal("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function place(tileId: string, index: number, letter?: string) {
    if (!g || !myTurn || busy) return;
    const tile = me?.rack.find((t) => t.id === tileId);
    if (!tile) return;
    if (g.board[index]) {
      setCursor(index);
      return;
    }
    if (tile.letter === "?" && !letter) {
      setBlankTarget({ tileId, index });
      return;
    }
    const placements = [
      ...draft.filter((q) => q.tileId !== tileId && q.index !== index),
      { tileId, index, ...(letter ? { letter } : {}) },
    ];
    const ok = await doCommand("draft", { placements });
    if (ok) {
      setSelected(null);
      chime();
      let n = index + (direction === "across" ? 1 : 15);
      while (n < 225 && g.board[n]) n += direction === "across" ? 1 : 15;
      setCursor(n < 225 ? n : null);
    }
  }
  async function importFile(file: File) {
    try {
      if (file.size > 2_000_000)
        throw Error("Choose a Hearth game backup smaller than 2 MB.");
      const data = JSON.parse(await file.text());
      if (!validateSnapshot(data))
        throw Error("This file is not a Hearth game backup.");
      saveGame(data);
      setRooms(savedRooms());
      setNotice(`Restored ${data.title}. Open its saved table below.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const header = (
    <header
      className={`header ${net ? "game-header" : ""} ${net && zoom ? "focus-hidden" : ""}`}
    >
      <Logo onClick={net ? () => setModal("leave") : goHome} />
      <div className="header-right">
        {net ? (
          <>
            <span
              className={`connection ${net.status === "hosting" || net.status === "connected" ? "online" : ""}`}
            >
              <span />
              {statusText[net.status]}
            </span>
            <IconButton label="How to play" onClick={() => setModal("rules")}>
              <HelpCircle size={20} />
            </IconButton>
            <IconButton
              label="Table settings"
              onClick={() => setModal("settings")}
            >
              <MoreHorizontal size={22} />
            </IconButton>
          </>
        ) : (
          <>
            <span className="header-note">A little friendly competition.</span>
            <button className="text-button" onClick={() => setModal("rules")}>
              How to play <ArrowRight size={15} />
            </button>
          </>
        )}
      </div>
    </header>
  );
  return (
    <>
      {header}
      {!net ? (
        <main className="landing">
          <section className="landing-copy">
            <div className="eyebrow">
              <span /> THE TABLE IS ALWAYS OPEN
            </div>
            <h1>
              Big words.
              <br />
              Small screens.
              <br />
              <em>Good company.</em>
            </h1>
            <p className="intro">
              Your favorite word game, gathered around one board. Bring your
              friends. Your phone is your tile rack.
            </p>
            <div className="entry-card">
              <div className="entry-tabs">
                <button
                  className={modal !== "join-home" ? "active" : ""}
                  onClick={() => setModal("")}
                >
                  Start a table
                </button>
                <button
                  className={modal === "join-home" ? "active" : ""}
                  onClick={() => setModal("join-home")}
                >
                  Join friends
                </button>
              </div>
              {modal === "join-home" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (/^[A-Z2-9]{6}$/.test(roomInput.toUpperCase()))
                      openTable(roomInput.toUpperCase());
                    else setError("Enter the six-character table code.");
                  }}
                >
                  <label htmlFor="room-code">TABLE CODE</label>
                  <div className="input-action">
                    <input
                      id="room-code"
                      autoComplete="off"
                      placeholder="e.g. GARDEN"
                      maxLength={6}
                      value={roomInput}
                      onChange={(e) =>
                        setRoomInput(
                          e.target.value
                            .replace(/[^a-z2-9]/gi, "")
                            .toUpperCase(),
                        )
                      }
                    />
                    <button className="primary" type="submit">
                      Join table <ArrowRight size={17} />
                    </button>
                  </div>
                  <p className="form-note">
                    Get a code or scan the QR on your friend’s board.
                  </p>
                </form>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (storageAvailable) openTable(roomCode(), true, "table");
                  }}
                >
                  <label htmlFor="table-name">
                    GIVE YOUR GAME NIGHT A NAME
                  </label>
                  <input
                    id="table-name"
                    value={title}
                    maxLength={40}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Scrabble night"
                  />
                  <div className="create-row">
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={friendly}
                        onChange={(e) => setFriendly(e.target.checked)}
                      />
                      <span>
                        House words<small>Skip dictionary checks</small>
                      </span>
                    </label>
                    <button
                      className="primary"
                      type="submit"
                      disabled={!storageAvailable}
                    >
                      Create a table <ArrowRight size={17} />
                    </button>
                  </div>
                </form>
              )}
            </div>
            <div className="landing-promises">
              <span>
                <Smartphone size={17} /> Phones hold the tiles
              </span>
              <span>
                <ShieldCheck size={17} /> Saved in your browser
              </span>
            </div>
            {!storageAvailable && (
              <p className="error">
                Browser storage is blocked. Allow site data to create and save
                games.
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {notice && <p className="notice">{notice}</p>}
          </section>
          <DemoBoard />
          <section className="saved-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
                <h2>
                  Your saved tables{" "}
                  <span>{rooms.length.toString().padStart(2, "0")}</span>
                </h2>
              </div>
              <button
                className="text-button"
                onClick={() => importing.current?.click()}
              >
                <Upload size={16} /> Import backup
              </button>
            </div>
            {rooms.length ? (
              <div className="saved-grid">
                {rooms.map((r) => (
                  <button
                    className="saved-card"
                    key={r.code}
                    onClick={() => openTable(r.code, false, "table")}
                  >
                    <span className="saved-icon">
                      <Monitor size={24} />
                    </span>
                    <span>
                      <strong>{r.title}</strong>
                      <small>
                        {r.players.join(", ") || "Waiting for friends"} ·{" "}
                        {r.phase === "finished"
                          ? "Finished"
                          : r.phase === "lobby"
                            ? "Lobby"
                            : "In progress"}
                      </small>
                      <code>{r.code}</code>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-saved">
                <RotateCcw size={20} />
                <span>
                  Your games will be waiting here. Even after you close the tab.
                </span>
                <span className="small-tag">NO ACCOUNT NEEDED</span>
              </div>
            )}
          </section>
          <footer className="landing-footer">
            <span>Made for the people around your table.</span>
            <span>
              2–4 PLAYERS <b>·</b> 100 TILES <b>·</b> ENDLESS POSSIBILITIES
            </span>
          </footer>
        </main>
      ) : (
        <main
          className={`game-shell ${view === "table" ? "table-mode" : "rack-mode"} ${zoom ? "focus-board" : ""}`}
        >
          {!g ? (
            <div className="connecting-screen">
              <span className="logo-tile">
                H<sub>4</sub>
              </span>
              <h1>
                {net.status === "error"
                  ? "Let’s find your table."
                  : "Pulling up a chair…"}
              </h1>
              <p>{net.error || `Connecting to table ${net.code}`}</p>
              {["error", "offline"].includes(net.status) ? (
                <div className="button-row">
                  <button onClick={goHome} className="secondary">
                    Back home
                  </button>
                  <button onClick={() => net.retry()} className="primary">
                    Try again
                  </button>
                </div>
              ) : (
                <LoaderCircle className="spin" />
              )}
            </div>
          ) : (
            <>
              <div className="table-heading">
                <div>
                  <div className="eyebrow">
                    {g.phase === "lobby"
                      ? "GATHER YOUR PEOPLE"
                      : g.phase === "finished"
                        ? "A GAME WELL PLAYED"
                        : "ONE MORE GOOD WORD"}
                  </div>
                  <h1>
                    {g.title}
                    <span className="game-phase">
                      {g.phase === "lobby"
                        ? "LOBBY"
                        : g.phase === "finished"
                          ? "FINAL"
                          : "LIVE"}
                    </span>
                  </h1>
                </div>
                <div className="table-heading-actions">
                  <button
                    className="room-code"
                    onClick={() => copy(g.code, "code")}
                    title="Copy table code"
                  >
                    <span>TABLE CODE</span>
                    <strong>{g.code}</strong>
                    {copied === "code" ? (
                      <Check size={15} />
                    ) : (
                      <Copy size={15} />
                    )}
                  </button>
                  <button
                    aria-label="Invite friends"
                    className="secondary invite-button"
                    onClick={() => setModal("share")}
                  >
                    <Share2 size={16} />
                    <span>Invite friends</span>
                  </button>
                </div>
              </div>
              <div
                className={`network-banner ${["connected", "hosting"].includes(net.status) ? "hidden" : ""}`}
                role="status"
              >
                <LoaderCircle size={18} className="spin" />
                <span>
                  {net.error ||
                    "The host disconnected. Restoring the table from a saved copy…"}
                </span>
                <button onClick={() => net.retry()}>Retry</button>
              </div>
              {net.storageError && (
                <div className="error" role="alert">
                  {net.storageError}
                </div>
              )}
              {error && (
                <div className="error game-error" role="alert">
                  <span>{error}</span>
                  <button
                    aria-label="Dismiss error"
                    onClick={() => setError("")}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {notice && <div className="notice">{notice}</div>}
              <div className="game-layout">
                <aside className="table-sidebar">
                  <div className="sidebar-heading">
                    <span className="eyebrow">AROUND THE TABLE</span>
                    <span>{g.players.length}/4</span>
                  </div>
                  <div className="players">
                    {g.players.map((p, i) => {
                      const online =
                        net.members.some(
                          (m) => m.playerId === p.id && now - m.seen < 12000,
                        ) || p.id === me?.id;
                      return (
                        <div
                          key={p.id}
                          className={`player ${g.phase === "playing" && active!.id === p.id ? "active" : ""} ${p.resigned ? "resigned" : ""}`}
                          style={
                            { "--player-color": COLORS[i] } as CSSProperties
                          }
                        >
                          <span className="avatar">
                            {p.name.slice(0, 1).toUpperCase()}
                            <i className={online ? "online" : ""} />
                          </span>
                          <span className="player-name">
                            <strong>
                              {p.name}
                              {p.id === me?.id && <small> you</small>}
                            </strong>
                            <small>
                              {p.resigned
                                ? "Left the game"
                                : g.phase === "lobby"
                                  ? "Ready to play"
                                  : active!.id === p.id && g.phase === "playing"
                                    ? "Thinking of a good word…"
                                    : `${p.rack.length} tiles · ${online ? "connected" : "away"}`}
                            </small>
                          </span>
                          <strong className="score">
                            {p.score}
                            <small>PTS</small>
                          </strong>
                        </div>
                      );
                    })}
                    {Array.from(
                      { length: Math.max(0, 4 - g.players.length) },
                      (_, i) => (
                        <button
                          className="empty-seat"
                          key={i}
                          onClick={() => setModal(me ? "share" : "join")}
                        >
                          <span>
                            <Plus size={18} />
                          </span>
                          <small>
                            {!me ? "Take a seat" : "Invite a friend"}
                          </small>
                        </button>
                      ),
                    )}
                  </div>
                  {g.phase === "lobby" ? (
                    <div className="lobby-controls">
                      {!me ? (
                        <button
                          className="primary"
                          onClick={() => setModal("join")}
                        >
                          <Smartphone size={17} /> Join as a player
                        </button>
                      ) : (
                        <p className="seated-note">
                          <Check size={16} /> Your seat is saved, {me.name}.
                        </p>
                      )}
                      <button
                        className="secondary start-button"
                        disabled={
                          busy || g.players.length < 2 || (!me && !net.isHost)
                        }
                        onClick={() => void doCommand("start")}
                      >
                        Start game <ArrowRight size={16} />
                      </button>
                      <small>2–4 players. Turn order is drawn at random.</small>
                    </div>
                  ) : (
                    <div className="bag-counter">
                      <span className="bag-icon">♧</span>
                      <div>
                        <strong>
                          {g.bag.length}
                          <span> tiles in the bag</span>
                        </strong>
                        <small>
                          {g.phase === "finished"
                            ? "Thanks for playing."
                            : g.scoreless
                              ? `${g.scoreless} of 6 scoreless turns`
                              : "Make every letter count."}
                        </small>
                      </div>
                    </div>
                  )}
                  <div className="history-section">
                    <div className="sidebar-heading">
                      <span className="eyebrow">THE WORD SO FAR</span>
                      <span>
                        {g.history.length.toString().padStart(2, "0")}
                      </span>
                    </div>
                    {g.history.length ? (
                      <ol className="history">
                        {[...g.history].reverse().map((h, i) => (
                          <li key={h.id}>
                            <span className="move-number">
                              {g.history.length - i}
                            </span>
                            <div>
                              <strong>
                                {h.kind === "play" || h.kind === "bingo"
                                  ? h.words.join(" · ")
                                  : h.kind === "exchange"
                                    ? `Exchanged ${h.words[0]}`
                                    : h.kind === "skipped"
                                      ? "Turn skipped"
                                      : h.kind === "resign"
                                        ? "Left the game"
                                        : "Passed"}
                                {h.kind === "bingo" && (
                                  <span className="bingo-tag">BINGO</span>
                                )}
                              </strong>
                              <small>{h.player}</small>
                            </div>
                            <b>{h.score ? `+${h.score}` : "—"}</b>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="empty-history">
                        <span>✳</span>
                        <p>
                          Every great game
                          <br />
                          starts with one word.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="saved-indicator">
                    <ShieldCheck size={15} />
                    <span>
                      {net.isHost
                        ? "Game saved on this device"
                        : "Recovery copy saved here"}
                    </span>
                  </div>
                </aside>
                <section className="board-area">
                  <div className="board-toolbar">
                    <div className="turn-status">
                      <span className={`turn-dot ${myTurn ? "mine" : ""}`} />
                      {g.phase === "lobby"
                        ? "The board is ready when you are."
                        : g.phase === "finished"
                          ? "The final board"
                          : myTurn
                            ? "Your turn. Make it a good one."
                            : `${active!.name}’s turn`}{" "}
                      {busy && <LoaderCircle size={14} className="spin" />}
                    </div>
                    <div className="board-tools">
                      {g.phase === "playing" && !me && (
                        <button
                          className="compact-seat"
                          onClick={() => setModal("recover")}
                        >
                          Recover seat
                        </button>
                      )}
                      {g.phase === "finished" && (
                        <button
                          className="compact-seat"
                          onClick={() => setModal("results")}
                        >
                          Final scores
                        </button>
                      )}
                      <button
                        className={view === "table" ? "active" : ""}
                        title={
                          view === "table"
                            ? "Show my rack"
                            : "Table display: hide my rack"
                        }
                        onClick={() => {
                          const v = view === "table" ? "rack" : "table";
                          setView(v);
                          location.hash = new URLSearchParams({
                            room: g.code,
                            view: v,
                          }).toString();
                        }}
                      >
                        {view === "table" ? (
                          <Monitor size={17} />
                        ) : (
                          <Smartphone size={17} />
                        )}
                        <span>{view === "table" ? "Table" : "My rack"}</span>
                      </button>
                      <IconButton
                        label={zoom ? "Show table controls" : "Focus on board"}
                        onClick={() => setZoom(!zoom)}
                      >
                        <Maximize2 size={16} />
                      </IconButton>
                    </div>
                  </div>
                  <div className="board-scroll" ref={boardStage}>
                    <div
                      className="board-frame"
                      style={
                        boardSize
                          ? { width: boardSize, height: boardSize }
                          : undefined
                      }
                    >
                      <div className="column-labels">
                        {Array.from({ length: 15 }, (_, i) => (
                          <span key={i}>{i + 1}</span>
                        ))}
                      </div>
                      <div className="row-labels">
                        {"ABCDEFGHIJKLMNO".split("").map((l) => (
                          <span key={l}>{l}</span>
                        ))}
                      </div>
                      <div
                        className="board"
                        role="grid"
                        aria-label="Scrabble board, fifteen rows and fifteen columns"
                      >
                        {g.board.map((existing, i) => {
                          const placement = draft.find((p) => p.index === i);
                          const tile =
                            existing ||
                            (placement
                              ? active!.rack.find(
                                  (t) => t.id === placement.tileId,
                                )
                              : null);
                          const letter =
                            existing?.letter ||
                            placement?.letter ||
                            tile?.letter;
                          const premium = PREMIUM[i];
                          return (
                            <button
                              key={i}
                              role="gridcell"
                              className={`cell ${premium || ""} ${tile ? "occupied" : ""} ${placement ? "draft" : ""} ${g.lastCells.includes(i) ? "last-move" : ""} ${cursor === i ? "cursor" : ""}`}
                              aria-label={`${coordinate(i)}, ${tile ? `${letter}, ${existing?.blank || tile.letter === "?" ? "blank" : tile.value + " points"}${placement ? ", pending" : ""}` : i === 112 ? "center star, double word" : premium ? premium.replace("TW", "triple word").replace("DW", "double word").replace("TL", "triple letter").replace("DL", "double letter") : "empty"}`}
                              onClick={() => {
                                if (!myTurn) {
                                  setCursor(i);
                                  return;
                                }
                                if (placement) {
                                  void doCommand("draft", {
                                    placements: draft.filter(
                                      (p) => p.index !== i,
                                    ),
                                  });
                                  return;
                                }
                                if (selected) void place(selected, i);
                                else setCursor(i);
                              }}
                              onDragOver={(e) => {
                                if (myTurn && !existing) e.preventDefault();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (myTurn)
                                  void place(
                                    e.dataTransfer.getData("text/plain"),
                                    i,
                                  );
                              }}
                            >
                              {tile ? (
                                <span
                                  className={`board-tile ${existing?.blank || tile.letter === "?" ? "blank" : ""}`}
                                >
                                  <span>{letter}</span>
                                  <sub>
                                    {existing?.blank || tile.letter === "?"
                                      ? "★"
                                      : tile.value}
                                  </sub>
                                </span>
                              ) : (
                                <span className="premium-label">
                                  {i === 112 ? (
                                    <span className="center-star">★</span>
                                  ) : premium ? (
                                    <>
                                      {premium[0] === "T" ? "TRIPLE" : "DOUBLE"}
                                      <br />
                                      {premium[1] === "W" ? "WORD" : "LETTER"}
                                      <br />
                                      <b>
                                        {premium[1] === "W" ? "SCORE" : "SCORE"}
                                      </b>
                                    </>
                                  ) : null}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="board-footer">
                        <img
                          className="board-wordmark"
                          src={`${import.meta.env.BASE_URL}assets/scrabble-logo.svg`}
                          alt="SCRABBLE"
                        />
                        <div
                          className="board-distribution"
                          aria-label="Classic English tile distribution"
                        >
                          <strong>LETTER DISTRIBUTION</strong>
                          <span>
                            A–9 · B–2 · C–2 · D–4 · E–12 · F–2 · G–3 · H–2 · I–9
                          </span>
                          <span>
                            J–1 · K–1 · L–4 · M–2 · N–6 · O–8 · P–2 · Q–1 · R–6
                          </span>
                          <span>
                            S–4 · T–6 · U–4 · V–2 · W–2 · X–1 · Y–2 · Z–1 ·
                            BLANK–2
                          </span>
                        </div>
                        <span className="board-edition">
                          BRAND
                          <br />
                          CROSSWORD GAME
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="board-legend">
                    <span>
                      <i className="TW" /> Triple word
                    </span>
                    <span>
                      <i className="DW" /> Double word
                    </span>
                    <span>
                      <i className="TL" /> Triple letter
                    </span>
                    <span>
                      <i className="DL" /> Double letter
                    </span>
                  </div>
                  {g.phase === "lobby" ? (
                    <div className="table-welcome">
                      <span className="welcome-icon">
                        <Smartphone size={26} />
                      </span>
                      <div>
                        <h2>
                          A board for everyone.
                          <br className="mobile-break" /> A rack just for you.
                        </h2>
                        <p>
                          Scan the table’s QR code on each phone, then take a
                          seat.
                        </p>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => setModal("share")}
                      >
                        Show QR <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : g.phase === "finished" ? (
                    <div className="finished-card">
                      <span className="eyebrow">THE FINAL TALLY</span>
                      <h2>
                        {(() => {
                          const high = Math.max(
                            ...g.players.map((p) => p.score),
                          );
                          const winners = g.players.filter(
                            (p) => p.score === high,
                          );
                          return (
                            winners.map((p) => p.name).join(" & ") +
                            (winners.length > 1 ? " tie!" : " wins!")
                          );
                        })()}
                      </h2>
                      <p>
                        {g.finishReason} Remaining tile values have been
                        settled.
                      </p>
                      <div className="button-row">
                        <button
                          className="primary"
                          disabled={!me || busy}
                          onClick={() => void doCommand("rematch")}
                        >
                          Another round <RotateCcw size={16} />
                        </button>
                        <button
                          className="secondary"
                          onClick={() => exportGame(g)}
                        >
                          Save game <Download size={16} />
                        </button>
                      </div>
                    </div>
                  ) : me && view === "rack" && !me.resigned ? (
                    <section
                      className={`rack-panel ${myTurn ? "your-turn" : ""}`}
                    >
                      <div className="rack-heading">
                        <div>
                          <span className="eyebrow">
                            {me.name.toUpperCase()}’S RACK
                          </span>
                          <span className="private-label">
                            <ShieldCheck size={12} /> Only shown on your screen
                          </span>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setModal("recovery")}
                        >
                          Keep my seat <Link size={13} />
                        </button>
                      </div>
                      <div className="rack-and-score">
                        <div className="rack">
                          {sorted.map((t) => (
                            <TileView
                              key={t.id}
                              tile={t}
                              selected={selected === t.id}
                              disabled={!myTurn || busy}
                              onClick={() =>
                                setSelected(selected === t.id ? null : t.id)
                              }
                            />
                          ))}
                          {Array.from({ length: 7 - sorted.length }, (_, i) => (
                            <span className="rack-empty" key={i} />
                          ))}
                        </div>
                        <div className="move-score">
                          <strong>{preview?.score ?? "—"}</strong>
                          <span>
                            {preview?.bingo ? "BINGO +50" : "THIS MOVE"}
                          </span>
                        </div>
                      </div>
                      <div className="rack-hint">
                        {!myTurn
                          ? `${active!.name} is playing. Your tiles are safe here.`
                          : draft.length
                            ? preview
                              ? `${preview.words.join(" + ")} · ${preview.score} points${preview.bingo ? " · includes 50-point bonus" : ""}`
                              : validation
                            : selected
                              ? "Tap an empty square to place your tile."
                              : cursor !== null
                                ? `${coordinate(cursor)} selected · type letters or choose a tile`
                                : "Tap a tile, then a square. Or drag it onto the board."}
                      </div>
                      <div className="rack-actions">
                        <div>
                          <IconButton
                            label="Shuffle rack"
                            onClick={() =>
                              setRackOrder(
                                [...available]
                                  .sort(() => Math.random() - 0.5)
                                  .map((t) => t.id),
                              )
                            }
                          >
                            <Shuffle size={18} />
                          </IconButton>
                          <button
                            className="text-button"
                            disabled={!myTurn || !draft.length || busy}
                            onClick={() =>
                              void doCommand("draft", { placements: [] })
                            }
                          >
                            <RotateCcw size={16} /> Recall
                          </button>
                          <button
                            aria-label={`Placement direction: ${direction}. Switch direction.`}
                            className="direction-button"
                            disabled={!myTurn}
                            onClick={() =>
                              setDirection(
                                direction === "across" ? "down" : "across",
                              )
                            }
                          >
                            {direction === "across" ? (
                              <ArrowRight size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                            <span>{direction}</span>
                          </button>
                        </div>
                        <div>
                          <button
                            className="text-button"
                            disabled={!myTurn || busy}
                            onClick={() => setModal("pass")}
                          >
                            Pass
                          </button>
                          <button
                            className="text-button"
                            disabled={!myTurn || busy || g.bag.length < 7}
                            onClick={() => {
                              setSwapIds([]);
                              setModal("exchange");
                            }}
                          >
                            Exchange
                          </button>
                          <button
                            className="primary play-button"
                            disabled={!myTurn || busy || !draft.length}
                            onClick={() =>
                              void doCommand("play", { placements: draft })
                            }
                          >
                            Play word <Check size={17} />
                          </button>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <div className="watching-card">
                      <Monitor size={24} />
                      <div>
                        <strong>
                          {view === "table"
                            ? "The whole table, one shared board."
                            : me?.resigned
                              ? "You’re watching the game."
                              : "Watching from the sidelines."}
                        </strong>
                        <p>
                          {view === "table" && me
                            ? "Your rack is hidden on this display. Open My rack when you want to play."
                            : !me
                              ? "Return on your phone with your saved seat, or use your recovery key."
                              : "The game will keep going for everyone else."}
                        </p>
                      </div>
                      <button
                        className="secondary"
                        onClick={() =>
                          me ? setView("rack") : setModal("recover")
                        }
                      >
                        {me ? "Show my rack" : "Recover seat"}
                      </button>
                    </div>
                  )}
                </section>
              </div>
              {g.phase === "playing" &&
                active &&
                !net.members.some(
                  (m) => m.playerId === active!.id && now - m.seen < 12000,
                ) &&
                active!.id !== me?.id &&
                now - g.turnStarted >= 60000 &&
                (me || net.isHost) && (
                  <div className="absent-banner">
                    <WifiOff size={17} />
                    <span>
                      {active!.name} is away. Their seat and rack will be kept.
                    </span>
                    <button onClick={() => setModal("skip")}>
                      Skip this turn
                    </button>
                  </div>
                )}
              <footer className="game-footer">
                <span>
                  <span className="tiny-star">✳</span>{" "}
                  {g.dictionary === "enable"
                    ? "ENABLE dictionary · automatic word checks"
                    : "Friendly table · house words welcome"}
                </span>
                <span>
                  {g.history.length} {g.history.length === 1 ? "turn" : "turns"}{" "}
                  <b>·</b> {g.players.reduce((s, p) => s + p.score, 0)} points
                  on the table
                </span>
              </footer>
            </>
          )}
        </main>
      )}
      <input
        className="visually-hidden"
        ref={importing}
        type="file"
        accept="application/json,.json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = "";
        }}
      />
      {modal === "history" && g && (
        <Modal title="The word so far." onClose={() => setModal("")}>
          {g.history.length ? (
            <ol className="history modal-history">
              {[...g.history].reverse().map((h, i) => (
                <li key={h.id}>
                  <span className="move-number">{g.history.length - i}</span>
                  <div>
                    <strong>
                      {h.kind === "play" || h.kind === "bingo"
                        ? h.words.join(" · ")
                        : h.kind}
                    </strong>
                    <small>{h.player}</small>
                  </div>
                  <b>{h.score ? `+${h.score}` : "—"}</b>
                </li>
              ))}
            </ol>
          ) : (
            <p className="modal-intro">
              The first word is still waiting to be played.
            </p>
          )}
        </Modal>
      )}
      {modal === "results" && g && (
        <Modal title="The final score." onClose={() => setModal("")}>
          <p className="modal-intro">
            {g.finishReason} Remaining tile values have been settled.
          </p>
          <div className="results-list">
            {[...g.players]
              .sort((a, b) => b.score - a.score)
              .map((p, i) => (
                <div key={p.id}>
                  <span>{i === 0 ? "★" : i + 1}</span>
                  <strong>{p.name}</strong>
                  <b>{p.score}</b>
                </div>
              ))}
          </div>
          <div className="button-row">
            <button className="secondary" onClick={() => setModal("")}>
              View board
            </button>
            <button
              className="primary"
              disabled={!me || busy}
              onClick={() => void doCommand("rematch")}
            >
              Another round <RotateCcw size={16} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "rules" && (
        <Modal
          title="A few words before we play."
          onClose={() => setModal("")}
          wide
        >
          <Rules />
        </Modal>
      )}
      {modal === "share" && g && (
        <Modal title="There’s a seat for you." onClose={() => setModal("")}>
          <p className="modal-intro">
            Scan with each phone’s camera. Your phone becomes your private tile
            rack.
          </p>
          <div className="qr-card">
            {qr ? (
              <img
                src={qr}
                alt={`QR code to join table ${g.code}`}
                width="224"
                height="224"
              />
            ) : (
              <LoaderCircle className="spin" />
            )}
            <small>JOIN OUR TABLE</small>
            <strong>{g.code}</strong>
          </div>
          <div className="share-link">
            <input
              aria-label="Invite link"
              readOnly
              value={inviteLink(g.code)}
              onFocus={(e) => e.target.select()}
            />
            <button
              className="secondary"
              onClick={() => copy(inviteLink(g.code), "link")}
            >
              {copied === "link" ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <p className="form-note">
            Keep this page open while friends join. Connected devices can take
            over hosting automatically.
          </p>
        </Modal>
      )}
      {(modal === "join" || modal === "recover") && g && (
        <Modal
          title={
            modal === "join" ? "Pull up a chair." : "Your tiles are waiting."
          }
          onClose={() => setModal("")}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void doCommand(
                modal === "join" ? "join" : "recover",
                modal === "join" ? { name } : { key: recoverKey },
              );
            }}
          >
            <p className="modal-intro">
              {modal === "join"
                ? "Choose a name for the table. Your seat saves automatically on this device."
                : "Enter your private recovery key to restore your seat and rack on this device."}
            </p>
            <label htmlFor="seat-input">
              {modal === "join" ? "YOUR NAME" : "SEAT RECOVERY KEY"}
            </label>
            <input
              id="seat-input"
              autoFocus
              value={modal === "join" ? name : recoverKey}
              onChange={(e) =>
                modal === "join"
                  ? setName(e.target.value)
                  : setRecoverKey(e.target.value.toUpperCase())
              }
              maxLength={modal === "join" ? 20 : 12}
              required
              placeholder={
                modal === "join" ? "First name or nickname" : "12-character key"
              }
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary full-width"
              disabled={busy}
              type="submit"
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : modal === "join" ? (
                "Take my seat"
              ) : (
                "Recover my seat"
              )}
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="text-button full-width"
              onClick={() => {
                setError("");
                setModal(modal === "join" ? "recover" : "join");
              }}
            >
              {modal === "join"
                ? "Already played here? Recover your seat."
                : g.phase === "lobby"
                  ? "New to this table? Take a seat."
                  : "Your saved device can show your key under “Keep my seat”."}
            </button>
          </form>
        </Modal>
      )}
      {modal === "recovery" && g && me && (
        <Modal title="Same seat. Any screen." onClose={() => setModal("")}>
          <p className="modal-intro">
            Your seat saves automatically in this browser. Keep this private key
            to restore it on another device.
          </p>
          <div className="recovery-key">
            <small>{me.name.toUpperCase()}’S PRIVATE KEY</small>
            <strong>{me.recovery}</strong>
            <button
              className="secondary"
              onClick={() => copy(me.recovery, "recovery")}
            >
              {copied === "recovery" ? <Check size={16} /> : <Copy size={16} />}{" "}
              Copy key
            </button>
          </div>
          <p className="form-note">
            Join table <b>{g.code}</b> and choose “Recover your seat.” Anyone
            with this key can use your rack.
          </p>
        </Modal>
      )}
      {modal === "exchange" && g && me && (
        <Modal
          title="A fresh set of possibilities."
          onClose={() => setModal("")}
        >
          <p className="modal-intro">
            Choose tiles to return to the bag. Exchanging uses your turn.
          </p>
          <div className="exchange-rack">
            {me.rack.map((t) => (
              <TileView
                key={t.id}
                tile={t}
                selected={swapIds.includes(t.id)}
                onClick={() =>
                  setSwapIds(
                    swapIds.includes(t.id)
                      ? swapIds.filter((x) => x !== t.id)
                      : [...swapIds, t.id],
                  )
                }
              />
            ))}
          </div>
          {error && <p className="error">{error}</p>}
          <button
            className="primary full-width"
            disabled={!swapIds.length || busy}
            onClick={() => void doCommand("exchange", { ids: swapIds })}
          >
            Exchange {swapIds.length || ""} tile
            {swapIds.length === 1 ? "" : "s"} <Shuffle size={16} />
          </button>
        </Modal>
      )}
      {blankTarget && (
        <Modal title="A little wildcard." onClose={() => setBlankTarget(null)}>
          <p className="modal-intro">
            Choose the letter this blank will represent. It stays worth zero
            points.
          </p>
          <div className="alphabet">
            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => (
              <button
                key={l}
                onClick={() => {
                  const target = blankTarget;
                  setBlankTarget(null);
                  void place(target.tileId, target.index, l);
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {["pass", "skip", "resign", "leave"].includes(modal) && (
        <Modal
          title={
            modal === "pass"
              ? "Let this one pass?"
              : modal === "skip"
                ? "Keep the game moving?"
                : modal === "resign"
                  ? "Leave your seat?"
                  : "Back to your saved tables?"
          }
          onClose={() => setModal("")}
        >
          <p className="modal-intro">
            {modal === "pass"
              ? "Your draft returns to your rack and play moves to the next player."
              : modal === "skip"
                ? "The disconnected player keeps their tiles. Only this turn will be skipped."
                : modal === "resign"
                  ? "Your remaining tile values will be deducted. You can still watch while the other players finish."
                  : "This game stays saved in your browser. Another connected device will take over hosting if needed."}
          </p>
          <div className="button-row">
            <button className="secondary" onClick={() => setModal("")}>
              Stay here
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                modal === "leave"
                  ? goHome()
                  : void doCommand(
                      modal === "skip"
                        ? "skip"
                        : modal === "resign"
                          ? "resign"
                          : "pass",
                    )
              }
            >
              {modal === "leave"
                ? "Back home"
                : modal === "skip"
                  ? "Skip this turn"
                  : modal === "resign"
                    ? "Leave game"
                    : "Pass turn"}
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "settings" && g && (
        <Modal title="At this table." onClose={() => setModal("")}>
          <div className="settings-list">
            <button onClick={() => setModal("history")}>
              <Users size={20} />
              <span>
                <strong>Move history</strong>
                <small>Words, turns, and scores from this game</small>
              </span>
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => {
                exportGame(g);
                setNotice(
                  "Game backup exported. It includes the complete game and all private racks.",
                );
                setModal("");
              }}
            >
              <Download size={20} />
              <span>
                <strong>Export game backup</strong>
                <small>Keep a complete copy outside browser storage</small>
              </span>
              <ArrowRight size={16} />
            </button>
            <button onClick={() => setSound(!sound)}>
              {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
              <span>
                <strong>Tile sounds</strong>
                <small>
                  {sound ? "On · a quiet little click" : "Off · keep it quiet"}
                </small>
              </span>
              <span className={`toggle ${sound ? "on" : ""}`} />
            </button>
            {me && (
              <button onClick={() => setModal("recovery")}>
                <Link size={20} />
                <span>
                  <strong>My seat recovery key</strong>
                  <small>Bring your rack to another device</small>
                </span>
                <ArrowRight size={16} />
              </button>
            )}
            <button
              onClick={() => {
                setModal("rules");
              }}
            >
              <HelpCircle size={20} />
              <span>
                <strong>How to play & how saving works</strong>
                <small>Rules, word list, and connection details</small>
              </span>
              <ArrowRight size={16} />
            </button>
            {me && g.phase === "playing" && !me.resigned && (
              <button onClick={() => setModal("resign")}>
                <ArrowLeft size={20} />
                <span>
                  <strong>Resign from this game</strong>
                  <small>The other players can carry on</small>
                </span>
                <ArrowRight size={16} />
              </button>
            )}
            {me && g.phase === "lobby" && (
              <button onClick={() => void doCommand("leave-lobby")}>
                <ArrowLeft size={20} />
                <span>
                  <strong>Give up my seat</strong>
                  <small>Stay at the table as a display</small>
                </span>
                <ArrowRight size={16} />
              </button>
            )}
            <button onClick={() => setModal("leave")}>
              <Home size={20} />
              <span>
                <strong>Back to saved tables</strong>
                <small>This game stays saved on your device</small>
              </span>
              <ArrowRight size={16} />
            </button>
          </div>
          <p className="form-note">
            No accounts. No cloud database. Browser storage + PeerJS. Keep one
            saved copy to resume after everybody leaves.
          </p>
        </Modal>
      )}
    </>
  );
}
