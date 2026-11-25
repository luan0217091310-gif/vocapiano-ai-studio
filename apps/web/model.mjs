export function decodeMidi(bytes, t) {
  const [status, pitch, value] = bytes;
  const kind = status & 0xf0;
  if (![0x80, 0x90, 0xb0].includes(kind) || bytes.length < 3) return null;
  if (kind === 0x90 && value > 0)
    return { type: "on", t, pitch, velocity: value };
  if (kind === 0x80 || kind === 0x90) return { type: "off", t, pitch };
  if (pitch === 64) return { type: "pedal", t, down: value >= 64 };
  return null;
}
export const noteName = (pitch) =>
  [
    "Đô",
    "Đô♯",
    "Rê",
    "Rê♯",
    "Mi",
    "Fa",
    "Fa♯",
    "Sol",
    "Sol♯",
    "La",
    "La♯",
    "Si",
  ][pitch % 12] +
  (Math.floor(pitch / 12) - 1);
export const HISTORY_KEY = "vocaverse.practice.v1";
export function readHistory(storage) {
  try {
    const rows = JSON.parse(storage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(rows)
      ? rows
          .filter(
            (r) =>
              r &&
              typeof r.lesson === "string" &&
              typeof r.at === "string" &&
              ["demo", "midi", "keyboard"].includes(r.source) &&
              Number.isFinite(r.correct) &&
              Number.isFinite(r.notes),
          )
          .slice(-100)
      : [];
  } catch {
    return [];
  }
}
export function saveAttempt(storage, row) {
  const rows = [...readHistory(storage), row].slice(-100);
  storage.setItem(HISTORY_KEY, JSON.stringify(rows));
  return rows;
}
