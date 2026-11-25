/**
 * Tên nốt tiếng Việt để điền slot `{{expected_note}}`, `{{anchor_note}}`.
 * Giá trị luôn suy từ cao độ MIDI của SSOT (luật 2, luật 7 ở docs/05 §1), không đoán.
 */

const SHARP_NAMES = ['Đô', 'Đô thăng', 'Rê', 'Rê thăng', 'Mi', 'Fa', 'Fa thăng', 'Sol', 'Sol thăng', 'La', 'La thăng', 'Si'];
const FLAT_NAMES = ['Đô', 'Rê giáng', 'Rê', 'Mi giáng', 'Mi', 'Fa', 'Sol giáng', 'Sol', 'La giáng', 'La', 'Si giáng', 'Si'];

/** Giọng dùng dấu giáng (trưởng: F, B♭…; thứ: D, G, C…). */
const FLAT_MAJOR = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']);
const FLAT_MINOR = new Set(['D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab']);

export const MIDDLE_C = 60;

export function usesFlats(tonic: string, mode: string): boolean {
  return mode.toLowerCase().startsWith('min') ? FLAT_MINOR.has(tonic) : FLAT_MAJOR.has(tonic);
}

/**
 * Tên đọc của nốt: `Mi`, `Fa thăng`, `Si giáng`; MIDI 60 là `Đô giữa`.
 * Không ghi số quãng tám (đọc tự nhiên); hướng quãng tám đi qua slot `{{direction}}`.
 */
export function spokenNoteName(pitch: number, tonic = 'C', mode = 'major'): string {
  if (pitch === MIDDLE_C) return 'Đô giữa';
  const pc = ((pitch % 12) + 12) % 12;
  return usesFlats(tonic, mode) ? FLAT_NAMES[pc] : SHARP_NAMES[pc];
}

export function isBlackKey(pitch: number): boolean {
  return [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);
}

/** Tên kèm quãng tám khoa học, cho ghi chú, nhật ký (VD `Fa thăng 4`); không dùng trong câu idol. */
export function noteLabel(pitch: number, tonic = 'C', mode = 'major'): string {
  const pc = ((pitch % 12) + 12) % 12;
  const base = usesFlats(tonic, mode) ? FLAT_NAMES[pc] : SHARP_NAMES[pc];
  return `${base} ${Math.floor(pitch / 12) - 1}`;
}
