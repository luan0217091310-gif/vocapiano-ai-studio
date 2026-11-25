/**
 * Nạp `config/thresholds.json` và `config/lessons.json` thành đối tượng có kiểu, kiểm đủ khoá khi chạy.
 *
 * Một số ngưỡng hơi (L6, L7) không ghi cứng: mục có `from_safety` lấy giá trị từ
 * `data/safety_params.json`, tệp do `tools/export_kb_cues.py` sinh từ
 * `knowledge/safety/safety_cards.yaml` (docs/05 v2.7 §2.2 L6–L7, §5.4 mục 9).
 */

import { DataError, reqArr, reqNum, reqObj, reqStr } from './load.ts';

export interface Thresholds {
  follower: {
    windowBeats: number;
    minWindowMs: number;
    rateMin: number;
    rateMax: number;
    rateWindow: number;
    offsetWindow: number;
    onsetToleranceMs: number;
    minPhraseCoverage: number;
    missTimeoutBeats: number;
  };
  index: { phraseMaxBars: number; restMinBeats: number };
  wrongNote: {
    confSubstitution: number;
    confMissed: number;
    confExtra: number;
    shiftMinNotes: number;
    shiftMinFraction: number;
  };
  timing: {
    minOnsets: number;
    driftMs: number;
    minConcordance: number;
    longNoteBeats: number;
    earlyFraction: number;
    earlyMinMs: number;
    lateAfterRestFraction: number;
    lateMinMs: number;
    stallBeats: number;
    switchGapFraction: number;
    switchGapMinMs: number;
    switchGapMinCount: number;
  };
  handsAsync: { thresholdMs: number; minPairs: number; directionConsistency: number };
  artic: {
    legatoGapMs: number;
    legatoOkFraction: number;
    staccatoMaxRatio: number;
    staccatoOkFraction: number;
    minPairs: number;
    minStaccato: number;
  };
  dynFlat: { pMaxVelocity: number; fMinVelocity: number; minDiff: number; minNotesEach: number };
  pecking: { lessons: string[]; gapMs: number; fraction: number; minPairs: number };
  restShort: { shortenFraction: number; minMs: number; okFraction: number };
  shortNote: { longNoteBeats: number; holdRatioMin: number; nextOnTimeMs: number };
  policy: {
    minConfidence: number;
    recurWindow: number;
    recurMin: number;
    falseAlarmBudget: number;
    budgetMinReports: number;
    confidenceStep: number;
    confidenceCap: number;
    selfAssessEvery: number;
    failStreak: number;
    hintMaxPerSession: number;
    retentionMaxItems: number;
    retentionMinConfidence: number;
  };
  gen: {
    slowMinPct: number;
    slowMaxPct: number;
    splitSlowPct: number;
    ladderSteps: number[];
    ladderAdvanceAfter: number;
    loopSpanBars: number;
    subdivision: number;
    countInBars: number;
  };
  level: {
    maxBpm: number;
    saoPhraseMaxBars: number;
    saoPhraseMaxSeconds: number;
    longNoteSeconds: number;
    longNoteStreak: number;
    restMinBars: number;
    breathPauseSeconds: number;
    minDurQuarters: number;
  };
  cue: { maxSyllables: number; maxSyllablesDuringPlay: number };
}

/** Tham số an toàn hơi đọc từ `safety_cards.yaml` (qua `data/safety_params.json`). */
export interface SafetyParams {
  source: string;
  sha256: string;
  params: Record<string, number | number[]>;
}

export function parseSafetyParams(raw: unknown): SafetyParams {
  const o = reqObj(raw, 'safety_params');
  const schema = reqStr(o.schema, 'safety_params.schema');
  if (schema !== 'vocaverse.practice_safety_params/0.1') {
    throw new DataError('safety_params.schema', `schema lạ: ${schema}`);
  }
  const p = reqObj(o.params, 'safety_params.params');
  const params: Record<string, number | number[]> = {};
  for (const [k, v] of Object.entries(p)) {
    params[k] = Array.isArray(v)
      ? v.map((x, i) => reqNum(x, `safety_params.params.${k}[${i}]`))
      : reqNum(v, `safety_params.params.${k}`);
  }
  return { source: reqStr(o.source, 'safety_params.source'), sha256: reqStr(o.sha256, 'safety_params.sha256'), params };
}

type Group = Record<string, unknown>;

function entry(groups: Group, group: string, key: string): Record<string, unknown> {
  const g = reqObj(groups[group], `thresholds.groups.${group}`);
  return reqObj(g[key], `thresholds.groups.${group}.${key}`);
}

function num(groups: Group, group: string, key: string, safety: SafetyParams | null): number {
  const e = entry(groups, group, key);
  const path = `thresholds.groups.${group}.${key}`;
  if (e.from_safety !== undefined) {
    const name = reqStr(e.from_safety, `${path}.from_safety`);
    if (safety === null) throw new DataError(path, `cần data/safety_params.json để đọc ${name}`);
    const v = safety.params[name];
    if (typeof v !== 'number') throw new DataError(path, `safety_params thiếu tham số số ${name}`);
    return v;
  }
  return reqNum(e.value, `${path}.value`);
}

function list(groups: Group, group: string, key: string): unknown[] {
  return reqArr(entry(groups, group, key).value, `thresholds.groups.${group}.${key}.value`);
}

export function parseThresholds(raw: unknown, safety: SafetyParams | null): Thresholds {
  const o = reqObj(raw, 'thresholds');
  const schema = reqStr(o.schema, 'thresholds.schema');
  if (schema !== 'vocaverse.practice_thresholds/0.1') throw new DataError('thresholds.schema', `schema lạ: ${schema}`);
  const g = reqObj(o.groups, 'thresholds.groups');
  const n = (group: string, key: string): number => num(g, group, key, safety);
  return {
    follower: {
      windowBeats: n('follower', 'window_beats'),
      minWindowMs: n('follower', 'min_window_ms'),
      rateMin: n('follower', 'rate_min'),
      rateMax: n('follower', 'rate_max'),
      rateWindow: n('follower', 'rate_window'),
      offsetWindow: n('follower', 'offset_window'),
      onsetToleranceMs: n('follower', 'onset_tolerance_ms'),
      minPhraseCoverage: n('follower', 'min_phrase_coverage'),
      missTimeoutBeats: n('follower', 'miss_timeout_beats'),
    },
    index: { phraseMaxBars: n('index', 'phrase_max_bars'), restMinBeats: n('index', 'rest_min_beats') },
    wrongNote: {
      confSubstitution: n('wrong_note', 'conf_substitution'),
      confMissed: n('wrong_note', 'conf_missed'),
      confExtra: n('wrong_note', 'conf_extra'),
      shiftMinNotes: n('wrong_note', 'shift_min_notes'),
      shiftMinFraction: n('wrong_note', 'shift_min_fraction'),
    },
    timing: {
      minOnsets: n('timing', 'min_onsets'),
      driftMs: n('timing', 'drift_ms'),
      minConcordance: n('timing', 'min_concordance'),
      longNoteBeats: n('timing', 'long_note_beats'),
      earlyFraction: n('timing', 'early_fraction'),
      earlyMinMs: n('timing', 'early_min_ms'),
      lateAfterRestFraction: n('timing', 'late_after_rest_fraction'),
      lateMinMs: n('timing', 'late_min_ms'),
      stallBeats: n('timing', 'stall_beats'),
      switchGapFraction: n('timing', 'switch_gap_fraction'),
      switchGapMinMs: n('timing', 'switch_gap_min_ms'),
      switchGapMinCount: n('timing', 'switch_gap_min_count'),
    },
    handsAsync: {
      thresholdMs: n('hands_async', 'threshold_ms'),
      minPairs: n('hands_async', 'min_pairs'),
      directionConsistency: n('hands_async', 'direction_consistency'),
    },
    artic: {
      legatoGapMs: n('artic', 'legato_gap_ms'),
      legatoOkFraction: n('artic', 'legato_ok_fraction'),
      staccatoMaxRatio: n('artic', 'staccato_max_ratio'),
      staccatoOkFraction: n('artic', 'staccato_ok_fraction'),
      minPairs: n('artic', 'min_pairs'),
      minStaccato: n('artic', 'min_staccato'),
    },
    dynFlat: {
      pMaxVelocity: n('dyn_flat', 'p_max_velocity'),
      fMinVelocity: n('dyn_flat', 'f_min_velocity'),
      minDiff: n('dyn_flat', 'min_diff'),
      minNotesEach: n('dyn_flat', 'min_notes_each'),
    },
    pecking: {
      lessons: list(g, 'pecking', 'lessons').map((x, i) => reqStr(x, `pecking.lessons[${i}]`)),
      gapMs: n('pecking', 'gap_ms'),
      fraction: n('pecking', 'fraction'),
      minPairs: n('pecking', 'min_pairs'),
    },
    restShort: {
      shortenFraction: n('rest_short', 'shorten_fraction'),
      minMs: n('rest_short', 'min_ms'),
      okFraction: n('rest_short', 'ok_fraction'),
    },
    shortNote: {
      longNoteBeats: n('short_note', 'long_note_beats'),
      holdRatioMin: n('short_note', 'hold_ratio_min'),
      nextOnTimeMs: n('short_note', 'next_on_time_ms'),
    },
    policy: {
      minConfidence: n('policy', 'min_confidence'),
      recurWindow: n('policy', 'recur_window'),
      recurMin: n('policy', 'recur_min'),
      falseAlarmBudget: n('policy', 'false_alarm_budget'),
      budgetMinReports: n('policy', 'budget_min_reports'),
      confidenceStep: n('policy', 'confidence_step'),
      confidenceCap: n('policy', 'confidence_cap'),
      selfAssessEvery: n('policy', 'self_assess_every'),
      failStreak: n('policy', 'fail_streak'),
      hintMaxPerSession: n('policy', 'hint_max_per_session'),
      retentionMaxItems: n('policy', 'retention_max_items'),
      retentionMinConfidence: n('policy', 'retention_min_confidence'),
    },
    gen: {
      slowMinPct: n('gen', 'slow_min_pct'),
      slowMaxPct: n('gen', 'slow_max_pct'),
      splitSlowPct: n('gen', 'split_slow_pct'),
      ladderSteps: list(g, 'gen', 'ladder_steps').map((x, i) => reqNum(x, `gen.ladder_steps[${i}]`)),
      ladderAdvanceAfter: n('gen', 'ladder_advance_after'),
      loopSpanBars: n('gen', 'loop_span_bars'),
      subdivision: n('gen', 'subdivision'),
      countInBars: n('gen', 'count_in_bars'),
    },
    level: {
      maxBpm: n('level', 'max_bpm'),
      saoPhraseMaxBars: n('level', 'sao_phrase_max_bars'),
      saoPhraseMaxSeconds: n('level', 'sao_phrase_max_seconds'),
      longNoteSeconds: n('level', 'long_note_seconds'),
      longNoteStreak: n('level', 'long_note_streak'),
      restMinBars: n('level', 'rest_min_bars'),
      breathPauseSeconds: n('level', 'breath_pause_seconds'),
      minDurQuarters: n('level', 'min_dur_quarters'),
    },
    cue: {
      maxSyllables: n('cue', 'max_syllables'),
      maxSyllablesDuringPlay: n('cue', 'max_syllables_during_play'),
    },
  };
}

export interface LessonConfig {
  retentionUnits: string[];
  speakerByInstrument: Record<string, string>;
  objectives: Record<string, string[]>;
  defaultExercise: Record<string, string>;
  phrases: { unclear: string; selfAssess: string; split: string; rest: string };
  cueStatus: { release: string[]; dev: string[] };
}

function strMap(v: unknown, path: string): Record<string, string> {
  const o = reqObj(v, path);
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(o)) out[k] = reqStr(x, `${path}.${k}`);
  return out;
}

export function parseLessonConfig(raw: unknown): LessonConfig {
  const o = reqObj(raw, 'lessons');
  if (reqStr(o.schema, 'lessons.schema') !== 'vocaverse.practice_lessons/0.1') {
    throw new DataError('lessons.schema', 'schema lạ');
  }
  const objectivesRaw = reqObj(reqObj(o.objectives, 'lessons.objectives').value, 'lessons.objectives.value');
  const objectives: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(objectivesRaw)) {
    objectives[k] = reqArr(v, `lessons.objectives.${k}`).map((x, i) => reqStr(x, `lessons.objectives.${k}[${i}]`));
  }
  const phrases = strMap(reqObj(o.system_phrases, 'lessons.system_phrases').value, 'lessons.system_phrases.value');
  return {
    retentionUnits: reqArr(reqObj(o.retention_units, 'lessons.retention_units').value, 'lessons.retention_units.value')
      .map((x, i) => reqStr(x, `lessons.retention_units[${i}]`)),
    speakerByInstrument: strMap(reqObj(o.speaker_by_instrument, 'lessons.speaker_by_instrument').value, 'lessons.speaker_by_instrument.value'),
    objectives,
    defaultExercise: strMap(reqObj(o.default_exercise, 'lessons.default_exercise').value, 'lessons.default_exercise.value'),
    phrases: {
      unclear: reqStr(phrases.unclear, 'lessons.system_phrases.unclear'),
      selfAssess: reqStr(phrases.self_assess, 'lessons.system_phrases.self_assess'),
      split: reqStr(phrases.split, 'lessons.system_phrases.split'),
      rest: reqStr(phrases.rest, 'lessons.system_phrases.rest'),
    },
    cueStatus: (() => {
      const v = reqObj(reqObj(o.cue_status_allowed, 'lessons.cue_status_allowed').value, 'lessons.cue_status_allowed.value');
      const list = (k: string): string[] => reqArr(v[k], `lessons.cue_status_allowed.${k}`).map((x, i) => reqStr(x, `cue_status_allowed.${k}[${i}]`));
      return { release: list('release'), dev: list('dev') };
    })(),
  };
}
