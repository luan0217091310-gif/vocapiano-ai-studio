/**
 * 9 bộ phát hiện lỗi piano qua MIDI (docs/05 §5.5): WRONG_NOTE, RUSH, DRAG, HANDS_ASYNC, ARTIC,
 * DYN_FLAT, PECKING, REST_SHORT, SHORT_NOTE.
 *
 * Nguyên tắc:
 * - Chỉ đo cái MIDI thấy (cao độ, onset, note-off, pedal, velocity); không suy ra nguyên nhân cảm
 *   biến không thấy (luật 7). Không có mã lỗi ngón: không bắt lỗi ngón khi âm thanh đúng (D-19).
 *   "Mổ cò" chỉ là gợi ý (`scoring: false`) và chỉ ở PN01, PN03, PN04, PN10 (docs/05 §5.4 mục 6).
 * - Mọi ngưỡng ở `config/thresholds.json`. Luật ≥ 2/3 lượt nằm ở chính sách phản hồi (policy.ts).
 * - Slot chỉ chứa dữ kiện SSOT (ô, thứ tự nốt, tên nốt, phím gốc thế tay, số phách) hoặc số đo
 *   (hướng lệch cao/thấp).
 */

import type { ClipIndex, ExpectedNote, OnsetGroup } from './clip.ts';
import { noteBeats } from './clip.ts';
import type { Thresholds } from './config.ts';
import type { ScoreFollower } from './follower.ts';
import { isBlackKey, spokenNoteName } from './notes.ts';
import { beatMsAt, tickToMs } from './timing.ts';
import type { Aspect, Detection, Hand, SlotFacts, SlotValue } from './types.ts';

export interface DetectorInput {
  idx: ClipIndex;
  follower: ScoreFollower;
  th: Thresholds;
  lesson: string | null;
  /** Các câu cần xét (đã chốt, đủ độ phủ). */
  phrases: number[];
}

/** Bộ đệm tính một lần cho mỗi lần chạy. */
interface Ctx extends DetectorInput {
  ref: { start: number; rate: number };
  byPhrase: Map<number, ExpectedNote[]>;
  want: Set<number>;
}

const RHYTHM_PITCH_CODES = new Set([
  'PNO.ERR.WRONG_NOTE',
  'PNO.ERR.RUSH',
  'PNO.ERR.DRAG',
  'PNO.ERR.HANDS_ASYNC',
  'PNO.ERR.REST_SHORT',
  'PNO.ERR.SHORT_NOTE',
]);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mk(
  code: string,
  phrase: number,
  bar: number,
  hand: Hand | null,
  confidence: number,
  aspect: Aspect,
  tags: string[],
  measures: Record<string, number>,
  slots: SlotFacts,
  noteIds: string[],
  scoring = true,
): Detection {
  return { code, phrase, bar, hand, noteIds, confidence, aspect, scoring, tags, measures, slots };
}

function aspectOf(code: string): Aspect {
  if (code === 'PNO.ERR.WRONG_NOTE') return 'pitch';
  return RHYTHM_PITCH_CODES.has(code) ? 'rhythm' : 'other';
}

// ---------------------------------------------------------------- dữ kiện cho slot

function ssot(c: Ctx, value: string, field: string): SlotValue {
  return { value, source: 'ssot', ref: `score:${c.idx.clip.scoreId}@${c.idx.clip.scoreVersion}#${field}` };
}

function barFact(c: Ctx, bar: number): SlotValue {
  return ssot(c, String(bar), `bar=${bar}`);
}

function noteFact(c: Ctx, e: ExpectedNote): SlotValue {
  return ssot(c, spokenNoteName(e.note.pitch, c.idx.clip.keyTonic, c.idx.clip.keyMode), `${e.note.id}.pitch`);
}

function anchorFact(c: Ctx, phrase: number, hand: Hand | null): SlotValue | undefined {
  if (hand === null) return undefined;
  const a = c.idx.anchors.get(`${phrase}|${hand}`);
  if (a === undefined) return undefined;
  return ssot(c, spokenNoteName(a, c.idx.clip.keyTonic, c.idx.clip.keyMode), `anchor:${phrase}|${hand}`);
}

function beatsFact(c: Ctx, e: ExpectedNote): SlotValue {
  const b = noteBeats(c.idx.clip, e.note);
  const v = Number.isInteger(b) ? String(b) : b.toFixed(1).replace('.', ',');
  return ssot(c, v, `${e.note.id}.dur_tick`);
}

function directionFact(diff: number, what: string): SlotValue {
  return { value: diff > 0 ? 'cao' : 'thấp', source: 'measurement', ref: `midi:${what}=${diff > 0 ? '+' : ''}${diff}` };
}

// ---------------------------------------------------------------- tiện ích đo

function played(c: Ctx, e: ExpectedNote) {
  const m = c.follower.matches[e.idx];
  return m !== null && m.played !== null ? m.played : null;
}

function groupOnset(c: Ctx, g: OnsetGroup): number | null {
  let t: number | null = null;
  for (const e of g.notes) {
    const p = played(c, e);
    if (p !== null && (t === null || p.onMs < t)) t = p.onMs;
  }
  return t;
}

/** Mili giây một phách tại `tick`, theo tempo tham chiếu của người học. */
function beatMsAtTick(c: Ctx, tick: number): number {
  return beatMsAt(c.idx.tm, c.idx.clip.meter_map, tick) * c.ref.rate;
}

function streamGroups(c: Ctx, phrase: number): OnsetGroup[][] {
  const out: OnsetGroup[][] = [];
  for (const groups of c.idx.streams.values()) {
    const gs = groups.filter((g) => g.phrase === phrase);
    if (gs.length > 0) out.push(gs);
  }
  return out;
}

function nextGroup(c: Ctx, g: OnsetGroup): OnsetGroup | undefined {
  return c.idx.streams.get(g.stream)?.[g.index + 1];
}

function isSingleLegato(g: OnsetGroup): boolean {
  return g.notes.length === 1 && g.notes[0].note.articulations.includes('legato');
}

function contiguous(g: OnsetGroup, n: OnsetGroup): boolean {
  return Math.abs(n.tick - g.endTick) <= 1;
}

// ---------------------------------------------------------------- WRONG_NOTE

function wrongNote(c: Ctx): Detection[] {
  const th = c.th.wrongNote;
  const out: Detection[] = [];
  for (const p of c.phrases) {
    const exps = c.byPhrase.get(p) ?? [];
    const errors: { e: ExpectedNote; kind: 'sub' | 'miss'; diff: number }[] = [];
    for (const e of exps) {
      const m = c.follower.matches[e.idx];
      if (m === null) continue;
      if (m.status === 'wrong' && m.played !== null) errors.push({ e, kind: 'sub', diff: m.played.pitch - e.note.pitch });
      else if (m.status === 'missed') errors.push({ e, kind: 'miss', diff: 0 });
    }
    const extras = c.follower.extras.filter((x) => c.idx.expected[x.nearIdx]?.phrase === p);
    if (errors.length === 0 && extras.length === 0) continue;
    const measures = {
      substitutions: errors.filter((x) => x.kind === 'sub').length,
      missed: errors.filter((x) => x.kind === 'miss').length,
      extras: extras.length,
    };

    // Cả câu (một tay) lệch đều cùng một khoảng: lệch phím hoặc lệch quãng tám.
    let shifted: Detection | null = null;
    for (const hand of ['R', 'L'] as const) {
      const handExps = exps.filter((e) => e.hand === hand);
      const subs = errors.filter((x) => x.kind === 'sub' && x.e.hand === hand);
      if (subs.length < th.shiftMinNotes || subs.length < th.shiftMinFraction * handExps.length) continue;
      const d = subs[0].diff;
      if (d === 0 || !subs.every((x) => x.diff === d)) continue;
      const tag = Math.abs(d) === 12 ? 'octave_shift' : Math.abs(d) <= 2 ? 'uniform_shift' : null;
      if (tag === null) continue;
      const first = subs[0].e;
      const slots: SlotFacts = {
        bar: barFact(c, first.bar),
        expected_note: noteFact(c, first),
        direction: directionFact(d, 'played-expected'),
      };
      const anchor = anchorFact(c, p, hand);
      if (anchor !== undefined) slots.anchor_note = anchor;
      shifted = mk('PNO.ERR.WRONG_NOTE', p, first.bar, hand, th.confSubstitution, 'pitch', [tag], { ...measures, shift: d }, slots, subs.map((x) => x.e.note.id));
      break;
    }
    if (shifted !== null) {
      out.push(shifted);
      continue;
    }

    errors.sort((a, b) => a.e.onMs - b.e.onMs);
    const first = errors[0];
    if (first !== undefined) {
      const e = first.e;
      const group = c.idx.streams.get(e.stream)?.[e.group];
      const tags: string[] = [];
      if (first.kind === 'sub' && Math.abs(first.diff) === 1 && isBlackKey(e.note.pitch) && !isBlackKey(e.note.pitch + first.diff)) {
        tags.push('accidental_missed');
      }
      if (group !== undefined && group.notes.length >= 2) tags.push('chord');
      if (group !== undefined && c.idx.switches.some((s) => s.to === group)) tags.push('hand_switch');
      const phrase = c.idx.phrases[p];
      if (phrase !== undefined && /sight|read|doc|đọc/iu.test(`${phrase.sectionId ?? ''} ${phrase.sectionName}`)) tags.push('reading');
      if (e.note.pitch === 60) tags.push('middle_c');
      tags.push('single');
      const slots: SlotFacts = { bar: barFact(c, e.bar), expected_note: noteFact(c, e) };
      if (group !== undefined) slots.k = ssot(c, String(group.kInBar), `${e.note.id}.k_in_bar`);
      const anchor = anchorFact(c, p, e.hand);
      if (anchor !== undefined) slots.anchor_note = anchor;
      if (first.kind === 'sub') slots.direction = directionFact(first.diff, 'played-expected');
      const conf = first.kind === 'sub' ? th.confSubstitution : th.confMissed;
      out.push(mk('PNO.ERR.WRONG_NOTE', p, e.bar, e.hand, conf, 'pitch', tags, measures, slots, errors.map((x) => x.e.note.id)));
    } else {
      const near = c.idx.expected[extras[0].nearIdx];
      out.push(
        mk('PNO.ERR.WRONG_NOTE', p, near.bar, near.hand, th.confExtra, 'pitch', ['extra', 'single'], measures,
          { bar: barFact(c, near.bar) }, []),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------- RUSH / DRAG

interface Pt {
  x: number;
  dev: number;
}

function theilSen(pts: Pt[]): number {
  const slopes: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[j].x - pts[i].x;
      if (dx > 0) slopes.push((pts[j].dev - pts[i].dev) / dx);
    }
  }
  return slopes.length === 0 ? 0 : median(slopes);
}

function concordance(pts: Pt[], sign: number): number {
  let agree = 0;
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      total++;
      if (Math.sign(pts[j].dev - pts[i].dev) === sign) agree++;
    }
  }
  return total === 0 ? 0 : agree / total;
}

/** Onset thực của từng tick (trung bình các tay) trong câu, kèm độ lệch so với nhịp danh nghĩa. */
function phraseOnsets(c: Ctx, phrase: number): { tick: number; onMs: number; actual: number; groups: OnsetGroup[] }[] {
  const byTick = new Map<number, { onMs: number; actual: number[]; groups: OnsetGroup[] }>();
  for (const gs of streamGroups(c, phrase)) {
    for (const g of gs) {
      const t = groupOnset(c, g);
      if (t === null) continue;
      const cur = byTick.get(g.tick);
      if (cur === undefined) byTick.set(g.tick, { onMs: g.notes[0].onMs, actual: [t], groups: [g] });
      else {
        cur.actual.push(t);
        cur.groups.push(g);
      }
    }
  }
  return [...byTick.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tick, v]) => ({ tick, onMs: v.onMs, actual: v.actual.reduce((s, x) => s + x, 0) / v.actual.length, groups: v.groups }));
}

function timing(c: Ctx): Detection[] {
  const th = c.th.timing;
  const out: Detection[] = [];
  for (const p of c.phrases) {
    const phrase = c.idx.phrases[p];
    const ons = phraseOnsets(c, p);
    let drifted = false;
    // Trôi nhịp (nhanh/chậm dần) chỉ đo được khi có nhịp chuẩn (máy đếm nhịp, `gen.subdivide`):
    // câu sửa RUSH/DRAG nói "Để tiếng 'tích' dẫn đường". Chơi tự do chỉ chấm lỗi nhịp cục bộ.
    if (c.follower.clockMode === 'metronome' && ons.length >= th.minOnsets) {
      const pts = ons.map((o) => ({ x: o.onMs * c.ref.rate, dev: o.actual - (c.ref.start + c.ref.rate * o.onMs) }));
      const slope = theilSen(pts);
      const drift = slope * (pts[pts.length - 1].x - pts[0].x);
      if (Math.abs(drift) >= th.driftMs) {
        const conc = concordance(pts, Math.sign(drift));
        if (conc >= th.minConcordance) {
          drifted = true;
          const code = drift < 0 ? 'PNO.ERR.RUSH' : 'PNO.ERR.DRAG';
          out.push(mk(code, p, phrase.firstBar, null, conc, 'rhythm', ['drift'], { driftMs: Math.round(drift), concordance: conc },
            { bar: barFact(c, phrase.firstBar) }, []));
        }
      }
    }

    // Khựng (đứt mạch): một khoảng onset dài hơn danh nghĩa ≥ stall_beats phách.
    const beatMs = beatMsAtTick(c, phrase.startTick);
    let stall: { bar: number; excess: number } | null = null;
    for (let i = 1; i < ons.length; i++) {
      const excess = ons[i].actual - ons[i - 1].actual - (ons[i].onMs - ons[i - 1].onMs) * c.ref.rate;
      if (excess >= th.stallBeats * beatMs && (stall === null || excess > stall.excess)) {
        stall = { bar: ons[i].groups[0].bar, excess };
      }
    }
    if (stall !== null) {
      out.push(mk('PNO.ERR.DRAG', p, stall.bar, null, 0.9, 'flow', ['stall'], { stallMs: Math.round(stall.excess) },
        { bar: barFact(c, stall.bar) }, []));
    }
    if (drifted) continue;

    // Onset sau nốt dài đến sớm (ô có nốt dài bị ngắn).
    let early: { g: OnsetGroup; short: number } | null = null;
    for (const gs of streamGroups(c, p)) {
      for (const g of gs) {
        const n = nextGroup(c, g);
        if (n === undefined || n.phrase !== p) continue;
        const longest = g.notes.reduce((a, b) => (b.note.dur_tick > a.note.dur_tick ? b : a));
        if (noteBeats(c.idx.clip, longest.note) < th.longNoteBeats) continue;
        const t0 = groupOnset(c, g);
        const t1 = groupOnset(c, n);
        if (t0 === null || t1 === null) continue;
        const nominal = (n.notes[0].onMs - g.notes[0].onMs) * c.ref.rate;
        const short = nominal - (t1 - t0);
        if (short >= Math.max(th.earlyMinMs, th.earlyFraction * nominal) && (early === null || short > early.short)) {
          early = { g, short };
        }
      }
    }
    if (early !== null) {
      const longest = early.g.notes.reduce((a, b) => (b.note.dur_tick > a.note.dur_tick ? b : a));
      out.push(mk('PNO.ERR.RUSH', p, early.g.bar, early.g.hand, 0.85, 'rhythm', ['long_note_short'], { shortMs: Math.round(early.short) },
        { bar: barFact(c, early.g.bar), beats: beatsFact(c, longest) }, early.g.notes.map((e) => e.note.id)));
    }

    // Nốt ngay sau dấu lặng vào muộn.
    let late: { bar: number; excess: number } | null = null;
    for (const r of c.idx.rests) {
      if (r.phrase !== p) continue;
      const t0 = groupOnset(c, r.prev);
      const t1 = groupOnset(c, r.next);
      if (t0 === null || t1 === null) continue;
      const nominal = (r.next.notes[0].onMs - r.prev.notes[0].onMs) * c.ref.rate;
      const restMs = (tickToMs(c.idx.tm, r.endTick) - tickToMs(c.idx.tm, r.startTick)) * c.ref.rate;
      const excess = t1 - t0 - nominal;
      if (excess >= Math.max(th.lateMinMs, th.lateAfterRestFraction * restMs) && excess < th.stallBeats * beatMs) {
        if (late === null || excess > late.excess) late = { bar: r.bar, excess };
      }
    }
    if (late !== null) {
      out.push(mk('PNO.ERR.DRAG', p, late.bar, null, 0.85, 'rhythm', ['late_after_rest'], { lateMs: Math.round(late.excess) },
        { bar: barFact(c, late.bar) }, []));
    }

    // Hụt nhịp ở chỗ đổi tay (hai tay luân phiên).
    let gaps = 0;
    let gapBar = phrase.firstBar;
    for (const s of c.idx.switches) {
      if (s.phrase !== p) continue;
      const t0 = groupOnset(c, s.from);
      const t1 = groupOnset(c, s.to);
      if (t0 === null || t1 === null) continue;
      const nominal = (s.to.notes[0].onMs - s.from.notes[0].onMs) * c.ref.rate;
      const excess = t1 - t0 - nominal;
      if (excess >= Math.max(th.switchGapMinMs, th.switchGapFraction * nominal) && excess < th.stallBeats * beatMs) {
        if (gaps === 0) gapBar = s.to.bar;
        gaps++;
      }
    }
    if (gaps >= th.switchGapMinCount) {
      out.push(mk('PNO.ERR.DRAG', p, gapBar, null, 0.85, 'rhythm', ['hand_switch_gap'], { gaps }, { bar: barFact(c, gapBar) }, []));
    }
  }
  return out;
}

// ---------------------------------------------------------------- HANDS_ASYNC

function handsAsync(c: Ctx): Detection[] {
  const th = c.th.handsAsync;
  const out: Detection[] = [];
  for (const p of c.phrases) {
    const diffs: number[] = [];
    let bar = 0;
    for (const t of c.idx.twoHand) {
      if (t.phrase !== p) continue;
      const l = groupOnset(c, t.L);
      const r = groupOnset(c, t.R);
      if (l === null || r === null) continue;
      if (diffs.length === 0) bar = t.bar;
      diffs.push(l - r);
    }
    if (diffs.length < th.minPairs) continue;
    const medAbs = median(diffs.map(Math.abs));
    if (medAbs <= th.thresholdMs) continue;
    const med = median(diffs);
    const fracLate = diffs.filter((d) => d > 0).length / diffs.length;
    const fracEarly = diffs.filter((d) => d < 0).length / diffs.length;
    const tags: string[] = [];
    if (fracLate >= th.directionConsistency && med > th.thresholdMs) tags.push('lh_late');
    else if (fracEarly >= th.directionConsistency && med < -th.thresholdMs) tags.push('lh_early');
    out.push(mk('PNO.ERR.HANDS_ASYNC', p, bar, null, diffs.length >= 3 ? 0.9 : 0.75, 'rhythm', tags,
      { medianAbsMs: Math.round(medAbs), medianMs: Math.round(med), pairs: diffs.length, fracLate }, { bar: barFact(c, bar) }, []));
  }
  return out;
}

// ---------------------------------------------------------------- ARTIC

function artic(c: Ctx): Detection[] {
  const th = c.th.artic;
  const out: Detection[] = [];
  for (const p of c.phrases) {
    for (const gs of streamGroups(c, p)) {
      // Legato có khe: cặp nốt liền (không dấu lặng), khác cao độ, cùng ghi legato.
      let pairs = 0;
      let ok = 0;
      let firstBad: OnsetGroup | null = null;
      for (const g of gs) {
        const n = nextGroup(c, g);
        if (n === undefined || n.phrase !== p || !isSingleLegato(g) || !isSingleLegato(n) || !contiguous(g, n)) continue;
        if (g.notes[0].note.pitch === n.notes[0].note.pitch) continue;
        const a = played(c, g.notes[0]);
        const b = played(c, n.notes[0]);
        if (a === null || b === null) continue;
        const end = c.follower.soundEnd(a);
        if (end === null) continue;
        pairs++;
        if (b.onMs - end <= th.legatoGapMs) ok++;
        else if (firstBad === null) firstBad = g;
      }
      if (pairs >= th.minPairs && ok / pairs < th.legatoOkFraction && firstBad !== null) {
        out.push(mk('PNO.ERR.ARTIC', p, firstBad.bar, firstBad.hand, pairs >= 4 ? 0.9 : 0.75, 'other', ['legato'],
          { pairs, okFraction: ok / pairs }, { bar: barFact(c, firstBad.bar) }, [firstBad.notes[0].note.id]));
      }
      // Staccato giữ quá lâu.
      let stac = 0;
      let stacOk = 0;
      let firstLong: ExpectedNote | null = null;
      for (const g of gs) {
        for (const e of g.notes) {
          if (!e.note.articulations.includes('staccato')) continue;
          const a = played(c, e);
          if (a === null) continue;
          const end = c.follower.soundEnd(a);
          if (end === null) continue;
          stac++;
          if ((end - a.onMs) / (e.durMs * c.ref.rate) <= th.staccatoMaxRatio) stacOk++;
          else if (firstLong === null) firstLong = e;
        }
      }
      if (stac >= th.minStaccato && stacOk / stac < th.staccatoOkFraction && firstLong !== null) {
        out.push(mk('PNO.ERR.ARTIC', p, firstLong.bar, firstLong.hand, 0.9, 'other', ['staccato'],
          { notes: stac, okFraction: stacOk / stac }, { bar: barFact(c, firstLong.bar) }, [firstLong.note.id]));
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- DYN_FLAT

function dynFlat(c: Ctx): Detection[] {
  const th = c.th.dynFlat;
  const pVel: number[] = [];
  const fVel: number[] = [];
  let pFirst: ExpectedNote | null = null;
  let fFirst: ExpectedNote | null = null;
  for (const e of c.idx.expected) {
    const isP = e.note.velocity <= th.pMaxVelocity;
    const isF = e.note.velocity >= th.fMinVelocity;
    if (!isP && !isF) continue;
    if (isP && pFirst === null) pFirst = e;
    if (isF && fFirst === null) fFirst = e;
    const a = played(c, e);
    if (a === null) continue;
    (isP ? pVel : fVel).push(a.velocity);
  }
  if (pFirst === null || fFirst === null) return [];
  const later = pFirst.onMs > fFirst.onMs ? pFirst : fFirst;
  if (!c.want.has(later.phrase) || pVel.length < th.minNotesEach || fVel.length < th.minNotesEach) return [];
  const diff = median(fVel) - median(pVel);
  if (diff >= th.minDiff) return [];
  return [mk('PNO.ERR.DYN_FLAT', later.phrase, later.bar, null, 0.9, 'other', [], { velocityDiff: Math.round(diff) },
    { bar: barFact(c, later.bar) }, [])];
}

// ---------------------------------------------------------------- PECKING

function pecking(c: Ctx): Detection[] {
  const th = c.th.pecking;
  if (c.lesson === null || !th.lessons.includes(c.lesson)) return [];
  const out: Detection[] = [];
  for (const p of c.phrases) {
    for (const gs of streamGroups(c, p)) {
      let pairs = 0;
      let gapped = 0;
      for (const g of gs) {
        const n = nextGroup(c, g);
        if (n === undefined || n.phrase !== p || g.notes.length !== 1 || n.notes.length !== 1 || !contiguous(g, n)) continue;
        if (g.notes[0].note.pitch === n.notes[0].note.pitch) continue;
        if (g.notes[0].note.articulations.includes('staccato')) continue;
        const a = played(c, g.notes[0]);
        const b = played(c, n.notes[0]);
        if (a === null || b === null) continue;
        const end = c.follower.soundEnd(a);
        if (end === null) continue;
        pairs++;
        if (b.onMs - end > th.gapMs) gapped++;
      }
      if (pairs >= th.minPairs && gapped / pairs >= th.fraction) {
        const g = gs[0];
        out.push(mk('PNO.ERR.PECKING', p, g.bar, g.hand, 0.8, 'other', [], { pairs, gappedFraction: gapped / pairs }, {}, [], false));
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- REST_SHORT

function restShort(c: Ctx): Detection[] {
  const th = c.th.restShort;
  const out: Detection[] = [];
  for (const p of c.phrases) {
    let total = 0;
    let bad = 0;
    let firstBar = 0;
    let holdOver = 0;
    let earlyEntry = 0;
    for (const r of c.idx.rests) {
      if (r.phrase !== p) continue;
      const t0 = groupOnset(c, r.prev);
      const t1 = groupOnset(c, r.next);
      if (t0 === null || t1 === null) continue;
      let end: number | null = null;
      for (const e of r.prev.notes) {
        const a = played(c, e);
        const s = a === null ? null : c.follower.soundEnd(a);
        if (s !== null && (end === null || s > end)) end = s;
      }
      if (end === null) continue;
      total++;
      const restStart = t0 + (tickToMs(c.idx.tm, r.startTick) - r.prev.notes[0].onMs) * c.ref.rate;
      const restMs = (tickToMs(c.idx.tm, r.endTick) - tickToMs(c.idx.tm, r.startTick)) * c.ref.rate;
      const limit = Math.max(th.minMs, th.shortenFraction * restMs);
      const over = end - restStart;
      const early = t0 + (r.next.notes[0].onMs - r.prev.notes[0].onMs) * c.ref.rate - t1;
      if (over > limit || early > limit) {
        bad++;
        if (bad === 1) firstBar = r.bar;
        if (over > limit) holdOver++;
        else earlyEntry++;
      }
    }
    if (total === 0 || bad === 0 || (total - bad) / total >= th.okFraction) continue;
    const tag = holdOver >= earlyEntry ? 'rest_hold_over' : 'rest_early_entry';
    out.push(mk('PNO.ERR.REST_SHORT', p, firstBar, null, 0.85, 'rhythm', [tag], { rests: total, shortened: bad },
      { bar: barFact(c, firstBar) }, []));
  }
  return out;
}

// ---------------------------------------------------------------- SHORT_NOTE

function shortNote(c: Ctx): Detection[] {
  const th = c.th.shortNote;
  const out: Detection[] = [];
  for (const p of c.phrases) {
    let first: ExpectedNote | null = null;
    let count = 0;
    let worst = 1;
    for (const gs of streamGroups(c, p)) {
      for (const g of gs) {
        const n = nextGroup(c, g);
        if (n === undefined) continue;
        const t0 = groupOnset(c, g);
        const t1 = groupOnset(c, n);
        if (t0 === null || t1 === null) continue;
        const nextOk = Math.abs(t1 - (t0 + (n.notes[0].onMs - g.notes[0].onMs) * c.ref.rate)) <= th.nextOnTimeMs;
        if (!nextOk) continue;
        for (const e of g.notes) {
          if (noteBeats(c.idx.clip, e.note) < th.longNoteBeats || e.note.articulations.includes('staccato')) continue;
          const m = c.follower.matches[e.idx];
          if (m === null || m.status !== 'correct' || m.played === null) continue;
          const end = c.follower.soundEnd(m.played);
          if (end === null) continue;
          const ratio = (end - m.played.onMs) / (e.durMs * c.ref.rate);
          if (ratio < th.holdRatioMin) {
            count++;
            if (first === null) first = e;
            worst = Math.min(worst, ratio);
          }
        }
      }
    }
    if (first !== null) {
      out.push(mk('PNO.ERR.SHORT_NOTE', p, first.bar, first.hand, 0.9, 'rhythm', ['long_note_release'],
        { shortNotes: count, worstHoldRatio: worst }, { bar: barFact(c, first.bar), beats: beatsFact(c, first) }, [first.note.id]));
    }
  }
  return out;
}

// ---------------------------------------------------------------- tổng hợp

/** Thứ tự chạy; `timing` phát cả RUSH và DRAG (trôi, khựng, sau dấu lặng, đổi tay, nốt dài bị ngắn). */
const DETECTORS: [string, (c: Ctx) => Detection[]][] = [
  ['wrong_note', wrongNote],
  ['timing', timing],
  ['hands_async', handsAsync],
  ['artic', artic],
  ['dyn_flat', dynFlat],
  ['pecking', pecking],
  ['rest_short', restShort],
  ['short_note', shortNote],
];

/**
 * Chạy cả 9 bộ phát hiện trên các câu đã chốt. Quy tắc "giải thích bằng mổ cò": ở bài có gợi ý
 * mổ cò, câu (cùng tay) đã có PECKING thì bỏ ARTIC legato và SHORT_NOTE cùng nguồn gốc khe hở.
 */
export function runPianoDetectors(input: DetectorInput): Detection[] {
  const byPhrase = new Map<number, ExpectedNote[]>();
  for (const e of input.idx.expected) {
    const list = byPhrase.get(e.phrase);
    if (list === undefined) byPhrase.set(e.phrase, [e]);
    else list.push(e);
  }
  const c: Ctx = { ...input, ref: input.follower.reference(), byPhrase, want: new Set(input.phrases) };
  const all: Detection[] = [];
  for (const [, fn] of DETECTORS) all.push(...fn(c));
  const pecked = new Set(all.filter((d) => d.code === 'PNO.ERR.PECKING').map((d) => `${d.phrase}|${d.hand}`));
  return all
    .filter((d) => {
      if (!pecked.has(`${d.phrase}|${d.hand}`)) return true;
      if (d.code === 'PNO.ERR.SHORT_NOTE') return false;
      return !(d.code === 'PNO.ERR.ARTIC' && d.tags.includes('legato'));
    })
    .map((d) => (d.aspect === 'flow' ? d : { ...d, aspect: aspectOf(d.code) }));
}
