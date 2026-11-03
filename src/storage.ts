import { uid, validateSnapshot, type Game } from "./engine";
export type SavedRoom = {
  code: string;
  title: string;
  updated: number;
  phase: Game["phase"];
  players: string[];
};
const PREFIX = "hearth.v1.";
export function deviceId() {
  let id = sessionStorage.getItem(PREFIX + "tab");
  if (!id) {
    id = uid();
    sessionStorage.setItem(PREFIX + "tab", id);
  }
  return id;
}
export function identity() {
  let id = localStorage.getItem(PREFIX + "identity");
  if (!id) {
    id = uid();
    localStorage.setItem(PREFIX + "identity", id);
  }
  return id;
}
export function saveGame(g: Game) {
  localStorage.setItem(PREFIX + "room." + g.code, JSON.stringify(g));
}
export function readGame(code: string): Game | null {
  try {
    const data = JSON.parse(
      localStorage.getItem(PREFIX + "room." + code) || "null",
    );
    return validateSnapshot(data) ? data : null;
  } catch {
    return null;
  }
}
export function savedRooms(): SavedRoom[] {
  const rooms: SavedRoom[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    if (!key.startsWith(PREFIX + "room.")) continue;
    const g = readGame(key.slice((PREFIX + "room.").length));
    if (g)
      rooms.push({
        code: g.code,
        title: g.title,
        updated: g.updated,
        phase: g.phase,
        players: g.players.map((p) => p.name),
      });
  }
  return rooms.sort((a, b) => b.updated - a.updated);
}
export function forgetGame(code: string) {
  localStorage.removeItem(PREFIX + "room." + code);
  localStorage.removeItem(PREFIX + "seat." + code);
}
export function saveSeat(code: string, playerId: string, recovery: string) {
  localStorage.setItem(
    PREFIX + "seat." + code,
    JSON.stringify({ playerId, recovery }),
  );
}
export function readSeat(
  code: string,
): { playerId: string; recovery: string } | null {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + "seat." + code) || "null");
  } catch {
    return null;
  }
}
export function exportGame(g: Game) {
  const blob = new Blob([JSON.stringify(g, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hearth-${g.code}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
