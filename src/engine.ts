export type Tile = { id: string; letter: string; value: number };
export type Square = Tile & { blank: boolean };
export type Placement = { index: number; tileId: string; letter?: string };
export type Player = {
  id: string;
  name: string;
  rack: Tile[];
  score: number;
  resigned: boolean;
  recovery: string;
};
export type Move = {
  id: string;
  player: string;
  kind: string;
  words: string[];
  score: number;
  at: number;
  cells?: number[];
};
export type Game = {
  schema: 1;
  id: string;
  code: string;
  title: string;
  phase: "lobby" | "playing" | "finished";
  board: (Square | null)[];
  bag: Tile[];
  players: Player[];
  turn: number;
  turnStarted: number;
  draft: Placement[];
  history: Move[];
  scoreless: number;
  version: number;
  epoch: number;
  leader: string;
  created: number;
  updated: number;
  dictionary: "enable" | "friendly";
  receipts: string[];
  finishReason?: string;
  lastCells: number[];
};
export const VALUES: Record<string, number> = {
  A: 1,
  B: 3,
  C: 3,
  D: 2,
  E: 1,
  F: 4,
  G: 2,
  H: 4,
  I: 1,
  J: 8,
  K: 5,
  L: 1,
  M: 3,
  N: 1,
  O: 1,
  P: 3,
  Q: 10,
  R: 1,
  S: 1,
  T: 1,
  U: 1,
  V: 4,
  W: 4,
  X: 8,
  Y: 4,
  Z: 10,
  "?": 0,
};
const COUNTS: Record<string, number> = {
  A: 9,
  B: 2,
  C: 2,
  D: 4,
  E: 12,
  F: 2,
  G: 3,
  H: 2,
  I: 9,
  J: 1,
  K: 1,
  L: 4,
  M: 2,
  N: 6,
  O: 8,
  P: 2,
  Q: 1,
  R: 6,
  S: 4,
  T: 6,
  U: 4,
  V: 2,
  W: 2,
  X: 1,
  Y: 2,
  Z: 1,
  "?": 2,
};
export const PREMIUM: Record<number, string> = {};
function mark(kind: string, coords: number[][]) {
  for (const [r, c] of coords) PREMIUM[r * 15 + c] = kind;
}
mark("TW", [
  [0, 0],
  [0, 7],
  [0, 14],
  [7, 0],
  [7, 14],
  [14, 0],
  [14, 7],
  [14, 14],
]);
mark("DW", [
  [1, 1],
  [2, 2],
  [3, 3],
  [4, 4],
  [7, 7],
  [10, 10],
  [11, 11],
  [12, 12],
  [13, 13],
  [1, 13],
  [2, 12],
  [3, 11],
  [4, 10],
  [10, 4],
  [11, 3],
  [12, 2],
  [13, 1],
]);
mark("TL", [
  [1, 5],
  [1, 9],
  [5, 1],
  [5, 5],
  [5, 9],
  [5, 13],
  [9, 1],
  [9, 5],
  [9, 9],
  [9, 13],
  [13, 5],
  [13, 9],
]);
mark("DL", [
  [0, 3],
  [0, 11],
  [2, 6],
  [2, 8],
  [3, 0],
  [3, 7],
  [3, 14],
  [6, 2],
  [6, 6],
  [6, 8],
  [6, 12],
  [7, 3],
  [7, 11],
  [8, 2],
  [8, 6],
  [8, 8],
  [8, 12],
  [11, 0],
  [11, 7],
  [11, 14],
  [12, 6],
  [12, 8],
  [14, 3],
  [14, 11],
]);
export function uid() {
  return crypto.randomUUID();
}
export function shuffle<T>(input: T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const n = new Uint32Array(1);
    crypto.getRandomValues(n);
    const j = n[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function makeBag(): Tile[] {
  return shuffle(
    Object.entries(COUNTS).flatMap(([letter, n]) =>
      Array.from({ length: n }, (_, i) => ({
        id: `${letter}${i}`,
        letter,
        value: VALUES[letter],
      })),
    ),
  );
}
export function createGame(
  code: string,
  leader: string,
  title = "Scrabble night",
  dictionary: Game["dictionary"] = "enable",
): Game {
  const now = Date.now();
  return {
    schema: 1,
    id: uid(),
    code,
    title: title.trim().slice(0, 40) || "Scrabble night",
    phase: "lobby",
    board: Array(225).fill(null),
    bag: makeBag(),
    players: [],
    turn: 0,
    turnStarted: now,
    draft: [],
    history: [],
    scoreless: 0,
    version: 0,
    epoch: 0,
    leader,
    created: now,
    updated: now,
    dictionary,
    receipts: [],
    lastCells: [],
  };
}
export function playerById(g: Game, id: string) {
  const p = g.players.find((p) => p.id === id);
  if (!p) throw Error("Join the table as a player first.");
  return p;
}
export function addPlayer(g: Game, id: string, name: string, recovery: string) {
  if (g.players.some((p) => p.id === id)) return;
  if (g.phase !== "lobby")
    throw Error(
      "This game has started. Use your saved seat or recovery key to rejoin.",
    );
  if (g.players.length >= 4)
    throw Error("All four seats are taken. You can still watch the board.");
  name = name.trim().slice(0, 20);
  if (!name) throw Error("Enter your name to take a seat.");
  if (g.players.some((p) => p.name.toLowerCase() === name.toLowerCase()))
    throw Error(
      "That name is already seated. Use a different name or recover your seat.",
    );
  g.players.push({ id, name, rack: [], score: 0, resigned: false, recovery });
}
export function startGame(g: Game) {
  if (g.phase !== "lobby") throw Error("The game has already started.");
  if (g.players.length < 2) throw Error("At least two players need to join.");
  g.players = shuffle(g.players);
  g.players.forEach((p) => {
    p.rack = g.bag.splice(0, 7);
  });
  g.phase = "playing";
  g.turn = 0;
  g.turnStarted = Date.now();
}
export function assertTurn(g: Game, id: string) {
  if (g.phase !== "playing") throw Error("The game is not in progress.");
  const p = playerById(g, id);
  if (g.players[g.turn]?.id !== id) throw Error("Wait for your turn.");
  if (p.resigned) throw Error("You have left this game.");
  return p;
}
export function materialize(g: Game, id: string, placements: Placement[]) {
  const p = assertTurn(g, id);
  if (!Array.isArray(placements) || placements.length > 7)
    throw Error("Place up to seven tiles.");
  const board = [...g.board];
  const used = new Set<string>();
  const cells = new Set<number>();
  for (const q of placements) {
    if (
      !q ||
      !Number.isInteger(q.index) ||
      q.index < 0 ||
      q.index >= 225 ||
      cells.has(q.index) ||
      board[q.index]
    )
      throw Error("Choose an empty square for each tile.");
    const tile = p.rack.find((t) => t.id === q.tileId);
    if (!tile || used.has(q.tileId))
      throw Error("Use each tile from your rack only once.");
    let letter = tile.letter;
    if (letter === "?") {
      letter = (q.letter || "").toUpperCase();
      if (!/^[A-Z]$/.test(letter))
        throw Error("Choose a letter for the blank tile.");
    }
    board[q.index] = { ...tile, letter, blank: tile.letter === "?" };
    used.add(q.tileId);
    cells.add(q.index);
  }
  return { board, used, cells };
}
function adjacent(index: number, delta: number) {
  const n = index + delta;
  return n >= 0 &&
    n < 225 &&
    (Math.abs(delta) === 15 || Math.floor(n / 15) === Math.floor(index / 15))
    ? n
    : -1;
}
function wordAt(board: (Square | null)[], index: number, step: number) {
  let start = index;
  while (adjacent(start, -step) >= 0 && board[adjacent(start, -step)])
    start = adjacent(start, -step);
  const cells: number[] = [];
  for (let x = start; x >= 0 && board[x]; x = adjacent(x, step)) cells.push(x);
  return cells;
}
export function evaluate(
  g: Game,
  id: string,
  placements: Placement[],
  valid: (word: string) => boolean = () => true,
) {
  if (!placements.length) throw Error("Place tiles on the board first.");
  const { board, cells, used } = materialize(g, id, placements);
  const indexes = [...cells];
  const sameRow = indexes.every(
    (i) => Math.floor(i / 15) === Math.floor(indexes[0] / 15),
  );
  const sameCol = indexes.every((i) => i % 15 === indexes[0] % 15);
  if (!sameRow && !sameCol)
    throw Error("Place your tiles in one row or one column.");
  let step = sameRow ? 1 : 15;
  if (indexes.length === 1 && wordAt(board, indexes[0], 15).length > 1)
    step = 15;
  const main = wordAt(board, indexes[0], step);
  if (!indexes.every((i) => main.includes(i)))
    throw Error("Leave no gaps between your tiles.");
  const first = g.board.every((x) => !x);
  if (first && !cells.has(112))
    throw Error("Your first word must cover the center star.");
  if (
    !first &&
    !indexes.some((i) =>
      [1, -1, 15, -15].some((d) => {
        const n = adjacent(i, d);
        return n >= 0 && !!g.board[n];
      }),
    )
  )
    throw Error("Connect your word to a tile already on the board.");
  const groups: number[][] = [];
  if (main.length > 1) groups.push(main);
  for (const i of indexes) {
    const cross = wordAt(board, i, step === 1 ? 15 : 1);
    if (cross.length > 1) groups.push(cross);
  }
  if (!groups.length) throw Error("A word must contain at least two letters.");
  let score = 0;
  const words: string[] = [];
  const breakdown: { word: string; score: number }[] = [];
  for (const group of groups) {
    const word = group.map((i) => board[i]!.letter).join("");
    if (g.dictionary === "enable" && !valid(word))
      throw Error(`${word} is not in the ENABLE dictionary.`);
    let total = 0,
      mult = 1;
    for (const i of group) {
      const t = board[i]!;
      let v = t.value;
      if (cells.has(i)) {
        const premium = PREMIUM[i];
        if (premium === "DL") v *= 2;
        if (premium === "TL") v *= 3;
        if (premium === "DW") mult *= 2;
        if (premium === "TW") mult *= 3;
      }
      total += v;
    }
    total *= mult;
    words.push(word);
    breakdown.push({ word, score: total });
    score += total;
  }
  const bingo = placements.length === 7;
  if (bingo) score += 50;
  return { score, words, board, used, bingo, breakdown };
}
function record(
  g: Game,
  p: Player,
  kind: string,
  score = 0,
  words: string[] = [],
  cells: number[] = [],
) {
  g.history.push({
    id: uid(),
    player: p.name,
    kind,
    score,
    words,
    at: Date.now(),
    cells,
  });
  g.lastCells = cells;
}
export function finish(g: Game, reason: string, wentOut?: string) {
  if (g.phase === "finished") return;
  let penalty = 0;
  for (const p of g.players) {
    if (p.resigned) continue;
    const left = p.rack.reduce((s, t) => s + t.value, 0);
    p.score -= left;
    penalty += left;
  }
  if (wentOut) playerById(g, wentOut).score += penalty;
  g.phase = "finished";
  g.finishReason = reason;
  g.draft = [];
}
function advance(g: Game) {
  g.draft = [];
  if (g.scoreless >= 6) {
    finish(g, "Six consecutive turns without scoring.");
    return;
  }
  if (g.players.filter((p) => !p.resigned).length < 2) {
    finish(g, "Only one player remains.");
    return;
  }
  do {
    g.turn = (g.turn + 1) % g.players.length;
  } while (g.players[g.turn].resigned);
  g.turnStarted = Date.now();
}
export function play(
  g: Game,
  id: string,
  placements: Placement[],
  valid: (word: string) => boolean,
) {
  const p = assertTurn(g, id);
  const result = evaluate(g, id, placements, valid);
  g.board = result.board;
  p.rack = p.rack.filter((t) => !result.used.has(t.id));
  p.score += result.score;
  p.rack.push(...g.bag.splice(0, 7 - p.rack.length));
  record(
    g,
    p,
    result.bingo ? "bingo" : "play",
    result.score,
    result.words,
    placements.map((q) => q.index),
  );
  g.scoreless = result.score > 0 ? 0 : g.scoreless + 1;
  if (!p.rack.length && !g.bag.length)
    finish(g, `${p.name} played their last tile.`, id);
  else advance(g);
  return result;
}
export function pass(g: Game, id: string, disconnected = false) {
  const p = assertTurn(g, id);
  record(g, p, disconnected ? "skipped" : "pass");
  g.scoreless++;
  advance(g);
}
export function exchange(g: Game, id: string, ids: string[]) {
  const p = assertTurn(g, id);
  if (g.bag.length < 7)
    throw Error("You need at least seven tiles in the bag to exchange.");
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 7 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !p.rack.some((t) => t.id === id))
  )
    throw Error("Select tiles from your rack to exchange.");
  const removed = p.rack.filter((t) => ids.includes(t.id));
  p.rack = p.rack.filter((t) => !ids.includes(t.id));
  p.rack.push(...g.bag.splice(0, removed.length));
  g.bag = shuffle([...g.bag, ...removed]);
  record(g, p, "exchange", 0, [
    `${ids.length} tile${ids.length === 1 ? "" : "s"}`,
  ]);
  g.scoreless++;
  advance(g);
}
export function resign(g: Game, id: string) {
  if (g.phase !== "playing") throw Error("The game is not in progress.");
  const p = playerById(g, id);
  if (p.resigned) throw Error("You have already left.");
  p.score -= p.rack.reduce((s, t) => s + t.value, 0);
  p.resigned = true;
  record(g, p, "resign");
  if (g.players.filter((p) => !p.resigned).length < 2)
    finish(g, "Only one player remains.");
  else if (g.players[g.turn].id === id) advance(g);
}
export function restart(g: Game) {
  if (g.phase !== "finished")
    throw Error("Finish this game before starting a rematch.");
  const next = createGame(g.code, g.leader, g.title, g.dictionary);
  next.id = g.id;
  next.version = g.version;
  next.epoch = g.epoch;
  next.players = g.players
    .filter((p) => !p.resigned)
    .map((p) => ({ ...p, rack: [], score: 0, resigned: false }));
  return next;
}
export function validateSnapshot(value: unknown): value is Game {
  if (!value || typeof value !== "object") return false;
  const g = value as Game;
  const text = (v: unknown, max = 100) =>
    typeof v === "string" && v.length > 0 && v.length <= max;
  const integer = (v: unknown) => Number.isSafeInteger(v);
  const tile = (v: unknown, square = false): boolean => {
    if (!v || typeof v !== "object") return false;
    const t = v as Square;
    return (
      text(t.id) &&
      typeof t.letter === "string" &&
      (square ? /^[A-Z]$/ : /^[A-Z?]$/).test(t.letter) &&
      integer(t.value) &&
      (square && t.blank ? t.value === 0 : t.value === VALUES[t.letter])
    );
  };
  if (!(
    g.schema === 1 &&
    text(g.id) &&
    typeof g.code === "string" &&
    /^[A-Z2-9]{6}$/.test(g.code) &&
    text(g.title, 40) &&
    ["lobby", "playing", "finished"].includes(g.phase) &&
    ["enable", "friendly"].includes(g.dictionary) &&
    Array.isArray(g.board) &&
    g.board.length === 225 &&
    g.board.every(
      (t) => t === null || (tile(t, true) && typeof t.blank === "boolean"),
    ) &&
    Array.isArray(g.players) &&
    g.players.length <= 4 &&
    g.players.every(
      (p) =>
        p &&
        text(p.id) &&
        text(p.name, 20) &&
        text(p.recovery, 100) &&
        typeof p.resigned === "boolean" &&
        integer(p.score) &&
        Array.isArray(p.rack) &&
        p.rack.length <= 7 &&
        p.rack.every((t) => tile(t)),
    ) &&
    Array.isArray(g.bag) &&
    g.bag.every((t) => tile(t)) &&
    integer(g.version) &&
    g.version >= 0 &&
    integer(g.epoch) &&
    g.epoch >= 0 &&
    integer(g.turn) &&
    g.turn >= 0 &&
    (g.phase === "lobby" || g.turn < g.players.length) &&
    Array.isArray(g.history) &&
    g.history.every(
      (h) =>
        h &&
        text(h.id) &&
        text(h.player, 20) &&
        text(h.kind, 20) &&
        Array.isArray(h.words) &&
        h.words.every((w) => typeof w === "string") &&
        integer(h.score) &&
        integer(h.at),
    ) &&
    Array.isArray(g.draft) &&
    g.draft.length <= 7 &&
    g.draft.every(
      (p) =>
        p &&
        integer(p.index) &&
        p.index >= 0 &&
        p.index < 225 &&
        text(p.tileId) &&
        (p.letter === undefined || /^[A-Z]$/.test(p.letter)),
    ) &&
    text(g.leader) &&
    integer(g.created) &&
    integer(g.updated) &&
    integer(g.turnStarted) &&
    integer(g.scoreless) &&
    g.scoreless >= 0 &&
    Array.isArray(g.receipts) &&
    g.receipts.every((r) => text(r)) &&
    Array.isArray(g.lastCells) &&
    g.lastCells.every((i) => integer(i) && i >= 0 && i < 225)
  ))
    return false;
  const all = [
    ...g.bag,
    ...g.players.flatMap((p) => p.rack),
    ...g.board.filter((t): t is Square => t !== null),
  ];
  return (
    all.length === 100 &&
    new Set(all.map((t) => t.id)).size === 100 &&
    new Set(g.players.map((p) => p.id)).size === g.players.length
  );
}
