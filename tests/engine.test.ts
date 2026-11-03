import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  addPlayer,
  makeBag,
  startGame,
  evaluate,
  play,
  exchange,
  pass,
  finish,
  resign,
  materialize,
  PREMIUM,
  VALUES,
  type Game,
  type Tile,
  type Placement,
} from "../src/engine.ts";
function tile(letter: string, id = letter): Tile {
  return { letter, id, value: VALUES[letter] };
}
function game(letters = "CAT"): Game {
  const g = createGame("GARDEN", "host");
  addPlayer(g, "a", "Alice", "KEYA");
  addPlayer(g, "b", "Bob", "KEYB");
  g.phase = "playing";
  g.players[0].rack = [...letters].map((l, i) => tile(l, l + i));
  g.players[1].rack = [tile("E", "other")];
  g.bag = [];
  return g;
}
function place(g: Game, word: string, start = 111, step = 1): Placement[] {
  const ids = new Set<string>();
  return [...word].map((letter, i) => {
    const t = g.players[g.turn].rack.find(
      (t) => !ids.has(t.id) && (t.letter === letter || t.letter === "?"),
    )!;
    ids.add(t.id);
    return {
      index: start + i * step,
      tileId: t.id,
      ...(t.letter === "?" ? { letter } : {}),
    };
  });
}
test("100 tiles, exactly 2 blanks and 98 letter tiles", () => {
  const bag = makeBag();
  assert.equal(bag.length, 100);
  assert.equal(bag.filter((t) => t.letter === "?").length, 2);
  assert.equal(new Set(bag.map((t) => t.id)).size, 100);
  assert.equal(bag.filter((t) => t.letter === "E").length, 12);
});
test("classic symmetric board premiums", () => {
  assert.equal(Object.keys(PREMIUM).length, 61);
  assert.equal(PREMIUM[112], "DW");
  assert.equal(Object.values(PREMIUM).filter((x) => x === "TW").length, 8);
  for (const [i, p] of Object.entries(PREMIUM))
    assert.equal(PREMIUM[224 - Number(i)], p);
});
test("deal seven, preserve all tiles, need two players", () => {
  const g = createGame("GARDEN", "host");
  assert.throws(() => startGame(g));
  addPlayer(g, "a", "Alice", "a");
  addPlayer(g, "b", "Bob", "b");
  startGame(g);
  assert.equal(g.bag.length, 86);
  assert.equal(g.players[0].rack.length, 7);
  assert.equal(g.players[1].rack.length, 7);
});
test("opening CAT covers center, double word = 10", () => {
  const g = game();
  const r = evaluate(g, "a", place(g, "CAT"), (w) => w === "CAT");
  assert.equal(r.score, 10);
  assert.deepEqual(r.words, ["CAT"]);
});
test("opening needs center and minimum two letters", () => {
  const g = game();
  assert.throws(() => evaluate(g, "a", place(g, "CAT", 0)), /center/);
  assert.throws(
    () => evaluate(g, "a", [{ tileId: "C0", index: 112 }]),
    /two letters/,
  );
});
test("reject bent words, gaps, duplicate tiles and invalid positions", () => {
  const g = game();
  assert.throws(
    () =>
      evaluate(g, "a", [
        { index: 111, tileId: "C0" },
        { index: 112, tileId: "A1" },
        { index: 127, tileId: "T2" },
      ]),
    /row/,
  );
  assert.throws(
    () =>
      evaluate(g, "a", [
        { index: 111, tileId: "C0" },
        { index: 113, tileId: "A1" },
      ]),
    /gaps/,
  );
  assert.throws(
    () =>
      materialize(g, "a", [
        { index: 111, tileId: "C0" },
        { index: 112, tileId: "C0" },
      ]),
    /once/,
  );
  assert.throws(
    () => materialize(g, "a", [{ index: 225, tileId: "C0" }]),
    /empty/,
  );
  assert.throws(
    () => materialize(g, "a", [{ index: 112, tileId: "fake" }]),
    /once/,
  );
});
test("reject invalid words including every cross word", () => {
  const g = game();
  assert.throws(() => evaluate(g, "a", place(g, "CAT"), () => false), /CAT/);
});
test("blank letter assignment, zero points, keeps blank on board", () => {
  const g = game("C?T");
  const p = place(g, "CAT");
  const r = evaluate(g, "a", p);
  assert.equal(r.score, 8);
  assert.equal(r.board[112]?.value, 0);
  assert.equal(r.board[112]?.blank, true);
  assert.equal(r.board[112]?.letter, "A");
  assert.throws(
    () =>
      evaluate(
        g,
        "a",
        p.map((q) => ({ ...q, letter: undefined })),
      ),
    /blank/,
  );
});
test("seven tiles adds 50 after word multiplier", () => {
  const g = game("RETINAS");
  const r = evaluate(g, "a", place(g, "RETINAS", 108));
  assert.equal(r.bingo, true);
  assert.equal(r.score, 66);
});
test("existing premium does not count a second time", () => {
  const g = game("S");
  g.board[111] = { ...tile("C"), blank: false };
  g.board[112] = { ...tile("A"), blank: false };
  g.board[113] = { ...tile("T"), blank: false };
  const r = evaluate(g, "a", [{ index: 114, tileId: "S0" }]);
  assert.equal(r.score, 6);
});
test("score main and cross words separately, including shared letter premium", () => {
  const g = game("AT");
  g.board[81] = { ...tile("C"), blank: false };
  g.board[82] = { ...tile("A", "oldA"), blank: false };
  const r = evaluate(g, "a", [
    { index: 96, tileId: "A0" },
    { index: 97, tileId: "T1" },
  ]);
  assert.deepEqual(new Set(r.words), new Set(["AT", "CA", "AT"]));
  assert.equal(r.score, 10);
});
test("isolated words are rejected and row boundaries do not wrap", () => {
  const g = game("AT");
  g.board[0] = { ...tile("C"), blank: false };
  assert.throws(() => evaluate(g, "a", place(g, "AT", 111)), /Connect/);
  g.board[0] = null;
  g.board[14] = { ...tile("C"), blank: false };
  assert.throws(() => evaluate(g, "a", place(g, "AT", 15)), /Connect/);
});
test("exchange only own tiles, minimum bag count, conserve tiles", () => {
  const g = game("CAT");
  g.bag = makeBag()
    .slice(0, 10)
    .map((t, i) => ({ ...t, id: "bag" + i }));
  const before = [...g.bag, ...g.players[0].rack].map((t) => t.id).sort();
  exchange(g, "a", ["C0", "A1"]);
  assert.equal(g.players[0].rack.length, 3);
  assert.equal(g.bag.length, 10);
  assert.deepEqual(
    [...g.bag, ...g.players[0].rack].map((t) => t.id).sort(),
    before,
  );
  assert.equal(g.turn, 1);
  const h = game();
  assert.throws(() => exchange(h, "a", ["C0"]), /seven/);
});
test("six scoreless turns end game and deduct racks exactly once", () => {
  const g = game();
  for (let n = 0; n < 6; n++) pass(g, g.players[g.turn].id);
  assert.equal(g.phase, "finished");
  assert.equal(g.players[0].score, -5);
  assert.equal(g.players[1].score, -1);
  finish(g, "again");
  assert.equal(g.players[0].score, -5);
});
test("empty bag, play last tile, settle remaining racks", () => {
  const g = game();
  play(g, "a", place(g, "CAT"), () => true);
  assert.equal(g.phase, "finished");
  assert.equal(g.players[0].score, 11);
  assert.equal(g.players[1].score, -1);
});
test("play refills rack, consumes tiles once, turn authority enforced", () => {
  const g = game("CATS");
  g.bag = [
    tile("E", "draw1"),
    tile("O", "draw2"),
    tile("R", "draw3"),
    tile("N", "draw4"),
    tile("A", "draw5"),
    tile("T", "draw6"),
  ];
  assert.throws(() => play(g, "b", [], () => true), /turn/);
  play(g, "a", place(g, "CAT"), () => true);
  assert.equal(g.players[0].rack.length, 7);
  assert.equal(g.bag.length, 0);
  assert.equal(g.turn, 1);
  assert.equal(g.board.filter(Boolean).length, 3);
  assert.equal(g.draft.length, 0);
});
test("unique names, four seats, no new seats after starting", () => {
  const g = game();
  assert.throws(() => addPlayer(g, "c", "Charlie", "c"), /started/);
  g.phase = "lobby";
  assert.throws(() => addPlayer(g, "c", "alice", "c"), /already/);
  addPlayer(g, "c", "C", "c");
  addPlayer(g, "d", "D", "d");
  assert.throws(() => addPlayer(g, "e", "E", "e"), /four/);
});
test("resignation applies rack penalty once and finishes when one remains", () => {
  const g = game();
  resign(g, "a");
  assert.equal(g.phase, "finished");
  assert.equal(g.players[0].score, -5);
  assert.equal(g.players[1].score, -1);
  assert.throws(() => resign(g, "a"));
});

test("saved snapshots survive serialization and reject corrupt backups", async () => {
  const { validateSnapshot } = await import("../src/engine.ts");
  const g = createGame("GARDEN", "host");
  assert.equal(validateSnapshot(JSON.parse(JSON.stringify(g))), true);
  assert.equal(validateSnapshot({ ...g, bag: [] }), false);
  assert.equal(validateSnapshot({ ...g, phase: "broken" }), false);
  assert.equal(validateSnapshot({ ...g, players: [{}] }), false);
  assert.equal(
    validateSnapshot({ ...g, board: Array(225).fill("bad") }),
    false,
  );
  assert.equal(validateSnapshot(null), false);
});

test("older Safari can create secure game and device identifiers without randomUUID", async () => {
  const { uid, copyGame } = await import("../src/engine.ts");
  const descriptor = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
  Object.defineProperty(crypto, "randomUUID", {
    value: undefined,
    configurable: true,
  });
  try {
    const ids = Array.from({ length: 50 }, () => uid());
    assert.equal(new Set(ids).size, 50);
    for (const id of ids)
      assert.match(
        id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    const game = createGame("GARDEN", "host");
    const copy = copyGame(game);
    copy.bag.pop();
    assert.equal(game.bag.length, 100);
    assert.equal(copy.bag.length, 99);
  } finally {
    if (descriptor) Object.defineProperty(crypto, "randomUUID", descriptor);
    else delete (crypto as unknown as { randomUUID?: unknown }).randomUUID;
  }
});
