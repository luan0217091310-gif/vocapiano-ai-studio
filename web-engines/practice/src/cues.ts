/**
 * Kho câu nhận xét trên máy (`data/cues.json`, sinh từ thẻ `kb://` bởi `tools/export_kb_cues.py`):
 * chọn câu theo mã lỗi, người nói, ngữ cảnh; điền slot CHỈ từ dữ kiện SSOT hoặc số đo (luật 7,
 * docs/05 §1); chặn câu còn tên nốt, số ngón, số lỗ, chữ số viết trần ngoài slot; giới hạn
 * ≤ 25 âm tiết, ≤ 15 khi người học đang chơi (knowledge/kb/README §3.4). Không sinh câu tự do (D-21).
 */

import { DataError, reqArr, reqObj, reqStr } from './load.ts';
import { SLOT_NAMES } from './types.ts';
import type { SlotFacts, SlotName, SlotSource, SlotValue } from './types.ts';

export type CuePhase = 'practice' | 'after_check' | 'review_loop' | 'wait_mode';

export interface CueContextRules {
  phase: { tag: string; any: string[] }[];
  situation: { tag: string | null; any: string[] }[];
  implicit: Record<string, string>;
}

export interface CueEntry {
  uid: string;
  code: string;
  say: string;
  speaker: string;
  context: string | null;
  duringPlay: boolean;
  do: string[];
  escalation: string[];
  source: 'kb' | 'docs05';
  cardRef: string | null;
  /** Trạng thái ký của thẻ (`draft`, `review`, `approved`…); câu chuẩn docs/05 là `spec`. */
  cardStatus: string;
  lessons: string[];
  /** Tình huống máy đọc; `null` = trung tính; `unmapped` = không nhận ra, không bao giờ chọn. */
  situation: string | null;
  phases: string[];
  slots: SlotName[];
  issues: string[];
}

export interface CueLibrary {
  cues: CueEntry[];
  forbidden: { id: string; re: RegExp }[];
  cardCount: number;
  cardIds: string[];
  docs05Version: string | null;
}

function norm(s: string): string {
  return s.normalize('NFC').toLowerCase();
}

export function parseCueContextRules(raw: unknown): CueContextRules {
  const o = reqObj(raw, 'cue_context');
  if (reqStr(o.schema, 'cue_context.schema') !== 'vocaverse.practice_cue_context/0.1') {
    throw new DataError('cue_context.schema', 'schema lạ');
  }
  const anyList = (v: unknown, p: string): string[] => reqArr(v, p).map((x, i) => norm(reqStr(x, `${p}[${i}]`)));
  const implicitRaw = o.implicit_situation === undefined ? {} : reqObj(o.implicit_situation, 'cue_context.implicit_situation');
  const implicit: Record<string, string> = {};
  for (const [k, v] of Object.entries(implicitRaw)) implicit[k] = reqStr(v, `cue_context.implicit_situation.${k}`);
  return {
    phase: reqArr(o.phase, 'cue_context.phase').map((x, i) => {
      const r = reqObj(x, `cue_context.phase[${i}]`);
      return { tag: reqStr(r.tag, `cue_context.phase[${i}].tag`), any: anyList(r.any, `cue_context.phase[${i}].any`) };
    }),
    situation: reqArr(o.situation, 'cue_context.situation').map((x, i) => {
      const r = reqObj(x, `cue_context.situation[${i}]`);
      const tag = r.tag === null ? null : reqStr(r.tag, `cue_context.situation[${i}].tag`);
      return { tag, any: anyList(r.any, `cue_context.situation[${i}].any`) };
    }),
    implicit,
  };
}

/** Phân loại `context` của câu thành (tình huống, các pha dùng được). */
export function classifyContext(
  context: string | null,
  code: string,
  rules: CueContextRules,
): { situation: string | null; phases: string[] } {
  if (context === null || context.trim() === '') return { situation: rules.implicit[code] ?? null, phases: [] };
  const text = norm(context);
  const phases = rules.phase.filter((r) => r.any.some((s) => text.includes(s))).map((r) => r.tag);
  for (const r of rules.situation) {
    if (r.any.some((s) => text.includes(s))) return { situation: r.tag, phases };
  }
  return { situation: phases.length > 0 ? (rules.implicit[code] ?? null) : 'unmapped', phases };
}

function lessonsOf(card: Record<string, unknown> | undefined): string[] {
  if (card === undefined || !Array.isArray(card.lesson_refs)) return [];
  return card.lesson_refs.filter((x): x is string => typeof x === 'string');
}

/** Kiểm `cues.json` khi nạp và gắn nhãn ngữ cảnh. */
export function parseCueLibrary(raw: unknown, rules: CueContextRules): CueLibrary {
  const o = reqObj(raw, 'cues');
  if (reqStr(o.schema, 'cues.schema') !== 'vocaverse.practice_cues/0.1') throw new DataError('cues.schema', 'schema lạ');
  const cards = reqArr(o.cards, 'cues.cards').map((c, i) => reqObj(c, `cues.cards[${i}]`));
  const cardByRef = new Map(cards.map((c) => [reqStr(c.ref, 'cues.cards[].ref'), c]));
  const slotList = (v: unknown, p: string): SlotName[] =>
    reqArr(v, p).map((x, i) => {
      const s = reqStr(x, `${p}[${i}]`);
      return s as SlotName;
    });
  const strs = (v: unknown, p: string): string[] => (v === undefined || v === null ? [] : reqArr(v, p).map((x, i) => reqStr(x, `${p}[${i}]`)));

  const out: CueEntry[] = [];
  reqArr(o.cues, 'cues.cues').forEach((x, i) => {
    const p = `cues.cues[${i}]`;
    const c = reqObj(x, p);
    const code = reqStr(c.for, `${p}.for`);
    const context = c.context === null || c.context === undefined ? null : reqStr(c.context, `${p}.context`);
    const cardRef = reqStr(c.card_ref, `${p}.card_ref`);
    const card = cardByRef.get(cardRef);
    const issues = strs(c.issues, `${p}.issues`);
    const say = typeof c.say === 'string' ? c.say : '';
    if (say === '') issues.push('missing_say');
    const cls = classifyContext(context, code, rules);
    out.push({
      uid: reqStr(c.uid, `${p}.uid`),
      code,
      say,
      speaker: reqStr(c.speaker, `${p}.speaker`),
      context,
      duringPlay: c.during_play === true,
      do: strs(c.do, `${p}.do`),
      escalation: strs(c.escalation, `${p}.escalation`),
      source: 'kb',
      cardRef,
      cardStatus: card !== undefined && typeof card.status === 'string' ? card.status : 'unknown',
      lessons: lessonsOf(card),
      situation: cls.situation,
      phases: cls.phases,
      slots: slotList(c.slots, `${p}.slots`),
      issues,
    });
  });
  reqArr(o.spec_cues ?? [], 'cues.spec_cues').forEach((x, i) => {
    const p = `cues.spec_cues[${i}]`;
    const c = reqObj(x, p);
    const code = reqStr(c.for, `${p}.for`);
    const context = c.context === null || c.context === undefined ? null : reqStr(c.context, `${p}.context`);
    const cls = classifyContext(context, code, rules);
    out.push({
      uid: reqStr(c.uid, `${p}.uid`),
      code,
      say: reqStr(c.say, `${p}.say`),
      speaker: reqStr(c.speaker, `${p}.speaker`),
      context,
      duringPlay: false,
      do: strs(c.do, `${p}.do`),
      escalation: [],
      source: 'docs05',
      cardRef: null,
      cardStatus: 'spec',
      lessons: [],
      situation: cls.situation,
      phases: cls.phases,
      slots: slotList(c.slots, `${p}.slots`),
      issues: strs(c.issues, `${p}.issues`),
    });
  });
  const forbidden = reqArr(o.forbidden_patterns ?? [], 'cues.forbidden_patterns').map((x, i) => {
    const f = reqObj(x, `cues.forbidden_patterns[${i}]`);
    return { id: reqStr(f.id, 'forbidden.id'), re: new RegExp(reqStr(f.regex, 'forbidden.regex'), 'iu') };
  });
  const sources = o.sources === undefined ? {} : reqObj(o.sources, 'cues.sources');
  const docs05 = sources.docs05 === undefined ? null : reqObj(sources.docs05, 'cues.sources.docs05');
  return {
    cues: out,
    forbidden,
    cardCount: cards.length,
    cardIds: cards.map((c) => reqStr(c.id, 'cues.cards[].id')),
    docs05Version: docs05 !== null && typeof docs05.version === 'string' ? docs05.version : null,
  };
}

// ---------------------------------------------------------------- Chọn câu

export interface CueRequest {
  code: string;
  speaker: string;
  /** Mã đơn vị, VD `PN05`. */
  lesson: string | null;
  /** Tình huống theo thứ tự ưu tiên giảm dần, VD `['accidental_missed', 'single']`. */
  situations: string[];
  phase: CuePhase;
  /** Trạng thái thẻ được dùng; bản phát hành chỉ `approved` (knowledge/README §4). */
  allowedStatus: string[];
}

function cueScore(c: CueEntry, req: CueRequest): number {
  let s = 0;
  if (req.lesson !== null && c.lessons.includes(`lesson.${req.lesson.toLowerCase()}`)) s += 100;
  if (c.situation !== null) s += 20 * (req.situations.length - req.situations.indexOf(c.situation));
  if (c.phases.includes(req.phase)) s += 30;
  if (c.source === 'kb') s += 5;
  return s;
}

export function isEligible(c: CueEntry, req: CueRequest): boolean {
  if (c.code !== req.code || c.speaker !== req.speaker || c.issues.length > 0) return false;
  if (!req.allowedStatus.includes(c.cardStatus)) return false;
  if (c.situation === 'unmapped') return false;
  if (c.situation !== null && !req.situations.includes(c.situation)) return false;
  if (c.phases.length > 0 && !c.phases.includes(req.phase)) return false;
  return true;
}

/** Các câu hợp lệ, xếp theo độ khớp (bài, tình huống, pha, nguồn); hoà thì theo `uid`. */
export function rankCues(lib: CueLibrary, req: CueRequest): CueEntry[] {
  return lib.cues
    .filter((c) => isEligible(c, req))
    .map((c) => ({ c, s: cueScore(c, req) }))
    .sort((a, b) => b.s - a.s || (a.c.uid < b.c.uid ? -1 : a.c.uid > b.c.uid ? 1 : 0))
    .map((x) => x.c);
}

// ---------------------------------------------------------------- Điền slot và kiểm

/** Nguồn bắt buộc của từng slot (luật 7): chỉ `direction` là số đo; còn lại là dữ kiện SSOT. */
export const SLOT_SOURCE: Record<SlotName, SlotSource> = {
  bar: 'ssot',
  k: 'ssot',
  expected_note: 'ssot',
  anchor_note: 'ssot',
  beats: 'ssot',
  direction: 'measurement',
};

const NOTE_VALUE_RE = /^(Đô|Rê|Mi|Fa|Sol|La|Si)( (thăng|giáng|giữa))?$/u;
const SLOT_VALUE_RE: Record<SlotName, RegExp> = {
  bar: /^[1-9][0-9]{0,3}$/,
  k: /^[1-9][0-9]?$/,
  beats: /^[1-9][0-9]?(,[0-9]{1,2})?$/,
  expected_note: NOTE_VALUE_RE,
  anchor_note: NOTE_VALUE_RE,
  direction: /^(cao|thấp)$/u,
};

const SLOT_RE = /\{\{\s*([A-Za-z_]+)\s*\}\}/g;
const W = '[\\p{L}\\p{N}_]';
const BARE_PATTERNS: [string, RegExp][] = [
  ['note_name', new RegExp(`(?<!${W})(?:Đô|Rê|Fa|Sol)(?!${W})`, 'giu')],
  ['note_name', new RegExp(`(?<!${W})(?:Mi|La|Si)(?!${W})`, 'gu')],
  ['note_letter', new RegExp(`(?<!${W})[A-G](?:#|♯|b|♭)?-?[0-9](?!${W})`, 'gu')],
  ['note_letter', new RegExp(`(?<!${W})[A-G](?:♯|♭|#)`, 'gu')],
  ['finger_number', /ngón\s*(?:số\s*)?[1-5]/giu],
  ['hole_number', /lỗ\s*(?:số\s*)?[1-6]/giu],
  ['digit', /[0-9]/gu],
  ['hole_symbol', /[●○◐]/gu],
];

/** Chữ trần cấm (tên nốt, chữ cái nốt kèm quãng, "ngón 1–5", "lỗ 1–6", chữ số, ●○◐). */
export function findBareTokens(text: string): string[] {
  const found: string[] = [];
  for (const [kind, re] of BARE_PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.normalize('NFC').matchAll(re)) found.push(`${kind}:${m[0]}`);
  }
  return found;
}

/** Số âm tiết theo quy ước thẻ: token cách nhau bằng dấu cách (knowledge/kb/README §3.4). */
export function countTokens(text: string): number {
  return text.split(/\s+/u).filter((t) => t.length > 0).length;
}

function vnNumberSyllables(token: string): number {
  const [intPart, decPart] = token.split(/[.,]/);
  const n = Number(intPart);
  let s: number;
  if (n <= 10) s = 1;
  else if (n < 20) s = 2;
  else if (n < 100) s = n % 10 === 0 ? 2 : 3;
  else s = intPart.length + 2;
  if (decPart !== undefined) s += 1 + decPart.length;
  return s;
}

/** Âm tiết khi đọc thành tiếng: như `countTokens`, nhưng số đọc theo tiếng Việt (12 → "mười hai"). */
export function countSpokenSyllables(text: string): number {
  let total = 0;
  for (const raw of text.split(/\s+/u)) {
    const t = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (t === '') continue;
    total += /^[0-9]+([.,][0-9]+)?$/.test(t) ? vnNumberSyllables(t) : 1;
  }
  return total;
}

export interface FillOptions {
  duringPlay: boolean;
  maxSyllables: number;
  maxSyllablesDuringPlay: number;
  forbidden: { id: string; re: RegExp }[];
}

export type FillResult =
  | { ok: true; text: string; syllables: number; cue: CueEntry; slots: Partial<Record<SlotName, SlotValue>> }
  | { ok: false; reason: string; detail: string };

/**
 * Điền slot của câu. Từ chối khi: slot lạ; thiếu dữ kiện; dữ kiện sai nguồn (VD hướng lệch không
 * phải số đo); giá trị không đúng dạng; câu còn chữ trần ngoài slot; quá dài; có cụm từ cấm.
 */
export function fillCue(cue: CueEntry, facts: SlotFacts, opts: FillOptions): FillResult {
  const template = cue.say.normalize('NFC');
  const used: Partial<Record<SlotName, SlotValue>> = {};
  let literal = '';
  let text = '';
  let last = 0;
  SLOT_RE.lastIndex = 0;
  for (const m of template.matchAll(SLOT_RE)) {
    const name = m[1];
    literal += template.slice(last, m.index);
    text += template.slice(last, m.index);
    last = (m.index ?? 0) + m[0].length;
    if (!(SLOT_NAMES as readonly string[]).includes(name)) return { ok: false, reason: 'unknown_slot', detail: name };
    const slot = name as SlotName;
    const fact = facts[slot];
    if (fact === undefined) return { ok: false, reason: 'missing_fact', detail: slot };
    if (fact.source !== SLOT_SOURCE[slot]) {
      return { ok: false, reason: 'bad_source', detail: `${slot}: ${fact.source} ≠ ${SLOT_SOURCE[slot]}` };
    }
    const value = fact.value.normalize('NFC');
    if (!SLOT_VALUE_RE[slot].test(value)) return { ok: false, reason: 'bad_value', detail: `${slot}=${value}` };
    used[slot] = fact;
    text += value;
  }
  literal += template.slice(last);
  text += template.slice(last);
  const bare = findBareTokens(literal);
  if (bare.length > 0) return { ok: false, reason: 'bare_token', detail: bare.join(', ') };
  const syllables = countSpokenSyllables(text);
  const limit = opts.duringPlay ? opts.maxSyllablesDuringPlay : opts.maxSyllables;
  if (syllables > limit) return { ok: false, reason: 'too_long', detail: `${syllables} > ${limit}` };
  for (const f of opts.forbidden) {
    if (f.re.test(text)) return { ok: false, reason: 'forbidden', detail: f.id };
  }
  return { ok: true, text, syllables, cue, slots: used };
}

/** Chọn câu hợp lệ đầu tiên điền được (theo thứ tự `rankCues`). */
export function selectAndFill(
  lib: CueLibrary,
  req: CueRequest,
  facts: SlotFacts,
  opts: FillOptions,
): FillResult {
  let lastFail: FillResult = { ok: false, reason: 'no_cue', detail: `${req.code} ${req.situations.join(',')}` };
  for (const cue of rankCues(lib, req)) {
    const r = fillCue(cue, facts, opts);
    if (r.ok) return r;
    lastFail = r;
  }
  return lastFail;
}
