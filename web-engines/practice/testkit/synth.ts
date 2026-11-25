/**
 * Sinh lượt chơi MIDI tổng hợp từ SSOT (nhân ngẫu nhiên cố định) và gài từng loại lỗi.
 *
 * Lượt "chơi đúng": onset lệch ngẫu nhiên nhỏ (σ = 8 ms, kẹp ±20 ms, độc lập từng tay), velocity
 * ±4, legato chồng 5–20 ms, staccato giữ 30–45%, nốt thường giữ 94–99%, nốt lặp lại cùng cao độ
 * nhả trước 40–80 ms. Mỗi hàm gài lỗi chỉ đổi đúng phần của lỗi đó và trả "đáp án" (mã, câu).
 */

import { buildClipIndex } from '../src/clip.ts';
import type { Clip, ClipIndex, ExpectedNote, OnsetGroup } from '../src/clip.ts';
import { noteBeats } from '../src/clip.ts';
import type { Thresholds } from '../src/config.ts';
import { runPianoDetectors } from '../src/detectors.ts';
import { ScoreFollower } from '../src/follower.ts';
import { beatMsAt, tickToMs } from '../src/timing.ts';
import type { Detection, MidiEvent } from '../src/types.ts';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function uni(rng: () => number, a: number, b: number): number {
  return a + (b - a) * rng();
}

export interface PerfNote {
  exp: ExpectedNote;
  pitch: number;
  on: number;
  off: number;
  vel: number;
  skip: boolean;
}

export interface Perf {
  idx: ClipIndex;
  startMs: number;
  notes: PerfNote[];
  stretch: number;
}

export interface Truth {
  code: string;
  phrase: number;
}

export const START_MS = 1000;

function groupOf(idx: ClipIndex, e: ExpectedNote): OnsetGroup {
  const g = idx.streams.get(e.stream)?.[e.group];
  if (g === undefined) throw new Error('thiếu nhóm onset');
  return g;
}

function nextGroup(idx: ClipIndex, g: OnsetGroup): OnsetGroup | undefined {
  return idx.streams.get(g.stream)?.[g.index + 1];
}

export interface SynthOptions {
  /** Độ lệch chuẩn onset (ms), mặc định 8. */
  jitterSd?: number;
  /** Hệ số kéo giãn thời gian của người học (1,1 = chậm hơn 10%), chỉ dùng khi chơi tự do. */
  stretch?: number;
}

/** Lượt chơi đúng (theo máy đếm nhịp, tick 0 ở `START_MS`). */
export function cleanPerformance(idx: ClipIndex, seed: number, opts: SynthOptions = {}): Perf {
  const rng = mulberry32(seed);
  const sd = opts.jitterSd ?? 8;
  const stretch = opts.stretch ?? 1;
  const groupJitter = new Map<string, number>();
  const notes: PerfNote[] = idx.expected.map((e) => {
    const key = `${e.stream}|${e.note.tick}`;
    let j = groupJitter.get(key);
    if (j === undefined) {
      j = Math.max(-2.5 * sd, Math.min(2.5 * sd, sd * gauss(rng)));
      groupJitter.set(key, j);
    }
    const on = START_MS + e.onMs * stretch + j + uni(rng, -3, 3);
    const vel = Math.max(1, Math.min(127, e.note.velocity + Math.round(uni(rng, -4, 4))));
    return { exp: e, pitch: e.note.pitch, on, off: on + e.durMs * stretch, vel, skip: false };
  });
  const onOf = (g: OnsetGroup): number => Math.min(...g.notes.map((e) => notes[e.idx].on));
  for (const pn of notes) {
    const e = pn.exp;
    const g = groupOf(idx, e);
    const n = nextGroup(idx, g);
    const arts = e.note.articulations;
    const dur = e.durMs * stretch;
    let off: number;
    if (arts.includes('staccato')) {
      off = pn.on + dur * uni(rng, 0.3, 0.45);
    } else if (n === undefined) {
      off = pn.on + dur * uni(rng, 0.95, 1.0);
    } else {
      const nextOn = onOf(n);
      const contiguous = Math.abs(n.tick - (e.note.tick + e.note.dur_tick)) <= 1;
      const samePitch = n.notes.some((x) => x.note.pitch === e.note.pitch);
      if (contiguous && samePitch) off = nextOn - uni(rng, 40, 80);
      else if (contiguous && arts.includes('legato') && g.notes.length === 1 && n.notes.length === 1 && n.notes[0].note.articulations.includes('legato')) {
        off = nextOn + uni(rng, 5, 20);
      } else if (contiguous) off = Math.min(pn.on + dur * uni(rng, 0.96, 0.995), nextOn + 5);
      else off = pn.on + dur * uni(rng, 0.93, 0.98);
    }
    pn.off = Math.max(pn.on + 30, off);
  }
  return { idx, startMs: START_MS, notes, stretch };
}

export function toEvents(perf: Perf): MidiEvent[] {
  const ev: MidiEvent[] = [];
  for (const n of perf.notes) {
    if (n.skip) continue;
    ev.push({ type: 'on', t: n.on, pitch: n.pitch, velocity: n.vel });
    ev.push({ type: 'off', t: n.off, pitch: n.pitch });
  }
  return ev.sort((a, b) => a.t - b.t || (a.type === 'off' ? -1 : 1));
}

function clonePerf(p: Perf): Perf {
  return { ...p, notes: p.notes.map((n) => ({ ...n })) };
}

function phraseGroups(idx: ClipIndex, phrase: number): OnsetGroup[][] {
  const out: OnsetGroup[][] = [];
  for (const gs of idx.streams.values()) {
    const sel = gs.filter((g) => g.phrase === phrase);
    if (sel.length > 0) out.push(sel);
  }
  return out;
}

function shuffle<T>(xs: T[], rng: () => number): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

function pick<T>(rng: () => number, xs: T[]): T | undefined {
  return xs.length === 0 ? undefined : xs[Math.floor(rng() * xs.length)];
}

// ---------------------------------------------------------------- gài lỗi

/** `clear`: độ lớn lỗi vượt rõ ngưỡng; `subtle`: trải hai phía ngưỡng (đo độ nhạy). */
export type Severity = 'clear' | 'subtle';

export type Injector = (
  perf: Perf,
  th: Thresholds,
  lesson: string | null,
  rng: () => number,
  sev?: Severity,
) => { perf: Perf; truth: Truth } | null;

const wrongNote: Injector = (perf, _th, _lesson, rng) => {
  const idx = perf.idx;
  const firstTick = idx.expected[0]?.note.tick ?? 0;
  const cands = idx.expected.filter((e) => e.note.tick > firstTick);
  const e = pick(rng, cands);
  if (e === undefined) return null;
  const out = clonePerf(perf);
  const pn = out.notes[e.idx];
  if (rng() < 0.3) {
    pn.skip = true;
  } else {
    const g = groupOf(idx, e);
    const taken = new Set(g.notes.map((x) => x.note.pitch));
    const opts = [1, -1, 2, -2].map((d) => e.note.pitch + d).filter((p) => !taken.has(p));
    pn.pitch = opts[Math.floor(rng() * opts.length)] ?? e.note.pitch + 1;
  }
  return { perf: out, truth: { code: 'PNO.ERR.WRONG_NOTE', phrase: e.phrase } };
};

function driftInjector(code: 'PNO.ERR.RUSH' | 'PNO.ERR.DRAG'): Injector {
  return (perf, th, _lesson, rng, sev = 'clear') => {
    const idx = perf.idx;
    const phrases = idx.phrases.filter((p) => new Set(idx.expected.filter((e) => e.phrase === p.index).map((e) => e.note.tick)).size >= th.timing.minOnsets + 1);
    const p = pick(rng, phrases);
    if (p === undefined) return null;
    const out = clonePerf(perf);
    const exps = idx.expected.filter((e) => e.phrase === p.index);
    const t0 = Math.min(...exps.map((e) => e.onMs));
    const span = Math.max(...exps.map((e) => e.onMs)) - t0;
    const total = (sev === 'clear' ? uni(rng, 180, 260) : uni(rng, 80, 160)) * (code === 'PNO.ERR.RUSH' ? -1 : 1);
    for (const e of exps) {
      const shift = (total * (e.onMs - t0)) / span;
      out.notes[e.idx].on += shift;
      out.notes[e.idx].off += shift;
    }
    return { perf: out, truth: { code, phrase: p.index } };
  };
}

const handsAsync: Injector = (perf, _th, _lesson, rng, sev = 'clear') => {
  const idx = perf.idx;
  const byPhrase = new Map<number, number>();
  for (const t of idx.twoHand) byPhrase.set(t.phrase, (byPhrase.get(t.phrase) ?? 0) + 1);
  const p = pick(rng, [...byPhrase.entries()].filter(([, n]) => n >= 3).map(([k]) => k));
  if (p === undefined) return null;
  const out = clonePerf(perf);
  const sign = rng() < 0.5 ? 1 : -1;
  for (const t of idx.twoHand) {
    if (t.phrase !== p) continue;
    const d = sign * (sev === 'clear' ? uni(rng, 90, 150) : uni(rng, 40, 90));
    for (const e of t.L.notes) {
      out.notes[e.idx].on += d;
      out.notes[e.idx].off += d;
    }
  }
  return { perf: out, truth: { code: 'PNO.ERR.HANDS_ASYNC', phrase: p } };
};

const articLegato: Injector = (perf, th, _lesson, rng, sev = 'clear') => {
  const idx = perf.idx;
  const cands: { phrase: number; pairs: [OnsetGroup, OnsetGroup][] }[] = [];
  for (const p of idx.phrases) {
    for (const gs of phraseGroups(idx, p.index)) {
      const pairs: [OnsetGroup, OnsetGroup][] = [];
      for (const g of gs) {
        const n = nextGroup(idx, g);
        if (n === undefined || n.phrase !== p.index || g.notes.length !== 1 || n.notes.length !== 1) continue;
        if (!g.notes[0].note.articulations.includes('legato') || !n.notes[0].note.articulations.includes('legato')) continue;
        if (Math.abs(n.tick - g.endTick) > 1 || g.notes[0].note.pitch === n.notes[0].note.pitch) continue;
        pairs.push([g, n]);
      }
      if (pairs.length >= Math.max(th.artic.minPairs, 4)) cands.push({ phrase: p.index, pairs });
    }
  }
  const c = pick(rng, cands);
  if (c === undefined) return null;
  const out = clonePerf(perf);
  // Khe ở khoảng một nửa số cặp: trượt tiêu chí 80% của legato mà không thành "mổ cò" (≥ 90% cặp).
  const k = Math.max(2, Math.round(c.pairs.length * 0.5));
  const order = shuffle([...c.pairs], rng).slice(0, k);
  for (const [g, n] of order) {
    const a = out.notes[g.notes[0].idx];
    a.off = out.notes[n.notes[0].idx].on - (sev === 'clear' ? uni(rng, 70, 130) : uni(rng, 20, 60));
    a.off = Math.max(a.on + 30, a.off);
  }
  return { perf: out, truth: { code: 'PNO.ERR.ARTIC', phrase: c.phrase } };
};

const articStaccato: Injector = (perf, th, _lesson, rng, sev = 'clear') => {
  const idx = perf.idx;
  const byPhrase = new Map<number, ExpectedNote[]>();
  for (const e of idx.expected) {
    if (!e.note.articulations.includes('staccato')) continue;
    byPhrase.set(e.phrase, [...(byPhrase.get(e.phrase) ?? []), e]);
  }
  const c = pick(rng, [...byPhrase.entries()].filter(([, xs]) => xs.length >= th.artic.minStaccato + 1));
  if (c === undefined) return null;
  const out = clonePerf(perf);
  for (const e of c[1]) {
    const pn = out.notes[e.idx];
    const n = nextGroup(idx, groupOf(idx, e));
    const cap = n === undefined ? Infinity : Math.min(...n.notes.map((x) => out.notes[x.idx].on)) - 10;
    pn.off = Math.min(pn.on + e.durMs * perf.stretch * (sev === 'clear' ? uni(rng, 0.75, 0.95) : uni(rng, 0.4, 0.65)), cap);
  }
  return { perf: out, truth: { code: 'PNO.ERR.ARTIC', phrase: c[0] } };
};

const dynFlat: Injector = (perf, th, _lesson, rng, sev = 'clear') => {
  const idx = perf.idx;
  const ps = idx.expected.filter((e) => e.note.velocity <= th.dynFlat.pMaxVelocity);
  const fs = idx.expected.filter((e) => e.note.velocity >= th.dynFlat.fMinVelocity);
  if (ps.length < th.dynFlat.minNotesEach || fs.length < th.dynFlat.minNotesEach) return null;
  const out = clonePerf(perf);
  const pLevel = ps[0].note.velocity;
  const lift = sev === 'clear' ? 0 : uni(rng, 10, 30);
  for (const e of fs) out.notes[e.idx].vel = Math.max(1, Math.round(pLevel + lift + uni(rng, -4, 4)));
  const later = ps[0].onMs > fs[0].onMs ? ps[0] : fs[0];
  return { perf: out, truth: { code: 'PNO.ERR.DYN_FLAT', phrase: later.phrase } };
};

const pecking: Injector = (perf, th, lesson, rng, sev = 'clear') => {
  if (lesson === null || !th.pecking.lessons.includes(lesson)) return null;
  const idx = perf.idx;
  const cands: { phrase: number; pairs: [OnsetGroup, OnsetGroup][] }[] = [];
  for (const p of idx.phrases) {
    for (const gs of phraseGroups(idx, p.index)) {
      const pairs: [OnsetGroup, OnsetGroup][] = [];
      for (const g of gs) {
        const n = nextGroup(idx, g);
        if (n === undefined || n.phrase !== p.index || g.notes.length !== 1 || n.notes.length !== 1) continue;
        if (Math.abs(n.tick - g.endTick) > 1 || g.notes[0].note.pitch === n.notes[0].note.pitch) continue;
        pairs.push([g, n]);
      }
      if (pairs.length >= th.pecking.minPairs + 1) cands.push({ phrase: p.index, pairs });
    }
  }
  const c = pick(rng, cands);
  if (c === undefined) return null;
  const out = clonePerf(perf);
  for (const [g, n] of c.pairs) {
    const a = out.notes[g.notes[0].idx];
    a.off = Math.max(a.on + 30, out.notes[n.notes[0].idx].on - (sev === 'clear' ? uni(rng, 110, 180) : uni(rng, 40, 100)));
  }
  return { perf: out, truth: { code: 'PNO.ERR.PECKING', phrase: c.phrase } };
};

const restShort: Injector = (perf, _th, _lesson, rng, sev = 'clear') => {
  const idx = perf.idx;
  const r = pick(rng, idx.rests.filter((x) => x.next.phrase === x.phrase));
  if (r === undefined) return null;
  const out = clonePerf(perf);
  const restMs = (tickToMs(idx.tm, r.endTick) - tickToMs(idx.tm, r.startTick)) * perf.stretch;
  const beatMs = beatMsAt(idx.tm, idx.clip.meter_map, r.startTick) * perf.stretch;
  if (restMs <= 1.2 * beatMs && rng() < 0.5) {
    const d = (sev === 'clear' ? uni(rng, 0.32, 0.38) : uni(rng, 0.15, 0.35)) * restMs;
    for (const e of r.next.notes) {
      out.notes[e.idx].on -= d;
      out.notes[e.idx].off -= d;
    }
  } else {
    const restStart = out.notes[r.prev.notes[0].idx].on + (tickToMs(idx.tm, r.startTick) - r.prev.notes[0].onMs) * perf.stretch;
    for (const e of r.prev.notes) {
      const pn = out.notes[e.idx];
      if (pn.exp.note.tick + pn.exp.note.dur_tick === r.startTick || r.prev.notes.length === 1) {
        pn.off = restStart + (sev === 'clear' ? uni(rng, 0.5, 0.8) : uni(rng, 0.15, 0.4)) * restMs;
      }
    }
  }
  return { perf: out, truth: { code: 'PNO.ERR.REST_SHORT', phrase: r.phrase } };
};

const shortNote: Injector = (perf, th, _lesson, rng, sev = 'clear') => {
  const idx = perf.idx;
  const cands = idx.expected.filter((e) => {
    if (noteBeats(idx.clip, e.note) < th.shortNote.longNoteBeats || e.note.articulations.includes('staccato')) return false;
    return nextGroup(idx, groupOf(idx, e)) !== undefined;
  });
  const e = pick(rng, cands);
  if (e === undefined) return null;
  const out = clonePerf(perf);
  const pn = out.notes[e.idx];
  pn.off = pn.on + e.durMs * perf.stretch * (sev === 'clear' ? uni(rng, 0.55, 0.75) : uni(rng, 0.8, 0.95));
  return { perf: out, truth: { code: 'PNO.ERR.SHORT_NOTE', phrase: e.phrase } };
};

export const INJECTORS: [string, Injector][] = [
  ['PNO.ERR.WRONG_NOTE', wrongNote],
  ['PNO.ERR.RUSH', driftInjector('PNO.ERR.RUSH')],
  ['PNO.ERR.DRAG', driftInjector('PNO.ERR.DRAG')],
  ['PNO.ERR.HANDS_ASYNC', handsAsync],
  ['PNO.ERR.ARTIC', (p, th, l, r, sev) => (r() < 0.5 ? articLegato(p, th, l, r, sev) ?? articStaccato(p, th, l, r, sev) : articStaccato(p, th, l, r, sev) ?? articLegato(p, th, l, r, sev))],
  ['PNO.ERR.DYN_FLAT', dynFlat],
  ['PNO.ERR.PECKING', pecking],
  ['PNO.ERR.REST_SHORT', restShort],
  ['PNO.ERR.SHORT_NOTE', shortNote],
];

// ---------------------------------------------------------------- phân tích một lượt (chế độ lô)

export interface Analysis {
  follower: ScoreFollower;
  detections: Detection[];
  quality: ('ok' | 'unclear' | 'not_played')[];
}

/** Chạy bộ bám + 9 bộ phát hiện trên cả lượt (sau khi chơi xong), như `TutorSession.endAttempt`. */
export function analyze(idx: ClipIndex, events: MidiEvent[], th: Thresholds, lesson: string | null, startMs: number | null = START_MS): Analysis {
  const beatMs = beatMsAt(idx.tm, idx.clip.meter_map, 0);
  const follower = new ScoreFollower(idx.expected, beatMs, startMs === null ? 'free' : 'metronome', startMs, th.follower);
  for (const ev of events) follower.push(ev);
  follower.finish();
  const quality = idx.phrases.map((p) => {
    const exps = idx.expected.filter((e) => e.phrase === p.index);
    const matched = exps.filter((e) => follower.matches[e.idx]?.status !== 'missed').length;
    if (matched === 0) return 'not_played' as const;
    return matched / exps.length < th.follower.minPhraseCoverage ? ('unclear' as const) : ('ok' as const);
  });
  const ok = idx.phrases.filter((_, i) => quality[i] === 'ok').map((p) => p.index);
  const detections = idx.clip.instrument === 'piano' ? runPianoDetectors({ idx, follower, th, lesson, phrases: ok }) : [];
  return { follower, detections, quality };
}

export function indexOf(clip: Clip, th: Thresholds): ClipIndex {
  return buildClipIndex(clip, th.index);
}
