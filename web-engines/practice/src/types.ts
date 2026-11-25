/**
 * Kiểu dữ liệu dùng chung của lõi gia sư trên thiết bị (T16).
 *
 * Chỉ dùng cú pháp TypeScript bỏ kiểu được (Node 24 chạy trực tiếp): không `enum`,
 * không `namespace`, không tham số thuộc tính ở constructor, không decorator.
 * Tập giá trị đóng viết bằng mảng `as const` + kiểu hợp.
 */

export type Hand = 'L' | 'R';

// ---------------------------------------------------------------- VocaScore (phần cần dùng)

export interface TempoChange {
  tick: number;
  bpm: number;
}

export interface MeterChange {
  tick: number;
  numerator: number;
  denominator: number;
}

export interface KeyChange {
  tick: number;
  tonic: string;
  mode: string;
}

export interface Section {
  id: string;
  name: string;
  start_tick: number;
  end_tick: number;
}

export interface Ornament {
  type: string;
  target_pitch: number | null;
  delta_cents: number | null;
}

/** Chú thích kỹ thuật của nốt: piano có `hand`, `finger`; sáo có `fingering`, `tongue`... */
export interface NoteTechnique {
  kind: string;
  hand: Hand | null;
  finger: number | null;
  fingering: string | null;
  octave: number | null;
  tongue: boolean | null;
  breath_before: boolean;
}

/**
 * Nút kỹ năng của nốt. Chấp nhận cả hai dạng trong giai đoạn chuyển tiếp T5b:
 * tham chiếu thẻ `kb://<id>@<n>` và mã cũ kiểu `PNO.CHORD.I_V7_REDUCED`.
 */
export type SkillNodeRef =
  | { kind: 'kb'; raw: string; id: string; version: number }
  | { kind: 'code'; raw: string; code: string };

export interface ScoreNote {
  id: string;
  tick: number;
  dur_tick: number;
  pitch: number;
  velocity: number;
  voice: number;
  staff: number;
  tie_next: boolean;
  articulations: string[];
  ornaments: Ornament[];
  technique: NoteTechnique | null;
  skill_node: SkillNodeRef | null;
}

export interface PartConfig {
  range: [number, number] | null;
  giong: string | null;
  holes: number | null;
}

export interface ScorePart {
  id: string;
  instrument: string;
  level: string;
  role: string;
  config: PartConfig;
  notes: ScoreNote[];
}

export interface VocaScore {
  schema: string;
  id: string;
  version: string;
  title: string;
  ppq: number;
  tempo_map: TempoChange[];
  meter_map: MeterChange[];
  key_map: KeyChange[];
  sections: Section[];
  parts: ScorePart[];
  license_class: string | null;
}

/** Mục tiêu luyện tập trên máy (`LessonPackage v2` → `practice_targets[]`, docs/02 §6). */
export interface PracticeTarget {
  id: string;
  tick: number;
  dur_tick: number;
  target_pitch: number | null;
  chord_symbol: string | null;
  onset_tolerance_ms: number;
  pitch_tolerance_cents: number;
}

// ---------------------------------------------------------------- Sự kiện người học

/** Sự kiện MIDI đã chuẩn hoá; `t` là mili giây trên đồng hồ của app. Chỉ giữ trong bộ nhớ. */
export type MidiEvent =
  | { type: 'on'; t: number; pitch: number; velocity: number }
  | { type: 'off'; t: number; pitch: number }
  | { type: 'pedal'; t: number; down: boolean };

// ---------------------------------------------------------------- Mã lỗi, slot, phát hiện

/** 9 mã lỗi piano bắt qua MIDI (docs/05 §5.5; docs/02a v1.11 §6). */
export const PIANO_MIDI_ERROR_CODES = [
  'PNO.ERR.WRONG_NOTE',
  'PNO.ERR.RUSH',
  'PNO.ERR.DRAG',
  'PNO.ERR.HANDS_ASYNC',
  'PNO.ERR.ARTIC',
  'PNO.ERR.DYN_FLAT',
  'PNO.ERR.PECKING',
  'PNO.ERR.REST_SHORT',
  'PNO.ERR.SHORT_NOTE',
] as const;
export type PianoMidiErrorCode = (typeof PIANO_MIDI_ERROR_CODES)[number];

/** Slot hợp lệ trong câu idol (docs/05 §5.5, knowledge/kb/README §3.4). */
export const SLOT_NAMES = ['bar', 'k', 'expected_note', 'direction', 'anchor_note', 'beats'] as const;
export type SlotName = (typeof SLOT_NAMES)[number];

/** Nguồn của giá trị slot (luật 7, docs/05 §1): dữ kiện SSOT hoặc số đo trực tiếp. */
export type SlotSource = 'ssot' | 'measurement';

export interface SlotValue {
  value: string;
  source: SlotSource;
  /** Truy vết: VD `score:pn03_ode_to_joy#n05.pitch` hoặc `measure:played-expected=+1`. */
  ref: string;
}

export type SlotFacts = { [K in SlotName]?: SlotValue };

/** Nhóm ưu tiên của lỗi (docs/05 §5.4 mục 1). */
export type Aspect = 'safety' | 'flow' | 'pitch' | 'rhythm' | 'other';

export interface Detection {
  code: string;
  /** Chỉ số câu nhạc trong đoạn đang chơi (0-based). */
  phrase: number;
  /** Ô gốc trong bản nhạc (1-based) để định vị. */
  bar: number;
  hand: Hand | null;
  noteIds: string[];
  /** Độ tin cậy 0..1 của phép đo. */
  confidence: number;
  aspect: Aspect;
  /** `false` = chỉ gợi ý, không trừ điểm (VD `PNO.ERR.PECKING`, docs/05 §5.4 mục 6). */
  scoring: boolean;
  /** Ngữ cảnh để chọn câu, VD `lh_late`, `legato`, `uniform_shift`. */
  tags: string[];
  measures: Record<string, number>;
  slots: SlotFacts;
}

export type PracticeMode = 'practice' | 'retention';
export type ClockMode = 'metronome' | 'free';
