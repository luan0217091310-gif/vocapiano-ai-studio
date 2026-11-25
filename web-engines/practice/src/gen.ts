/**
 * Bài sửa `gen.*` chạy trên máy (docs/05 §5.6, nhóm A) và hàm kiểm lại luật cấp trên đoạn đã biến đổi.
 *
 * Bất biến: chỉ cắt theo vạch nhịp, lặp, co giãn thời gian đều, ẩn một tay, thêm tiếng đếm;
 * KHÔNG đổi nốt, KHÔNG đổi ngón, KHÔNG đổi trường độ (tick); tempo không bao giờ > 100% bản gốc.
 *
 * Bài sáo (docs/05 v2.7 §5.4 mục 9): `gen.slow` co giãn tempo rồi CHIA CÂU (điểm chia có nghỉ ≥ 1 ô)
 * để mỗi hơi ≤ `exhale_max_s` (L6) và sau tối đa `long_note_streak` nốt ngân dài (≥ `long_note_min_s`)
 * có nghỉ (L7). Dưới mức chậm tối thiểu một nốt đơn đã dài quá `exhale_max_s` nên không chia được:
 * `gen.slow` kẹp lên mức tối thiểu hoặc từ chối, kèm lý do. Ngưỡng hơi đọc từ
 * `knowledge/safety/safety_cards.yaml` (qua `data/safety_params.json`), không ghi cứng.
 * Lỗi `SAO.ERR.SHORT_NOTE` dùng `genSplit`: chỉ chia câu ngắn hơn, không hạ tempo.
 */

import type { Clip, SplitPoint } from './clip.ts';
import { clipTempoMap, clipTimeMap, noteHand } from './clip.ts';
import type { Thresholds } from './config.ts';
import { barOfTick, barStartTick, barTicks, beatTicks, meterAt, tickToMs } from './timing.ts';
import type { Hand, MeterChange, ScoreNote, Section, TempoChange } from './types.ts';

// ---------------------------------------------------------------- cắt đoạn

function sliceTempo(tempo: TempoChange[], start: number, end: number): TempoChange[] {
  let cur = tempo[0];
  const out: TempoChange[] = [];
  for (const t of tempo) {
    if (t.tick <= start) cur = t;
    else if (t.tick < end) out.push({ tick: t.tick - start, bpm: t.bpm });
  }
  return [{ tick: 0, bpm: cur.bpm }, ...out];
}

function sliceMeter(meter: MeterChange[], start: number, end: number): MeterChange[] {
  let cur = meter[0];
  const out: MeterChange[] = [];
  for (const m of meter) {
    if (m.tick <= start) cur = m;
    else if (m.tick < end) out.push({ ...m, tick: m.tick - start });
  }
  return [{ ...cur, tick: 0 }, ...out];
}

function sliceSections(sections: Section[], start: number, end: number): Section[] {
  return sections
    .filter((s) => s.end_tick > start && s.start_tick < end)
    .map((s) => ({ ...s, start_tick: Math.max(0, s.start_tick - start), end_tick: Math.min(end, s.end_tick) - start }));
}

/** Cắt clip theo vạch nhịp, ô gốc `firstBar`..`lastBar` (gồm hai đầu). Nốt giữ nguyên trường độ. */
export function cutBars(clip: Clip, firstBar: number, lastBar: number): Clip {
  const lo = Math.max(firstBar, clip.bars[0]);
  const hi = Math.min(lastBar, clip.bars[1]);
  if (hi < lo) throw new Error(`đoạn ô ${firstBar}–${lastBar} nằm ngoài clip ${clip.bars[0]}–${clip.bars[1]}`);
  const start = barStartTick(clip.originMeter, clip.ppq, lo) - clip.originTick;
  const end = barStartTick(clip.originMeter, clip.ppq, hi + 1) - clip.originTick;
  const notes = clip.notes.filter((n) => n.tick >= start && n.tick < end).map((n) => ({ ...n, tick: n.tick - start }));
  const lastEnd = notes.reduce((m, n) => Math.max(m, n.tick + n.dur_tick), end - start);
  return {
    ...clip,
    originTick: clip.originTick + start,
    baseTempo: sliceTempo(clip.baseTempo, start, end),
    meter_map: sliceMeter(clip.meter_map, start, end),
    sections: sliceSections(clip.sections, start, end),
    notes,
    endTick: lastEnd,
    bars: [lo, hi],
    clicks: [],
    splits: [],
  };
}

/** `gen.loop`: cắt theo vạch nhịp quanh ô `bar`, ±`span` ô (docs/05 §5.6), lặp `repeat` lần. */
export function genLoop(clip: Clip, bar: number, th: Thresholds, repeat = 3): Clip {
  const span = th.gen.loopSpanBars;
  const out = cutBars(clip, bar - span, bar + span);
  return { ...out, repeat, ops: [...clip.ops, 'gen.loop'] };
}

// ---------------------------------------------------------------- tempo

/** Co giãn tempo đều, KHÔNG chia câu (dùng nội bộ và để test "hạ tempo trần"). Kẹp [1, 100]%. */
export function scaleTempo(clip: Clip, pct: number): Clip {
  const p = Math.min(100, Math.max(1, pct));
  return { ...clip, tempoPct: p, splits: [], ops: [...clip.ops, 'scale_tempo'] };
}

// ---------------------------------------------------------------- âm (nốt hoặc chuỗi nốt nối)

interface Sound {
  first: ScoreNote;
  ids: string[];
  start: number;
  end: number;
}

function soundsOf(clip: Clip): Sound[] {
  const sorted = [...clip.notes].sort((a, b) => a.tick - b.tick || a.pitch - b.pitch);
  const out: Sound[] = [];
  let open: Sound | null = null;
  for (const n of sorted) {
    if (open !== null && open.end === n.tick && open.first.pitch === n.pitch && open.ids.length > 0) {
      const prevTie = clip.notes.find((x) => x.id === open?.ids[open.ids.length - 1])?.tie_next === true;
      if (prevTie) {
        open.ids.push(n.id);
        open.end = n.tick + n.dur_tick;
        continue;
      }
    }
    open = { first: n, ids: [n.id], start: n.tick, end: n.tick + n.dur_tick };
    out.push(open);
  }
  return out;
}

interface SoundCtx {
  s: Sound[];
  /** Điểm lấy hơi có sẵn trong bản nhạc: dấu lấy hơi hoặc lặng ≥ nửa phách trước âm. */
  breathPoint: boolean[];
  /** Dấu lặng ≥ 1 ô trong bản nhạc ngay trước âm (là "nghỉ" của L7). */
  restReset: boolean[];
  secs: (a: number, b: number) => number;
  barTicksAt: (tick: number) => number;
  isBarline: (tick: number) => boolean;
}

function soundCtx(clip: Clip, th: Thresholds): SoundCtx {
  const s = soundsOf(clip);
  const tm = clipTimeMap(clip);
  const breathPoint: boolean[] = [];
  const restReset: boolean[] = [];
  let maxEnd = -Infinity;
  for (let i = 0; i < s.length; i++) {
    const m = meterAt(clip.meter_map, s[i].start);
    const gap = s[i].start - maxEnd;
    breathPoint.push(i === 0 || s[i].first.technique?.breath_before === true || gap >= beatTicks(m, clip.ppq) / 2);
    restReset.push(i > 0 && gap >= th.level.restMinBars * barTicks(m, clip.ppq));
    maxEnd = Math.max(maxEnd, s[i].end);
  }
  return {
    s,
    breathPoint,
    restReset,
    secs: (a, b) => (tickToMs(tm, b) - tickToMs(tm, a)) / 1000,
    barTicksAt: (tick) => barTicks(meterAt(clip.meter_map, tick), clip.ppq),
    isBarline: (tick) => barStartTick(clip.meter_map, clip.ppq, barOfTick(clip.meter_map, clip.ppq, tick)) === tick,
  };
}

// ---------------------------------------------------------------- mức chậm giới hạn của bài sáo

export interface SaoSlowLimits {
  /** Âm (nốt hoặc chuỗi nối) dài nhất ở tempo gốc, giây. */
  longestSoundSeconds: number;
  /** Hơi dài nhất giữa hai điểm lấy hơi có sẵn, giây (tempo gốc). */
  longestBreathSeconds: number;
  /** Dưới hệ số này một âm đơn dài hơn `exhale_max_s`: không chia câu được. */
  fSingle: number;
  /** L6 còn đạt (không chia câu) khi f ≥ hệ số này. */
  fL6: number;
  /** L7 còn đạt (không chèn nghỉ) khi f > hệ số này; 0 = luôn đạt. */
  fL7: number;
  /** Phần trăm tempo nhỏ nhất `gen.slow` được dùng: max(slow_min_pct, ⌈fSingle × 100⌉). */
  minPct: number;
}

/** Tính các mức chậm giới hạn từ bản nhạc và ngưỡng hơi (đối chiếu `tasks/T5b_phu-luc-nhac.md` §11.2). */
export function saoSlowLimits(clip: Clip, th: Thresholds): SaoSlowLimits {
  const base = { ...clip, tempoPct: 100, splits: [] };
  const c = soundCtx(base, th);
  const exhale = th.level.saoPhraseMaxSeconds;
  let longest = 0;
  for (const s of c.s) longest = Math.max(longest, c.secs(s.start, s.end));
  let breath = 0;
  let bStart = 0;
  let bEnd = -Infinity;
  for (let i = 0; i < c.s.length; i++) {
    if (i > 0 && c.breathPoint[i]) {
      breath = Math.max(breath, c.secs(c.s[bStart].start, bEnd));
      bStart = i;
      bEnd = -Infinity;
    }
    bEnd = Math.max(bEnd, c.s[i].end);
  }
  if (c.s.length > 0) breath = Math.max(breath, c.secs(c.s[bStart].start, bEnd));
  let fL7 = 0;
  let seg: number[] = [];
  const flush = (): void => {
    const sorted = [...seg].sort((a, b) => b - a);
    const k = th.level.longNoteStreak;
    if (sorted.length > k) fL7 = Math.max(fL7, sorted[k] / th.level.longNoteSeconds);
    seg = [];
  };
  for (let i = 0; i < c.s.length; i++) {
    if (c.restReset[i]) flush();
    seg.push(c.secs(c.s[i].start, c.s[i].end));
  }
  flush();
  const fSingle = longest / exhale;
  return {
    longestSoundSeconds: longest,
    longestBreathSeconds: breath,
    fSingle,
    fL6: breath / exhale,
    fL7,
    minPct: Math.max(th.gen.slowMinPct, Math.ceil(fSingle * 100 - 1e-9)),
  };
}

// ---------------------------------------------------------------- chia câu

/**
 * Lập điểm chia câu cho clip sáo ở tempo hiện tại: mỗi hơi ≤ `exhale_max_s` và ≤ `maxBars` ô (L6),
 * chuỗi nốt ngân dài ≤ `long_note_streak` giữa hai lần nghỉ (L7). Ưu tiên chia ở vạch ô
 * (chỗ chia muộn nhất còn hợp lệ), không được thì chia ngay trước âm gây vượt.
 * Trả `infeasible` khi chính một âm đơn đã vượt (cần kẹp tempo trước).
 */
export function planBreathSplits(clip: Clip, th: Thresholds, maxBars: number): { splits: SplitPoint[]; infeasible: string[] } {
  const c = soundCtx({ ...clip, splits: [] }, th);
  const n = c.s.length;
  const isSplit = new Array<boolean>(n).fill(false);
  const reasons: SplitPoint['reason'][] = new Array<SplitPoint['reason']>(n).fill('L6_seconds');
  const infeasible: string[] = [];
  const isLong = c.s.map((s) => c.secs(s.start, s.end) >= th.level.longNoteSeconds - 1e-9);
  const eps = 1e-9;
  let bStart = 0;
  let reset = 0;
  let i = 0;
  let guard = 0;
  while (i < n && guard++ < 100000) {
    if (i > bStart && (c.breathPoint[i] || isSplit[i])) bStart = i;
    if (i > reset && (c.restReset[i] || isSplit[i])) reset = i;
    let end = -Infinity;
    for (let k = bStart; k <= i; k++) end = Math.max(end, c.s[k].end);
    const dur = c.secs(c.s[bStart].start, end);
    const span = end - c.s[bStart].start;
    let streak = 0;
    for (let k = reset; k <= i; k++) if (isLong[k]) streak++;
    const l6s = dur > th.level.saoPhraseMaxSeconds + eps;
    const l6b = span > maxBars * c.barTicksAt(c.s[bStart].start);
    const l7 = streak > th.level.longNoteStreak;
    if (!l6s && !l6b && !l7) {
      i++;
      continue;
    }
    const lower = Math.max(l6s || l6b ? bStart : -1, l7 ? reset : -1);
    if (i <= lower) {
      infeasible.push(`${c.s[i].first.id}: một âm đơn đã vượt giới hạn hơi`);
      i++;
      continue;
    }
    let j = i;
    for (let k = i; k > lower; k--) {
      if (c.isBarline(c.s[k].start)) {
        j = k;
        break;
      }
    }
    isSplit[j] = true;
    reasons[j] = l7 && !(l6s || l6b) ? 'L7_streak' : l6s ? 'L6_seconds' : l6b ? 'L6_bars' : 'L7_streak';
    bStart = j;
    reset = j;
    i = j;
  }
  const splits: SplitPoint[] = [];
  for (let k = 0; k < n; k++) {
    if (!isSplit[k]) continue;
    const t = c.s[k].start;
    splits.push({
      beforeNoteId: c.s[k].first.id,
      tick: t,
      restBars: th.level.restMinBars,
      restSeconds: c.secs(t, t + th.level.restMinBars * c.barTicksAt(t)),
      reason: reasons[k],
    });
  }
  return { splits, infeasible };
}

export type SlowResult =
  | { ok: true; clip: Clip; requestedPct: number; appliedPct: number; reasons: string[] }
  | { ok: false; requestedPct: number; minPct: number; reason: string };

/**
 * `gen.slow` (docs/05 §5.6): 40–100% tempo, KHÔNG BAO GIỜ > 100%. Bài sáo: chia câu theo L6, L7;
 * dưới mức chậm tối thiểu thì kẹp lên (`mode: 'clamp'`) hoặc từ chối (`mode: 'refuse'`), kèm lý do.
 */
export function genSlow(clip: Clip, requestedPct: number, th: Thresholds, mode: 'clamp' | 'refuse' = 'clamp'): SlowResult {
  const reasons: string[] = [];
  let pct = Math.min(th.gen.slowMaxPct, Math.max(th.gen.slowMinPct, requestedPct));
  if (pct !== requestedPct) reasons.push(`tempo_range: ${requestedPct}% → ${pct}% (gen.slow chỉ trong ${th.gen.slowMinPct}–${th.gen.slowMaxPct}%)`);
  if (clip.instrument === 'sao_truc') {
    const lim = saoSlowLimits(clip, th);
    if (pct < lim.minPct) {
      const reason = `single_note_exceeds_exhale_max: ở ${pct}% âm dài nhất ${(lim.longestSoundSeconds * 100 / pct).toFixed(2)} s > ${th.level.saoPhraseMaxSeconds} s (exhale_max_s); mức tối thiểu ${lim.minPct}%`;
      if (mode === 'refuse') return { ok: false, requestedPct, minPct: lim.minPct, reason };
      reasons.push(reason);
      pct = lim.minPct;
    }
  }
  let out = { ...scaleTempo(clip, pct), ops: [...clip.ops, 'gen.slow'] };
  if (clip.instrument === 'sao_truc') {
    const plan = planBreathSplits(out, th, th.level.saoPhraseMaxBars);
    if (plan.infeasible.length > 0) {
      return { ok: false, requestedPct, minPct: saoSlowLimits(clip, th).minPct, reason: plan.infeasible.join('; ') };
    }
    if (plan.splits.length > 0) reasons.push(`split: ${plan.splits.length} điểm chia câu (L6/L7, docs/05 §5.4 mục 9)`);
    out = { ...out, splits: plan.splits };
  }
  return { ok: true, clip: out, requestedPct, appliedPct: pct, reasons };
}

/**
 * Chia câu ngắn hơn, GIỮ NGUYÊN tempo: dùng cho `SAO.ERR.SHORT_NOTE` ở bậc "chia nhỏ"
 * (docs/05 §5.4 mục 9: hạ tempo làm nốt dài thêm tính bằng giây). Mặc định mỗi hơi còn tối đa một
 * nửa số ô của hơi dài nhất (ít nhất 1 ô); hơi chỉ có một âm thì không chia thêm được.
 */
export function genSplit(clip: Clip, th: Thresholds, maxBars?: number): Clip {
  const c = soundCtx({ ...clip, splits: [] }, th);
  let longestBars = 0;
  let bStart = 0;
  let bEnd = -Infinity;
  const close = (): void => {
    if (c.s.length > 0) longestBars = Math.max(longestBars, (bEnd - c.s[bStart].start) / c.barTicksAt(c.s[bStart].start));
  };
  for (let i = 0; i < c.s.length; i++) {
    if (i > 0 && c.breathPoint[i]) {
      close();
      bStart = i;
      bEnd = -Infinity;
    }
    bEnd = Math.max(bEnd, c.s[i].end);
  }
  close();
  const limit = Math.max(1, Math.min(maxBars ?? Math.floor(longestBars / 2), th.level.saoPhraseMaxBars));
  const plan = planBreathSplits(clip, th, limit);
  const splits = plan.splits.map((s) => ({ ...s, reason: s.reason === 'L6_bars' ? ('shorter_phrase' as const) : s.reason }));
  return { ...clip, splits, ops: [...clip.ops, 'gen.loop:split'] };
}

/** `gen.tempo_ladder`: các bậc tempo tăng dần tới 100%; lên bậc sau `ladder_advance_after` lượt đúng liên tiếp. */
export function genTempoLadder(clip: Clip, th: Thresholds, startPct?: number): { steps: Clip[]; advanceAfter: number; reasons: string[] } {
  const from = Math.max(th.gen.slowMinPct, startPct ?? th.gen.ladderSteps[0]);
  const pcts = [...new Set([...th.gen.ladderSteps.filter((p) => p >= from && p <= 100), 100])].sort((a, b) => a - b);
  const steps: Clip[] = [];
  const reasons: string[] = [];
  for (const p of pcts) {
    const r = genSlow(clip, p, th, 'clamp');
    if (!r.ok) {
      reasons.push(r.reason);
      continue;
    }
    if (steps.length > 0 && r.appliedPct <= steps[steps.length - 1].tempoPct) continue;
    steps.push({ ...r.clip, ops: [...clip.ops, 'gen.tempo_ladder'] });
    reasons.push(...r.reasons);
  }
  return { steps, advanceAfter: th.gen.ladderAdvanceAfter, reasons };
}

/** `gen.hands_split`: ẩn một tay ở cả nốt lẫn chuyển động (docs/05 §5.6). */
export function genHandsSplit(clip: Clip, keep: Hand): Clip {
  const hide: Hand = keep === 'L' ? 'R' : 'L';
  return {
    ...clip,
    notes: clip.notes.filter((n) => noteHand(n, clip.instrument) !== hide),
    hiddenHands: [...new Set([...clip.hiddenHands, hide])],
    ops: [...clip.ops, 'gen.hands_split'],
  };
}

/** `gen.subdivide`: tiếng "tích" chia nhỏ phách và đếm vào; không đổi nốt. */
export function genSubdivide(clip: Clip, th: Thresholds): Clip {
  const clicks: { tick: number; strong: boolean }[] = [];
  const m0 = meterAt(clip.meter_map, 0);
  const bt0 = beatTicks(m0, clip.ppq);
  const countInBeats = th.gen.countInBars * m0.numerator;
  const step = Math.max(1, Math.round(bt0 / th.gen.subdivision));
  for (let t = -countInBeats * bt0; t < 0; t += bt0) clicks.push({ tick: t, strong: t === -countInBeats * bt0 });
  for (let t = 0; t < clip.endTick; t += step) {
    clicks.push({ tick: t, strong: barStartTick(clip.meter_map, clip.ppq, barOfTick(clip.meter_map, clip.ppq, t)) === t });
  }
  return { ...clip, clicks, countInBeats, ops: [...clip.ops, 'gen.subdivide'] };
}

/**
 * `gen.descend_check`: cắt đoạn thang âm đi xuống CÓ SẴN trong bài, kết thúc ở nốt `targetId`
 * (dò cao độ từ âm trên đã ổn). Không có đoạn đi xuống ≥ 2 nốt thì trả `null`.
 */
export function genDescendCheck(clip: Clip, targetId: string): Clip | null {
  const sorted = [...clip.notes].sort((a, b) => a.tick - b.tick);
  const idx = sorted.findIndex((n) => n.id === targetId);
  if (idx <= 0) return null;
  let k = idx;
  while (k > 0 && sorted[k - 1].pitch > sorted[k].pitch && sorted[k - 1].pitch - sorted[k].pitch <= 2) k--;
  if (k === idx) return null;
  const firstBar = barOfTick(clip.originMeter, clip.ppq, clip.originTick + sorted[k].tick);
  const lastBar = barOfTick(clip.originMeter, clip.ppq, clip.originTick + sorted[idx].tick);
  const out = cutBars(clip, firstBar, lastBar);
  return { ...out, ops: [...clip.ops, 'gen.descend_check'] };
}

// ---------------------------------------------------------------- kiểm bất biến và luật cấp

/** Kiểm bất biến T1: không đổi nốt, không đổi ngón, không đổi trường độ, tempo ≤ 100% bản gốc. */
export function checkInvariants(source: Clip, derived: Clip): string[] {
  const issues: string[] = [];
  const byId = new Map(source.notes.map((n) => [n.id, n]));
  for (const n of derived.notes) {
    const o = byId.get(n.id);
    if (o === undefined) {
      issues.push(`${n.id}: nốt không có trong bản gốc`);
      continue;
    }
    if (o.pitch !== n.pitch) issues.push(`${n.id}: đổi cao độ ${o.pitch} → ${n.pitch}`);
    if (o.dur_tick !== n.dur_tick) issues.push(`${n.id}: đổi trường độ ${o.dur_tick} → ${n.dur_tick}`);
    if (o.tick + source.originTick !== n.tick + derived.originTick) issues.push(`${n.id}: lệch vị trí`);
    const a = o.technique;
    const b = n.technique;
    if ((a === null) !== (b === null) || (a !== null && b !== null && (a.hand !== b.hand || a.finger !== b.finger || a.fingering !== b.fingering || a.octave !== b.octave))) {
      issues.push(`${n.id}: đổi ngón hoặc thế bấm`);
    }
  }
  if (derived.tempoPct > 100) issues.push(`tempo ${derived.tempoPct}% > 100%`);
  const srcTempo = clipTempoMap({ ...source, tempoPct: 100 });
  for (const t of clipTempoMap(derived)) {
    const origin = t.tick + derived.originTick - source.originTick;
    let ref = srcTempo[0].bpm;
    for (const s of srcTempo) if (s.tick <= origin) ref = s.bpm;
    if (t.bpm > ref + 1e-9) issues.push(`tempo ${t.bpm} bpm > ${ref} bpm của bản gốc`);
  }
  return issues;
}

export interface LevelIssue {
  rule: 'L2' | 'L6' | 'L7';
  code: 'L2_SHORT_NOTE' | 'L6_TEMPO' | 'L6_BREATH_SECONDS' | 'L6_BREATH_BARS' | 'L7_LONG_NOTE_STREAK';
  message: string;
  noteId: string | null;
}

/**
 * Kiểm lại luật cấp trên đoạn (đã hoặc chưa biến đổi), docs/05 v2.7 §2.2:
 * - L2: nốt ngắn nhất là nốt đen (cấp beginner, easy);
 * - L6: tempo ≤ `max_bpm`; sáo: mỗi hơi ≤ `sao_phrase_max_bars` ô và ≤ `exhale_max_s` giây;
 * - L7 (sáo): ≤ `long_note_streak` nốt ngân dài (≥ `long_note_min_s`) liên tiếp rồi có nghỉ
 *   (dấu lặng ≥ 1 ô, hoặc điểm chia app chèn nghỉ ≥ 1 ô hay ≥ `breath_pause_s`).
 * Điểm chia câu của clip (`splits`) được tính là điểm lấy hơi và nghỉ.
 */
export function checkLevelRules(clip: Clip, th: Thresholds): LevelIssue[] {
  const issues: LevelIssue[] = [];
  const maxBpm = Math.max(...clipTempoMap(clip).map((t) => t.bpm));
  if (maxBpm > th.level.maxBpm + 1e-9) {
    issues.push({ rule: 'L6', code: 'L6_TEMPO', message: `tempo ${maxBpm} bpm > ${th.level.maxBpm}`, noteId: null });
  }
  if (clip.level === 'beginner' || clip.level === 'easy') {
    for (const n of clip.notes) {
      if (n.dur_tick < th.level.minDurQuarters * clip.ppq) {
        issues.push({ rule: 'L2', code: 'L2_SHORT_NOTE', message: `${n.id} ngắn hơn nốt đen`, noteId: n.id });
      }
    }
  }
  if (clip.instrument !== 'sao_truc') return issues;

  const c = soundCtx(clip, th);
  const splitAt = new Map(clip.splits.map((s) => [s.beforeNoteId, s]));
  let bStart = 0;
  let bEnd = -Infinity;
  const closeBreath = (): void => {
    if (c.s.length === 0) return;
    const dur = c.secs(c.s[bStart].start, bEnd);
    const span = bEnd - c.s[bStart].start;
    const id = c.s[bStart].first.id;
    if (dur > th.level.saoPhraseMaxSeconds + 1e-9) {
      issues.push({ rule: 'L6', code: 'L6_BREATH_SECONDS', message: `hơi từ ${id} dài ${dur.toFixed(2)} s > ${th.level.saoPhraseMaxSeconds} s (exhale_max_s)`, noteId: id });
    }
    if (span > th.level.saoPhraseMaxBars * c.barTicksAt(c.s[bStart].start)) {
      issues.push({ rule: 'L6', code: 'L6_BREATH_BARS', message: `hơi từ ${id} dài hơn ${th.level.saoPhraseMaxBars} ô`, noteId: id });
    }
  };
  let streak = 0;
  let flagged = false;
  for (let i = 0; i < c.s.length; i++) {
    const split = splitAt.get(c.s[i].first.id);
    const isRest =
      c.restReset[i] ||
      (split !== undefined && (split.restBars >= th.level.restMinBars || split.restSeconds >= th.level.breathPauseSeconds));
    if (i > 0 && (c.breathPoint[i] || split !== undefined)) {
      closeBreath();
      bStart = i;
      bEnd = -Infinity;
    }
    bEnd = Math.max(bEnd, c.s[i].end);
    if (isRest) {
      streak = 0;
      flagged = false;
    }
    if (c.secs(c.s[i].start, c.s[i].end) >= th.level.longNoteSeconds - 1e-9) {
      streak++;
      if (streak > th.level.longNoteStreak && !flagged) {
        flagged = true;
        issues.push({
          rule: 'L7',
          code: 'L7_LONG_NOTE_STREAK',
          message: `${streak} nốt ngân dài (≥ ${th.level.longNoteSeconds} s) liên tiếp chưa nghỉ, tối đa ${th.level.longNoteStreak} (long_note_streak)`,
          noteId: c.s[i].first.id,
        });
      }
    }
  }
  closeBreath();
  return issues;
}
