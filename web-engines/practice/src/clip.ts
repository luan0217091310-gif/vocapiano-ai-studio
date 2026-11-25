/**
 * Đoạn nhạc để luyện (`Clip`) và chỉ mục dùng chung cho bộ bám bản nhạc và bộ phát hiện lỗi.
 *
 * Một `Clip` là cả bài hoặc một đoạn cắt theo vạch nhịp (bài sửa `gen.*`). Tick của clip tính từ
 * đầu đoạn; `originTick` và `originMeter` giữ số ô gốc để câu idol nói đúng "Ô {{bar}}".
 */

import { lessonCodeOf } from './load.ts';
import { barOfTick, barStartTick, barTicks, beatTicks, buildTimeMap, meterAt, tickToMs } from './timing.ts';
import type { TimeMap } from './timing.ts';
import type { Hand, MeterChange, ScoreNote, ScorePart, Section, TempoChange, VocaScore } from './types.ts';

export interface Click {
  tick: number;
  strong: boolean;
}

/**
 * Điểm chia câu do app chèn (docs/05 v2.7 §5.4 mục 9): người học lấy hơi và nghỉ trước nốt
 * `beforeNoteId`. Nghỉ ≥ 1 ô nên vừa là điểm lấy hơi (L6) vừa là "nghỉ" của L7.
 */
export interface SplitPoint {
  beforeNoteId: string;
  /** Tick (tính từ đầu đoạn) của nốt sau chỗ chia. */
  tick: number;
  restBars: number;
  restSeconds: number;
  reason: 'L6_seconds' | 'L6_bars' | 'L7_streak' | 'shorter_phrase';
}

export interface Clip {
  scoreId: string;
  scoreVersion: string;
  partId: string;
  instrument: string;
  level: string;
  lesson: string | null;
  keyTonic: string;
  keyMode: string;
  ppq: number;
  /** Tick gốc của đầu đoạn trong bản nhạc. */
  originTick: number;
  originMeter: MeterChange[];
  /** Tempo gốc của đoạn (bpm gốc, tick tính từ đầu đoạn). */
  baseTempo: TempoChange[];
  /** Phần trăm tempo so với bản gốc, luôn trong [40, 100] với clip do `gen.*` tạo. */
  tempoPct: number;
  meter_map: MeterChange[];
  sections: Section[];
  notes: ScoreNote[];
  endTick: number;
  /** Ô gốc đầu và cuối (gồm cả hai). */
  bars: [number, number];
  hiddenHands: Hand[];
  clicks: Click[];
  countInBeats: number;
  repeat: number;
  /** Điểm chia câu app chèn (chỉ bài sáo; rỗng với bản gốc). */
  splits: SplitPoint[];
  ops: string[];
}

export function pickPart(score: VocaScore, partId?: string): ScorePart {
  const part = partId === undefined ? score.parts[0] : score.parts.find((p) => p.id === partId);
  if (part === undefined) throw new Error(`không có part ${partId ?? '(đầu tiên)'} trong ${score.id}`);
  return part;
}

/** Tay của một phần theo tên phần (`…_lh_…`, `…left…` → trái; `…_rh_…`, `…right…` → phải). */
function partHand(id: string): Hand | null {
  if (/(^|[_-])(lh|left)([_-]|$)/i.test(id)) return 'L';
  if (/(^|[_-])(rh|right)([_-]|$)/i.test(id)) return 'R';
  return null;
}

/**
 * Gộp các phần piano của bản nhạc thành một dòng nốt. Nốt thiếu `technique.hand` lấy tay theo khuông
 * (một phần hai khuông) hoặc theo tên phần (mỗi tay một phần).
 */
function mergedPianoPart(score: VocaScore): ScorePart {
  const parts = score.parts.filter((p) => p.instrument === 'piano');
  const ids = new Set<string>();
  const notes: ScoreNote[] = [];
  for (const part of parts) {
    const ph = parts.length > 1 ? partHand(part.id) : null;
    for (const n of part.notes) {
      const id = ids.has(n.id) ? `${part.id}:${n.id}` : n.id;
      ids.add(id);
      if (n.technique !== null && n.technique.hand !== null) {
        notes.push(id === n.id ? n : { ...n, id });
        continue;
      }
      const hand: Hand = ph ?? (n.staff >= 2 ? 'L' : 'R');
      const technique = n.technique === null
        ? { kind: 'piano', hand, finger: null, fingering: null, octave: null, tongue: null, breath_before: false }
        : { ...n.technique, hand };
      notes.push({ ...n, id, technique });
    }
  }
  notes.sort((a, b) => a.tick - b.tick || a.pitch - b.pitch);
  return { ...parts[0], id: parts.map((x) => x.id).join('+'), notes };
}

/**
 * Clip của cả bài (tempo 100%). Không chỉ định `partId` mà bản nhạc có nhiều phần piano thì gộp
 * (hai tay theo khuông hoặc theo phần); nhạc cụ khác lấy phần đầu.
 */
export function clipFromScore(score: VocaScore, partId?: string): Clip {
  const pianoParts = score.parts.filter((p) => p.instrument === 'piano').length;
  const part = partId === undefined && pianoParts > 1 && score.parts[0].instrument === 'piano'
    ? mergedPianoPart(score)
    : pickPart(score, partId);
  const lastNoteEnd = part.notes.reduce((m, n) => Math.max(m, n.tick + n.dur_tick), 0);
  const lastSectionEnd = score.sections.reduce((m, s) => Math.max(m, s.end_tick), 0);
  const rawEnd = Math.max(lastNoteEnd, lastSectionEnd, 1);
  const lastBar = barOfTick(score.meter_map, score.ppq, rawEnd - 1);
  const endTick = barStartTick(score.meter_map, score.ppq, lastBar + 1);
  const key = score.key_map[0];
  return {
    scoreId: score.id,
    scoreVersion: score.version,
    partId: part.id,
    instrument: part.instrument,
    level: part.level,
    lesson: lessonCodeOf(score.id),
    keyTonic: key.tonic,
    keyMode: key.mode,
    ppq: score.ppq,
    originTick: 0,
    originMeter: score.meter_map,
    baseTempo: score.tempo_map,
    tempoPct: 100,
    meter_map: score.meter_map,
    sections: score.sections,
    notes: part.notes,
    endTick,
    bars: [1, lastBar],
    hiddenHands: [],
    clicks: [],
    countInBeats: 0,
    repeat: 1,
    splits: [],
    ops: [],
  };
}

export function clipTimeMap(clip: Clip): TimeMap {
  return buildTimeMap(clip.baseTempo, clip.ppq, clip.tempoPct / 100);
}

/** Bản đồ tempo thực của clip (bpm gốc × tempoPct). */
export function clipTempoMap(clip: Clip): TempoChange[] {
  return clip.baseTempo.map((t) => ({ tick: t.tick, bpm: (t.bpm * clip.tempoPct) / 100 }));
}

export function noteHand(n: ScoreNote, instrument: string): Hand | null {
  if (instrument !== 'piano') return null;
  if (n.technique !== null && n.technique.hand !== null) return n.technique.hand;
  return n.staff >= 2 ? 'L' : 'R';
}

// ---------------------------------------------------------------- Câu nhạc

export interface Phrase {
  index: number;
  startTick: number;
  endTick: number;
  firstBar: number;
  lastBar: number;
  sectionId: string | null;
  sectionName: string;
}

/**
 * Câu nhạc = `Section` của SSOT (như `_sao_phrases` của validator), cắt thành khúc ≤ `maxBars` ô
 * theo vạch nhịp; phần không thuộc Section nào thành câu riêng. Bỏ câu không có nốt.
 */
export function phrasesOf(clip: Clip, maxBars: number): Phrase[] {
  const spans: { start: number; end: number; id: string | null; name: string }[] = [];
  const secs = [...clip.sections].sort((a, b) => a.start_tick - b.start_tick);
  let cursor = 0;
  for (const s of secs) {
    const start = Math.max(s.start_tick, cursor);
    const end = Math.min(s.end_tick, clip.endTick);
    if (start > cursor) spans.push({ start: cursor, end: Math.min(start, clip.endTick), id: null, name: '' });
    if (end > start) spans.push({ start, end, id: s.id, name: s.name });
    cursor = Math.max(cursor, end);
  }
  if (cursor < clip.endTick) spans.push({ start: cursor, end: clip.endTick, id: null, name: '' });

  const out: Phrase[] = [];
  for (const sp of spans) {
    let start = sp.start;
    while (start < sp.end) {
      const localBar = barOfTick(clip.meter_map, clip.ppq, start);
      const cut = barStartTick(clip.meter_map, clip.ppq, localBar + Math.max(1, maxBars));
      const end = Math.min(sp.end, cut > start ? cut : sp.end);
      const hasNote = clip.notes.some((n) => n.tick >= start && n.tick < end);
      if (hasNote) {
        out.push({
          index: out.length,
          startTick: start,
          endTick: end,
          firstBar: barOfTick(clip.originMeter, clip.ppq, clip.originTick + start),
          lastBar: barOfTick(clip.originMeter, clip.ppq, clip.originTick + end - 1),
          sectionId: sp.id,
          sectionName: sp.name,
        });
      }
      start = end;
    }
  }
  return out;
}

export function phraseOfTick(phrases: Phrase[], tick: number): number {
  for (const p of phrases) if (tick >= p.startTick && tick < p.endTick) return p.index;
  return phrases.length === 0 ? 0 : tick < phrases[0].startTick ? 0 : phrases.length - 1;
}

// ---------------------------------------------------------------- Chỉ mục

export interface ExpectedNote {
  idx: number;
  note: ScoreNote;
  hand: Hand | null;
  stream: string;
  onMs: number;
  durMs: number;
  /** Ô gốc (1-based). */
  bar: number;
  phrase: number;
  group: number;
}

export interface OnsetGroup {
  stream: string;
  hand: Hand | null;
  index: number;
  tick: number;
  /** Tick kết thúc muộn nhất của các nốt trong nhóm. */
  endTick: number;
  notes: ExpectedNote[];
  bar: number;
  phrase: number;
  /** Thứ tự onset của dòng trong ô (1-based), dùng cho slot `{{k}}`. */
  kInBar: number;
}

export interface RestSpan {
  stream: string;
  hand: Hand | null;
  startTick: number;
  endTick: number;
  prev: OnsetGroup;
  next: OnsetGroup;
  bar: number;
  phrase: number;
  beats: number;
}

export interface TwoHandOnset {
  tick: number;
  L: OnsetGroup;
  R: OnsetGroup;
  phrase: number;
  bar: number;
}

export interface HandSwitch {
  from: OnsetGroup;
  to: OnsetGroup;
  phrase: number;
}

export interface ClipIndex {
  clip: Clip;
  tm: TimeMap;
  phrases: Phrase[];
  expected: ExpectedNote[];
  streams: Map<string, OnsetGroup[]>;
  rests: RestSpan[];
  twoHand: TwoHandOnset[];
  switches: HandSwitch[];
  /** Phím gốc của thế tay theo `${phrase}|${hand}` (dữ kiện SSOT). */
  anchors: Map<string, number>;
}

export interface IndexOptions {
  phraseMaxBars: number;
  restMinBeats: number;
}

function streamKey(hand: Hand | null, n: ScoreNote): string {
  return hand !== null ? hand : `v${n.voice}`;
}

/** Phím gốc thế 5 ngón phủ mọi cao độ (ưu tiên Đô, Sol, Rê…); không phủ được thì nốt thấp nhất. */
export function handAnchor(pitches: number[]): number {
  if (pitches.length === 0) return 60;
  const lo = Math.min(...pitches);
  const set = new Set(pitches);
  const pref = [0, 7, 2, 5, 9, 4, 11, 10, 3, 8, 1, 6];
  let best: number | null = null;
  let bestRank = Infinity;
  for (let a = lo - 7; a <= lo; a++) {
    const keys = new Set([a, a + 2, a + 4, a + 5, a + 7]);
    let ok = true;
    for (const p of set) if (!keys.has(p)) ok = false;
    if (!ok) continue;
    const rank = pref.indexOf(((a % 12) + 12) % 12);
    if (rank < bestRank || (rank === bestRank && best !== null && a > best)) {
      best = a;
      bestRank = rank;
    }
  }
  return best ?? lo;
}

export function buildClipIndex(clip: Clip, opts: IndexOptions): ClipIndex {
  const tm = clipTimeMap(clip);
  const phrases = phrasesOf(clip, opts.phraseMaxBars);
  const sorted = [...clip.notes].sort((a, b) => a.tick - b.tick || a.pitch - b.pitch);
  const expected: ExpectedNote[] = sorted.map((n, i) => {
    const hand = noteHand(n, clip.instrument);
    const onMs = tickToMs(tm, n.tick);
    return {
      idx: i,
      note: n,
      hand,
      stream: streamKey(hand, n),
      onMs,
      durMs: tickToMs(tm, n.tick + n.dur_tick) - onMs,
      bar: barOfTick(clip.originMeter, clip.ppq, clip.originTick + n.tick),
      phrase: phraseOfTick(phrases, n.tick),
      group: -1,
    };
  });

  // Nhóm onset theo dòng (tay với piano, bè với nhạc cụ khác).
  const streams = new Map<string, OnsetGroup[]>();
  for (const e of expected) {
    let groups = streams.get(e.stream);
    if (groups === undefined) {
      groups = [];
      streams.set(e.stream, groups);
    }
    const last = groups[groups.length - 1];
    if (last !== undefined && last.tick === e.note.tick) {
      last.notes.push(e);
      last.endTick = Math.max(last.endTick, e.note.tick + e.note.dur_tick);
    } else {
      groups.push({
        stream: e.stream,
        hand: e.hand,
        index: groups.length,
        tick: e.note.tick,
        endTick: e.note.tick + e.note.dur_tick,
        notes: [e],
        bar: e.bar,
        phrase: e.phrase,
        kInBar: 1,
      });
    }
    e.group = groups[groups.length - 1].index;
  }
  for (const groups of streams.values()) {
    let prevBar = -1;
    let k = 0;
    for (const g of groups) {
      k = g.bar === prevBar ? k + 1 : 1;
      prevBar = g.bar;
      g.kInBar = k;
    }
  }

  // Dấu lặng trong từng dòng: khoảng không nốt nào của dòng còn vang theo bản nhạc.
  const rests: RestSpan[] = [];
  for (const groups of streams.values()) {
    let runEnd = -1;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (i > 0) {
        const m = meterAt(clip.meter_map, runEnd);
        const minTicks = opts.restMinBeats * beatTicks(m, clip.ppq);
        if (g.tick - runEnd >= minTicks) {
          rests.push({
            stream: g.stream,
            hand: g.hand,
            startTick: runEnd,
            endTick: g.tick,
            prev: groups[i - 1],
            next: g,
            bar: barOfTick(clip.originMeter, clip.ppq, clip.originTick + runEnd),
            phrase: phraseOfTick(phrases, runEnd),
            beats: (g.tick - runEnd) / beatTicks(m, clip.ppq),
          });
        }
      }
      runEnd = Math.max(runEnd, g.endTick);
    }
  }
  rests.sort((a, b) => a.startTick - b.startTick);

  // Hai tay cùng onset; chỗ đổi tay (hai onset một tay liền nhau, khác tay).
  const twoHand: TwoHandOnset[] = [];
  const switches: HandSwitch[] = [];
  const left = streams.get('L') ?? [];
  const right = streams.get('R') ?? [];
  if (left.length > 0 && right.length > 0) {
    const rByTick = new Map(right.map((g) => [g.tick, g]));
    for (const l of left) {
      const r = rByTick.get(l.tick);
      if (r !== undefined) twoHand.push({ tick: l.tick, L: l, R: r, phrase: l.phrase, bar: l.bar });
    }
    const both = new Set(twoHand.map((t) => t.tick));
    const singles = [...left, ...right].filter((g) => !both.has(g.tick)).sort((a, b) => a.tick - b.tick);
    for (let i = 1; i < singles.length; i++) {
      if (singles[i].hand !== singles[i - 1].hand) {
        switches.push({ from: singles[i - 1], to: singles[i], phrase: singles[i].phrase });
      }
    }
  }

  const anchors = new Map<string, number>();
  for (const p of phrases) {
    for (const hand of ['L', 'R'] as const) {
      const pitches = expected.filter((e) => e.phrase === p.index && e.hand === hand).map((e) => e.note.pitch);
      if (pitches.length > 0) anchors.set(`${p.index}|${hand}`, handAnchor(pitches));
    }
  }

  return { clip, tm, phrases, expected, streams, rests, twoHand, switches, anchors };
}

/** Số phách của nốt theo nhịp tại onset (VD nốt trắng chấm dôi ở 3/4 → 3). */
export function noteBeats(clip: Clip, n: ScoreNote): number {
  return n.dur_tick / beatTicks(meterAt(clip.meter_map, n.tick), clip.ppq);
}

export function clipBarTicks(clip: Clip, tick: number): number {
  return barTicks(meterAt(clip.meter_map, tick), clip.ppq);
}
