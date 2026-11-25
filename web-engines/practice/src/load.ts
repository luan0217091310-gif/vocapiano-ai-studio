/**
 * Nạp dữ liệu JSON (VocaScore, mục tiêu luyện tập) có kiểm trường bắt buộc khi chạy.
 * Không phụ thuộc `node:fs`: hàm nhận đối tượng đã `JSON.parse`, nên chạy được cả trên trình duyệt.
 */

import type {
  Hand,
  KeyChange,
  MeterChange,
  NoteTechnique,
  Ornament,
  PartConfig,
  PracticeTarget,
  ScoreNote,
  ScorePart,
  Section,
  SkillNodeRef,
  TempoChange,
  VocaScore,
} from './types.ts';

export class DataError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'DataError';
    this.path = path;
  }
}

type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function reqObj(v: unknown, path: string): Json {
  if (!isObj(v)) throw new DataError(path, 'cần object');
  return v;
}

export function reqArr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw new DataError(path, 'cần mảng');
  return v;
}

export function reqStr(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0) throw new DataError(path, 'cần chuỗi khác rỗng');
  return v;
}

interface NumOpts {
  int?: boolean;
  min?: number;
  max?: number;
  gt?: number;
}

export function reqNum(v: unknown, path: string, opts: NumOpts = {}): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new DataError(path, 'cần số');
  if (opts.int === true && !Number.isInteger(v)) throw new DataError(path, 'cần số nguyên');
  if (opts.min !== undefined && v < opts.min) throw new DataError(path, `phải >= ${opts.min}`);
  if (opts.max !== undefined && v > opts.max) throw new DataError(path, `phải <= ${opts.max}`);
  if (opts.gt !== undefined && v <= opts.gt) throw new DataError(path, `phải > ${opts.gt}`);
  return v;
}

function optNum(v: unknown, path: string, dflt: number, opts: NumOpts = {}): number {
  return v === undefined || v === null ? dflt : reqNum(v, path, opts);
}

function optStr(v: unknown, path: string): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw new DataError(path, 'cần chuỗi');
  return v;
}

function optBool(v: unknown, path: string, dflt: boolean): boolean {
  if (v === undefined || v === null) return dflt;
  if (typeof v !== 'boolean') throw new DataError(path, 'cần true/false');
  return v;
}

function strList(v: unknown, path: string): string[] {
  if (v === undefined || v === null) return [];
  return reqArr(v, path).map((x, i) => reqStr(x, `${path}[${i}]`));
}

// ---------------------------------------------------------------- skill_node

const KB_REF_RE = /^kb:\/\/((?:pno|sao|gtr|voc|com)\.[a-z]+\.[a-z][a-z0-9_]{1,23}\.[0-9]{2})@([1-9][0-9]*)(?:#k[1-9][0-9]?)?$/;
const LEGACY_SKILL_RE = /^[A-Z]{2,5}(?:\.[A-Z0-9_]+)+$/;

/** Đọc `pedagogy.skill_node`: dạng `kb://…@n` (sau T5b) hoặc mã cũ `PNO.CHORD.I_V7_REDUCED`. */
export function parseSkillNode(raw: string, path = 'skill_node'): SkillNodeRef {
  const m = KB_REF_RE.exec(raw);
  if (m !== null) return { kind: 'kb', raw, id: m[1], version: Number(m[2]) };
  if (LEGACY_SKILL_RE.test(raw)) return { kind: 'code', raw, code: raw };
  throw new DataError(path, `skill_node không đúng dạng kb://<id>@<n> hay mã cũ: ${raw}`);
}

// ---------------------------------------------------------------- VocaScore

function sortByTick<T extends { tick: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.tick - b.tick);
}

function parseTempoMap(v: unknown, path: string): TempoChange[] {
  const arr = reqArr(v, path);
  if (arr.length === 0) throw new DataError(path, 'cần ít nhất một mốc tempo');
  const out = sortByTick(
    arr.map((x, i) => {
      const o = reqObj(x, `${path}[${i}]`);
      return {
        tick: reqNum(o.tick, `${path}[${i}].tick`, { int: true, min: 0 }),
        bpm: reqNum(o.bpm, `${path}[${i}].bpm`, { gt: 0, max: 400 }),
      };
    }),
  );
  if (out[0].tick !== 0) out.unshift({ tick: 0, bpm: out[0].bpm });
  return out;
}

function parseMeterMap(v: unknown, path: string): MeterChange[] {
  const arr = reqArr(v, path);
  if (arr.length === 0) throw new DataError(path, 'cần ít nhất một mốc nhịp');
  const out = sortByTick(
    arr.map((x, i) => {
      const o = reqObj(x, `${path}[${i}]`);
      const den = reqNum(o.denominator, `${path}[${i}].denominator`, { int: true, min: 1 });
      if (![1, 2, 4, 8, 16, 32].includes(den)) {
        throw new DataError(`${path}[${i}].denominator`, 'phải là 1, 2, 4, 8, 16 hoặc 32');
      }
      return {
        tick: reqNum(o.tick, `${path}[${i}].tick`, { int: true, min: 0 }),
        numerator: reqNum(o.numerator, `${path}[${i}].numerator`, { int: true, min: 1, max: 32 }),
        denominator: den,
      };
    }),
  );
  if (out[0].tick !== 0) out.unshift({ ...out[0], tick: 0 });
  return out;
}

function parseKeyMap(v: unknown, path: string): KeyChange[] {
  if (v === undefined || v === null) return [{ tick: 0, tonic: 'C', mode: 'major' }];
  const arr = reqArr(v, path);
  if (arr.length === 0) return [{ tick: 0, tonic: 'C', mode: 'major' }];
  return sortByTick(
    arr.map((x, i) => {
      const o = reqObj(x, `${path}[${i}]`);
      const tonic = reqStr(o.tonic, `${path}[${i}].tonic`);
      if (!/^[A-G](#|b)?$/.test(tonic)) throw new DataError(`${path}[${i}].tonic`, `tonic lạ: ${tonic}`);
      return {
        tick: reqNum(o.tick, `${path}[${i}].tick`, { int: true, min: 0 }),
        tonic,
        mode: reqStr(o.mode, `${path}[${i}].mode`),
      };
    }),
  );
}

function parseSections(v: unknown, path: string): Section[] {
  if (v === undefined || v === null) return [];
  return reqArr(v, path)
    .map((x, i) => {
      const o = reqObj(x, `${path}[${i}]`);
      const start = reqNum(o.start_tick, `${path}[${i}].start_tick`, { int: true, min: 0 });
      const end = reqNum(o.end_tick, `${path}[${i}].end_tick`, { int: true, gt: start });
      return {
        id: reqStr(o.id, `${path}[${i}].id`),
        name: optStr(o.name, `${path}[${i}].name`) ?? '',
        start_tick: start,
        end_tick: end,
      };
    })
    .sort((a, b) => a.start_tick - b.start_tick || a.end_tick - b.end_tick);
}

function parseTechnique(v: unknown, path: string): NoteTechnique | null {
  if (v === undefined || v === null) return null;
  const o = reqObj(v, path);
  const handRaw = optStr(o.hand, `${path}.hand`);
  if (handRaw !== null && handRaw !== 'L' && handRaw !== 'R') {
    throw new DataError(`${path}.hand`, 'phải là L hoặc R');
  }
  const finger = o.finger === undefined || o.finger === null || typeof o.finger === 'string'
    ? null
    : reqNum(o.finger, `${path}.finger`, { int: true, min: 0, max: 5 });
  const tongue = o.tongue === undefined || o.tongue === null ? null : optBool(o.tongue, `${path}.tongue`, false);
  return {
    kind: optStr(o.kind, `${path}.kind`) ?? 'unknown',
    hand: handRaw as Hand | null,
    finger,
    fingering: optStr(o.fingering, `${path}.fingering`),
    octave: o.octave === undefined || o.octave === null ? null : reqNum(o.octave, `${path}.octave`, { int: true }),
    tongue,
    breath_before: optBool(o.breath_before, `${path}.breath_before`, false),
  };
}

function parseOrnaments(v: unknown, path: string): Ornament[] {
  if (v === undefined || v === null) return [];
  return reqArr(v, path).map((x, i) => {
    if (typeof x === 'string') return { type: x, target_pitch: null, delta_cents: null };
    const o = reqObj(x, `${path}[${i}]`);
    return {
      type: reqStr(o.type, `${path}[${i}].type`),
      target_pitch: o.target_pitch === undefined || o.target_pitch === null
        ? null
        : reqNum(o.target_pitch, `${path}[${i}].target_pitch`, { int: true, min: 0, max: 127 }),
      delta_cents: o.delta_cents === undefined || o.delta_cents === null
        ? null
        : reqNum(o.delta_cents, `${path}[${i}].delta_cents`),
    };
  });
}

function parseNote(v: unknown, path: string): ScoreNote {
  const o = reqObj(v, path);
  const ped = o.pedagogy === undefined || o.pedagogy === null ? null : reqObj(o.pedagogy, `${path}.pedagogy`);
  const skillRaw = ped === null ? null : optStr(ped.skill_node, `${path}.pedagogy.skill_node`);
  return {
    id: reqStr(o.id, `${path}.id`),
    tick: reqNum(o.tick, `${path}.tick`, { int: true, min: 0 }),
    dur_tick: reqNum(o.dur_tick, `${path}.dur_tick`, { int: true, gt: 0 }),
    pitch: reqNum(o.pitch, `${path}.pitch`, { int: true, min: 0, max: 127 }),
    velocity: optNum(o.velocity, `${path}.velocity`, 80, { int: true, min: 1, max: 127 }),
    voice: optNum(o.voice, `${path}.voice`, 1, { int: true, min: 1, max: 16 }),
    staff: optNum(o.staff, `${path}.staff`, 1, { int: true, min: 1, max: 4 }),
    tie_next: optBool(o.tie_next, `${path}.tie_next`, false),
    articulations: strList(o.articulations, `${path}.articulations`),
    ornaments: parseOrnaments(o.ornaments, `${path}.ornaments`),
    technique: parseTechnique(o.technique, `${path}.technique`),
    skill_node: skillRaw === null ? null : parseSkillNode(skillRaw, `${path}.pedagogy.skill_node`),
  };
}

function parsePartConfig(v: unknown, path: string): PartConfig {
  if (v === undefined || v === null) return { range: null, giong: null, holes: null };
  const o = reqObj(v, path);
  let range: [number, number] | null = null;
  if (o.range !== undefined && o.range !== null) {
    const r = reqArr(o.range, `${path}.range`);
    if (r.length !== 2) throw new DataError(`${path}.range`, 'cần [thấp, cao]');
    range = [reqNum(r[0], `${path}.range[0]`, { int: true }), reqNum(r[1], `${path}.range[1]`, { int: true })];
  }
  return {
    range,
    giong: optStr(o.giong, `${path}.giong`),
    holes: o.holes === undefined || o.holes === null ? null : reqNum(o.holes, `${path}.holes`, { int: true }),
  };
}

function parsePart(v: unknown, path: string): ScorePart {
  const o = reqObj(v, path);
  const notes = reqArr(o.notes, `${path}.notes`).map((n, i) => parseNote(n, `${path}.notes[${i}]`));
  notes.sort((a, b) => a.tick - b.tick || a.pitch - b.pitch);
  return {
    id: reqStr(o.id, `${path}.id`),
    instrument: reqStr(o.instrument, `${path}.instrument`),
    level: optStr(o.level, `${path}.level`) ?? 'beginner',
    role: optStr(o.role, `${path}.role`) ?? 'solo',
    config: parsePartConfig(o.instrument_config, `${path}.instrument_config`),
    notes,
  };
}

/** Kiểm và chuẩn hoá `score.vocascore.json` (`vocascore/0.1`). Ném `DataError` kèm đường dẫn trường. */
export function parseVocaScore(raw: unknown, path = 'score'): VocaScore {
  const o = reqObj(raw, path);
  const schema = reqStr(o.schema, `${path}.schema`);
  if (!schema.startsWith('vocascore/')) throw new DataError(`${path}.schema`, `schema lạ: ${schema}`);
  const parts = reqArr(o.parts, `${path}.parts`).map((p, i) => parsePart(p, `${path}.parts[${i}]`));
  if (parts.length === 0) throw new DataError(`${path}.parts`, 'cần ít nhất một part');
  const license = o.license === undefined || o.license === null ? null : reqObj(o.license, `${path}.license`);
  return {
    schema,
    id: reqStr(o.id, `${path}.id`),
    version: reqStr(o.version, `${path}.version`),
    title: optStr(o.title, `${path}.title`) ?? '',
    ppq: reqNum(o.ppq, `${path}.ppq`, { int: true, min: 24, max: 9600 }),
    tempo_map: parseTempoMap(o.tempo_map, `${path}.tempo_map`),
    meter_map: parseMeterMap(o.meter_map, `${path}.meter_map`),
    key_map: parseKeyMap(o.key_map, `${path}.key_map`),
    sections: parseSections(o.sections, `${path}.sections`),
    parts,
    license_class: license === null ? null : optStr(license.class, `${path}.license.class`),
  };
}

// ---------------------------------------------------------------- PracticeTarget

/** Kiểm `practice_targets[]` của `LessonPackage v2` (mặc định theo schema: 100 ms, 50 cent). */
export function parsePracticeTargets(raw: unknown, path = 'practice_targets'): PracticeTarget[] {
  return reqArr(raw, path).map((x, i) => {
    const p = `${path}[${i}]`;
    const o = reqObj(x, p);
    return {
      id: reqStr(o.id, `${p}.id`),
      tick: reqNum(o.tick, `${p}.tick`, { int: true, min: 0 }),
      dur_tick: reqNum(o.dur_tick, `${p}.dur_tick`, { int: true, gt: 0 }),
      target_pitch: o.target_pitch === undefined || o.target_pitch === null
        ? null
        : reqNum(o.target_pitch, `${p}.target_pitch`, { int: true, min: 0, max: 127 }),
      chord_symbol: optStr(o.chord_symbol, `${p}.chord_symbol`),
      onset_tolerance_ms: optNum(o.onset_tolerance_ms, `${p}.onset_tolerance_ms`, 100, { gt: 0, max: 500 }),
      pitch_tolerance_cents: optNum(o.pitch_tolerance_cents, `${p}.pitch_tolerance_cents`, 50, { gt: 0, max: 200 }),
    };
  });
}

/** Khi chưa có `LessonPackage`: mỗi nốt SSOT là một mục tiêu với dung sai mặc định. */
export function targetsFromPart(part: ScorePart, onsetToleranceMs = 100): PracticeTarget[] {
  return part.notes.map((n) => ({
    id: n.id,
    tick: n.tick,
    dur_tick: n.dur_tick,
    target_pitch: n.pitch,
    chord_symbol: null,
    onset_tolerance_ms: onsetToleranceMs,
    pitch_tolerance_cents: 50,
  }));
}

/** Mã đơn vị α suy từ `score.id` (VD `pn07_backup_…` → `PN07`), giống `lesson_code_for_score` (Python). */
export function lessonCodeOf(scoreId: string): string | null {
  const m = /^(pn|sa)(\d{2})(?:_|$)/.exec(scoreId);
  if (m === null) return null;
  const n = Number(m[2]);
  if (n < 1 || n > 12) return null;
  return `${m[1].toUpperCase()}${m[2]}`;
}
