/**
 * Đổi tick ↔ mili giây theo bản đồ tempo từng đoạn, và tick → số ô theo bản đồ nhịp.
 * Ngữ nghĩa khớp `engines/score/src/vocaverse_score/io/timing.py` (tempo hằng từng đoạn; ô 1-based).
 */

import type { MeterChange, TempoChange } from './types.ts';

interface TempoSeg {
  tick: number;
  ms: number;
  msPerTick: number;
}

export interface TimeMap {
  ppq: number;
  segs: TempoSeg[];
}

/** Dựng bản đồ thời gian; `scale` nhân vào bpm (VD 0.6 = 60% tempo). */
export function buildTimeMap(tempoMap: TempoChange[], ppq: number, scale = 1): TimeMap {
  if (tempoMap.length === 0) throw new Error('tempo_map rỗng');
  if (!(scale > 0)) throw new Error('scale phải > 0');
  const ordered = [...tempoMap].sort((a, b) => a.tick - b.tick);
  if (ordered[0].tick !== 0) ordered.unshift({ tick: 0, bpm: ordered[0].bpm });
  const segs: TempoSeg[] = [];
  let ms = 0;
  for (let i = 0; i < ordered.length; i++) {
    const cur = ordered[i];
    const msPerTick = 60000 / (cur.bpm * scale * ppq);
    if (i > 0) {
      const prev = segs[i - 1];
      ms = prev.ms + (cur.tick - prev.tick) * prev.msPerTick;
    }
    segs.push({ tick: cur.tick, ms, msPerTick });
  }
  return { ppq, segs };
}

function segIndexByTick(tm: TimeMap, tick: number): number {
  const s = tm.segs;
  let lo = 0;
  let hi = s.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s[mid].tick <= tick) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function tickToMs(tm: TimeMap, tick: number): number {
  const seg = tm.segs[segIndexByTick(tm, tick)];
  return seg.ms + (tick - seg.tick) * seg.msPerTick;
}

export function msToTick(tm: TimeMap, ms: number): number {
  const s = tm.segs;
  let i = s.length - 1;
  while (i > 0 && s[i].ms > ms) i--;
  return s[i].tick + (ms - s[i].ms) / s[i].msPerTick;
}

/** Mili giây của một phách (theo mẫu số nhịp) tại `tick`. */
export function beatMsAt(tm: TimeMap, meter: MeterChange[], tick: number): number {
  const m = meterAt(meter, tick);
  const seg = tm.segs[segIndexByTick(tm, tick)];
  return beatTicks(m, tm.ppq) * seg.msPerTick;
}

export function meterAt(meter: MeterChange[], tick: number): MeterChange {
  let cur = meter[0];
  for (const m of meter) {
    if (m.tick <= tick) cur = m;
    else break;
  }
  return cur;
}

export function beatTicks(m: MeterChange, ppq: number): number {
  return Math.round(ppq * (4 / m.denominator));
}

export function barTicks(m: MeterChange, ppq: number): number {
  return Math.max(1, Math.round(m.numerator * (4 / m.denominator) * ppq));
}

/** Số ô (1-based) chứa `tick`, giống `tick_to_bar` của Python. */
export function barOfTick(meter: MeterChange[], ppq: number, tick: number): number {
  if (tick < 0) return 1;
  const ordered = [...meter].sort((a, b) => a.tick - b.tick);
  if (ordered[0].tick !== 0) ordered.unshift({ ...ordered[0], tick: 0 });
  let bar = 1;
  for (let i = 0; i < ordered.length; i++) {
    const cur = ordered[i];
    const len = barTicks(cur, ppq);
    if (i + 1 < ordered.length && tick >= ordered[i + 1].tick) {
      const span = ordered[i + 1].tick - cur.tick;
      bar += Math.max(1, Math.ceil(span / len));
    } else {
      return bar + Math.floor(Math.max(0, tick - cur.tick) / len);
    }
  }
  return bar;
}

/** Tick bắt đầu của ô `bar` (1-based). */
export function barStartTick(meter: MeterChange[], ppq: number, bar: number): number {
  const ordered = [...meter].sort((a, b) => a.tick - b.tick);
  if (ordered[0].tick !== 0) ordered.unshift({ ...ordered[0], tick: 0 });
  let first = 1;
  for (let i = 0; i < ordered.length; i++) {
    const cur = ordered[i];
    const len = barTicks(cur, ppq);
    const nextTick = i + 1 < ordered.length ? ordered[i + 1].tick : Infinity;
    const barsHere = nextTick === Infinity ? Infinity : Math.max(1, Math.ceil((nextTick - cur.tick) / len));
    if (bar < first + barsHere) return cur.tick + (bar - first) * len;
    first += barsHere;
  }
  return 0;
}
