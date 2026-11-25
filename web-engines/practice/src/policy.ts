/**
 * Chính sách phản hồi (docs/05 v2.7 §5.4; D-19, D-37):
 * 1. Thứ tự ưu tiên: an toàn → mục tiêu của bài → mạch → nốt, nhịp → còn lại.
 * 2. Một nhận xét mỗi câu nhạc (màu nốt do vòng nóng lo).
 * 3. Thang can thiệp: nhắc → làm mẫu, nghe so sánh → chia nhỏ, hạ tempo → đổi bài tập → gợi ý nghỉ;
 *    hỏng `fail_streak` (5) lượt liên tiếp thì chia nhỏ hoặc gợi ý nghỉ.
 * 4. Chặn báo sai: độ tin cậy ≥ ngưỡng và lỗi lặp ≥ 2/3 lượt; ngân sách báo sai là tham số
 *    (người học bấm "Máy chấm sai" quá ngân sách thì siết ngưỡng tin cậy).
 * 5. Cứ `self_assess_every` lượt thì hỏi người học tự đánh giá trước, giữ nhận xét lại tới khi trả lời.
 * 8. Bài kiểm tra lưu giữ: không phản hồi khi đang chơi; phản hồi và bài ôn sau khi chấm.
 * 9. `SAO.ERR.SHORT_NOTE`: ở bậc "chia nhỏ, hạ tempo" chỉ chia câu, không hạ tempo.
 * Điểm, nhận xét là phản hồi tham khảo, không xếp hạng (D-30, D-37).
 */

import type { LessonConfig, Thresholds } from './config.ts';
import { PIANO_MIDI_ERROR_CODES } from './types.ts';
import type { Detection, PracticeMode } from './types.ts';

export const LADDER = ['remind', 'demo_compare', 'split_slow', 'change_exercise', 'suggest_rest'] as const;
export type LadderStep = (typeof LADDER)[number];

export interface PlannedAction {
  kind: 'gen' | 'ex' | 'demo' | 'rest';
  id: string;
  params: Record<string, number | string | boolean>;
}

export type FeedbackKind = 'comment' | 'hint' | 'unclear' | 'safety' | 'escalation';

export interface FeedbackItem {
  kind: FeedbackKind;
  phrase: number | null;
  code: string | null;
  /** 0 an toàn · 1 mục tiêu của bài · 2 mạch · 3 nốt, nhịp · 4 còn lại. */
  rank: number;
  step: LadderStep | null;
  detection: Detection | null;
  /** Ngữ cảnh đã lặp ≥ 2/3 lượt (VD chiều lệch tay), dùng để chọn câu. */
  situations: string[];
  actions: PlannedAction[];
  scoring: boolean;
}

export interface AttemptOutcome {
  attempt: number;
  passed: boolean;
  /** `true`: app hỏi người học tự đánh giá trước, rồi mới đưa `held`. */
  selfAssess: boolean;
  held: FeedbackItem[];
  escalation: FeedbackItem | null;
  /** Điểm chỉ để tham khảo (D-37). */
  referenceOnly: true;
}

interface Current {
  passage: string;
  attempt: number;
  selfAssess: boolean;
  held: FeedbackItem[];
  detections: Detection[];
  stopped: boolean;
}

const SAO_SHORT_NOTE = 'SAO.ERR.SHORT_NOTE';
const TIMING_CODES = new Set(['PNO.ERR.RUSH', 'PNO.ERR.DRAG', 'PNO.ERR.REST_SHORT', 'PNO.ERR.SHORT_NOTE']);

function codeOrder(code: string): number {
  const i = (PIANO_MIDI_ERROR_CODES as readonly string[]).indexOf(code);
  return i < 0 ? 99 : i;
}

export class FeedbackPolicy {
  readonly lesson: string | null;
  readonly mode: PracticeMode;
  private readonly th: Thresholds;
  private readonly cfg: LessonConfig;
  private readonly history = new Map<string, Map<string, Set<string>>[]>();
  private readonly levels = new Map<string, number>();
  private readonly failStreak = new Map<string, number>();
  private readonly splitGiven = new Set<string>();
  private attempts = 0;
  private reported = 0;
  private disputed = 0;
  private boost = 0;
  private hints = 0;
  private cur: Current | null = null;

  constructor(th: Thresholds, cfg: LessonConfig, lesson: string | null, mode: PracticeMode) {
    this.th = th;
    this.cfg = cfg;
    this.lesson = lesson;
    this.mode = mode;
  }

  get effectiveMinConfidence(): number {
    return this.th.policy.minConfidence + this.boost;
  }

  get falseAlarmRate(): number {
    return this.reported === 0 ? 0 : this.disputed / this.reported;
  }

  objectives(): string[] {
    return this.lesson === null ? [] : this.cfg.objectives[this.lesson] ?? [];
  }

  rankOf(d: Detection): number {
    if (d.aspect === 'safety') return 0;
    if (this.objectives().includes(d.code)) return 1;
    if (d.aspect === 'flow') return 2;
    if (d.aspect === 'pitch' || d.aspect === 'rhythm') return 3;
    return 4;
  }

  beginAttempt(passage: string): { attempt: number; selfAssess: boolean } {
    this.attempts++;
    const selfAssess = this.mode === 'practice' && this.attempts % this.th.policy.selfAssessEvery === 0;
    this.cur = { passage, attempt: this.attempts, selfAssess, held: [], detections: [], stopped: false };
    return { attempt: this.attempts, selfAssess };
  }

  private hintAllowed(): boolean {
    return this.lesson !== null && this.th.pecking.lessons.includes(this.lesson) && this.hints < this.th.policy.hintMaxPerSession;
  }

  private deliver(item: FeedbackItem): FeedbackItem | null {
    const cur = this.cur;
    if (cur === null) return null;
    if (this.mode === 'retention' || cur.selfAssess) {
      cur.held.push(item);
      return null;
    }
    if (item.kind === 'comment' || item.kind === 'hint') this.reported++;
    return item;
  }

  /**
   * Gọi khi một câu nhạc đã chốt. Trả tối đa MỘT nhận xét (hoặc `null`).
   * `quality`: `ok`; `unclear` (độ phủ thấp → "Mình chưa nghe rõ"); `not_played` (bỏ qua).
   */
  phraseEnd(phrase: number, detections: Detection[], quality: 'ok' | 'unclear' | 'not_played'): FeedbackItem | null {
    const cur = this.cur;
    if (cur === null || cur.stopped || quality === 'not_played') return null;
    const mine = detections.filter((d) => d.phrase === phrase);
    cur.detections.push(...mine);
    const key = `${cur.passage}|${phrase}`;
    const minConf = this.effectiveMinConfidence;
    const kept = mine.filter((d) => d.confidence >= minConf && (d.scoring || this.hintAllowed()));

    const rec = new Map<string, Set<string>>();
    for (const d of kept) {
      const tags = rec.get(d.code) ?? new Set<string>();
      for (const t of d.tags) tags.add(t);
      rec.set(d.code, tags);
    }
    const hist = this.history.get(key) ?? [];
    hist.push(rec);
    while (hist.length > this.th.policy.recurWindow) hist.shift();
    this.history.set(key, hist);
    for (const lk of [...this.levels.keys()]) {
      if (lk.startsWith(`${key}|`) && !rec.has(lk.slice(key.length + 1))) this.levels.delete(lk);
    }

    if (quality === 'unclear') {
      return this.deliver({ kind: 'unclear', phrase, code: null, rank: 3, step: null, detection: null, situations: [], actions: [], scoring: false });
    }
    const times = (code: string): number => hist.filter((h) => h.has(code)).length;
    const eligible = kept.filter((d) => times(d.code) >= this.th.policy.recurMin);
    if (eligible.length === 0) return null;
    eligible.sort((a, b) => this.rankOf(a) - this.rankOf(b) || b.confidence - a.confidence || codeOrder(a.code) - codeOrder(b.code));
    const d = eligible[0];
    const situations = d.tags.filter((t) => hist.filter((h) => h.get(d.code)?.has(t) === true).length >= this.th.policy.recurMin);
    const levelKey = `${key}|${d.code}`;
    const level = this.levels.get(levelKey) ?? 0;
    this.levels.set(levelKey, level + 1);
    const step: LadderStep = d.scoring ? LADDER[Math.min(level, LADDER.length - 1)] : 'remind';
    if (!d.scoring) this.hints++;
    return this.deliver({
      kind: d.scoring ? 'comment' : 'hint',
      phrase,
      code: d.code,
      rank: this.rankOf(d),
      step,
      detection: d,
      situations,
      actions: this.actionsFor(d.code, d.bar, step),
      scoring: d.scoring,
    });
  }

  /** Hành động theo bậc thang can thiệp (docs/05 §5.4 mục 3, mục 9; §5.5 cột "Bài sửa"). */
  actionsFor(code: string | null, bar: number, step: LadderStep): PlannedAction[] {
    const instrument = code !== null && code.startsWith('SAO.') ? 'sao_truc' : 'piano';
    switch (step) {
      case 'remind':
        return [];
      case 'demo_compare':
        return [{ kind: 'demo', id: 'demo', params: { bar } }];
      case 'split_slow': {
        if (code === SAO_SHORT_NOTE) {
          // Lỗi trường độ hơi: chỉ chia câu ngắn hơn, KHÔNG hạ tempo.
          return [{ kind: 'gen', id: 'gen.loop', params: { bar, split: true, tempoPct: 100 } }];
        }
        const acts: PlannedAction[] = [
          { kind: 'gen', id: 'gen.loop', params: { bar } },
          { kind: 'gen', id: 'gen.slow', params: { pct: this.th.gen.splitSlowPct } },
        ];
        if (code === 'PNO.ERR.WRONG_NOTE') acts.push({ kind: 'gen', id: 'gen.tempo_ladder', params: {} });
        if (code !== null && TIMING_CODES.has(code)) acts.push({ kind: 'gen', id: 'gen.subdivide', params: {} });
        if (code === 'PNO.ERR.HANDS_ASYNC') acts.push({ kind: 'gen', id: 'gen.hands_split', params: {} });
        return acts;
      }
      case 'change_exercise':
        // Bài tập cụ thể lấy theo cột `do` của câu được chọn (session.ts); đây là mặc định theo nhạc cụ.
        return [{ kind: 'ex', id: this.cfg.defaultExercise[instrument] ?? 'ex.five_finger', params: { fromCue: true } }];
      case 'suggest_rest':
        return [{ kind: 'rest', id: 'rest', params: {} }];
    }
  }

  /** Sự kiện an toàn (nút "Đau/tê", "Chóng mặt", hết giờ tập…): ưu tiên 0, dừng lượt. */
  safety(code: string): FeedbackItem {
    if (this.cur !== null) this.cur.stopped = true;
    return { kind: 'safety', phrase: null, code, rank: 0, step: null, detection: null, situations: [], actions: [{ kind: 'rest', id: code, params: { stop: true } }], scoring: false };
  }

  /** Kết thúc lượt: đếm lượt hỏng liên tiếp, gom nhận xét giữ lại (tự đánh giá, bài kiểm tra). */
  endAttempt(passed: boolean): AttemptOutcome {
    const cur = this.cur;
    if (cur === null) throw new Error('chưa beginAttempt');
    this.cur = null;
    const streak = passed ? 0 : (this.failStreak.get(cur.passage) ?? 0) + 1;
    this.failStreak.set(cur.passage, streak);
    let escalation: FeedbackItem | null = null;
    if (streak >= this.th.policy.failStreak && this.mode === 'practice') {
      const code = this.dominantCode(cur.passage);
      const bar = cur.detections.find((d) => d.code === code)?.bar ?? 1;
      // Đã chia nhỏ rồi (bậc thang ≥ "chia nhỏ" hoặc lần leo thang trước) thì gợi ý nghỉ.
      let maxLevel = 0;
      for (const [k, v] of this.levels) if (k.startsWith(`${cur.passage}|`)) maxLevel = Math.max(maxLevel, v);
      const alreadySplit = this.splitGiven.has(cur.passage) || maxLevel > LADDER.indexOf('split_slow');
      const step: LadderStep = alreadySplit ? 'suggest_rest' : 'split_slow';
      this.splitGiven.add(cur.passage);
      escalation = { kind: 'escalation', phrase: null, code, rank: 1, step, detection: null, situations: [], actions: this.actionsFor(code, bar, step), scoring: false };
      this.failStreak.set(cur.passage, 0);
    }
    const held = [...cur.held];
    if (this.mode === 'retention') {
      // Một lượt duy nhất nên không dùng luật 2/3; dùng ngưỡng tin cậy cao hơn và giới hạn số nhận xét.
      const best = new Map<string, Detection>();
      for (const d of cur.detections) {
        if (!d.scoring || d.confidence < this.th.policy.retentionMinConfidence) continue;
        const k = `${d.phrase}|${d.code}`;
        const old = best.get(k);
        if (old === undefined || d.confidence > old.confidence) best.set(k, d);
      }
      const items = [...best.values()]
        .sort((a, b) => this.rankOf(a) - this.rankOf(b) || a.phrase - b.phrase || codeOrder(a.code) - codeOrder(b.code))
        .slice(0, this.th.policy.retentionMaxItems)
        .map((d): FeedbackItem => ({
          kind: 'comment', phrase: d.phrase, code: d.code, rank: this.rankOf(d), step: 'remind', detection: d,
          situations: d.tags, actions: [{ kind: 'gen', id: 'gen.loop', params: { bar: d.bar, review: true } }], scoring: true,
        }));
      held.push(...items);
    }
    return { attempt: cur.attempt, passed, selfAssess: cur.selfAssess, held, escalation, referenceOnly: true };
  }

  private dominantCode(passage: string): string | null {
    const count = new Map<string, number>();
    for (const [key, hist] of this.history) {
      if (!key.startsWith(`${passage}|`)) continue;
      for (const rec of hist) for (const code of rec.keys()) count.set(code, (count.get(code) ?? 0) + 1);
    }
    let best: string | null = null;
    let n = 0;
    for (const [code, c] of count) {
      if (c > n || (c === n && best !== null && codeOrder(code) < codeOrder(best))) {
        best = code;
        n = c;
      }
    }
    return best;
  }

  /** Người học bấm "Máy chấm sai": vượt ngân sách báo sai thì siết ngưỡng tin cậy một bậc. */
  markDisputed(): void {
    this.disputed++;
    const p = this.th.policy;
    if (this.reported >= p.budgetMinReports && this.disputed / this.reported > p.falseAlarmBudget) {
      this.boost = Math.min(p.confidenceCap - p.minConfidence, this.boost + p.confidenceStep);
      this.reported = 0;
      this.disputed = 0;
    }
  }
}

/** Sau khi người học tự đánh giá: đưa nhận xét giữ lại, câu người học đã chỉ ra lên trước. */
export function confirmSelfAssessment(held: FeedbackItem[], learnerPhrase: number | null): { items: FeedbackItem[]; learnerNoticed: boolean } {
  const items = [...held].sort((a, b) => Number(b.phrase === learnerPhrase) - Number(a.phrase === learnerPhrase));
  return { items, learnerNoticed: learnerPhrase !== null && held.some((h) => h.phrase === learnerPhrase) };
}
