/**
 * Phiên gia sư 1-1 trên thiết bị: nối bộ bám bản nhạc → bộ phát hiện lỗi → chính sách phản hồi →
 * chọn câu và điền slot. Không gọi máy chủ, không chạy mô hình ngôn ngữ (D-21); MIDI chỉ ở bộ nhớ.
 *
 * Luồng một lượt: `startAttempt` → `push(ev)` cho từng sự kiện MIDI (trả màu nốt ngay và tối đa một
 * nhận xét khi một câu nhạc chốt) → `endAttempt` (nhận xét hoãn, câu hỏi tự đánh giá, bậc thang
 * khi hỏng nhiều lượt, phản hồi sau bài kiểm tra lưu giữ).
 */

import { buildClipIndex, clipFromScore } from './clip.ts';
import type { Clip, ClipIndex } from './clip.ts';
import type { LessonConfig, Thresholds } from './config.ts';
import { countSpokenSyllables, findBareTokens, selectAndFill } from './cues.ts';
import type { CueLibrary, CuePhase, FillOptions } from './cues.ts';
import { runPianoDetectors } from './detectors.ts';
import { ScoreFollower } from './follower.ts';
import type { HotEvent } from './follower.ts';
import { lessonCodeOf } from './load.ts';
import { FeedbackPolicy } from './policy.ts';
import type { AttemptOutcome, FeedbackItem } from './policy.ts';
import { beatMsAt } from './timing.ts';
import type { ClockMode, Detection, MidiEvent, PracticeMode, PracticeTarget, VocaScore } from './types.ts';

export interface TutorData {
  th: Thresholds;
  lessons: LessonConfig;
  cues: CueLibrary;
}

export interface SessionOptions {
  score: VocaScore;
  data: TutorData;
  partId?: string;
  /** Mã đơn vị (VD `PN05`); mặc định suy từ `score.id`. */
  lesson?: string | null;
  /** Mặc định: `retention` nếu đơn vị là bài kiểm tra lưu giữ. */
  mode?: PracticeMode;
  /** `metronome` (mặc định, có đếm vào) hoặc `free`. */
  clock?: ClockMode;
  /** `true`: chỉ dùng câu của thẻ đã ký `approved` (bản phát hành). */
  release?: boolean;
  /** Pha chọn câu; mặc định `after_check` với bài kiểm tra, `practice` với bài thường. */
  phase?: CuePhase;
}

export interface Spoken {
  item: FeedbackItem;
  text: string | null;
  cueUid: string | null;
  cardRef: string | null;
  failReason: string | null;
}

export interface AttemptReport {
  /** Số mục tiêu sai, trễ hoặc thiếu theo ô gốc, mỗi nốt đếm một lần. */
  barErrors?: Record<number, number>;
  outcome: AttemptOutcome;
  detections: Detection[];
  /** Nhận xét đọc sau lượt (hoãn vì quá dài để nói khi đang chơi; hoặc sau bài kiểm tra). */
  spoken: Spoken[];
  /** Câu hỏi tự đánh giá (docs/05 §5.4 mục 5); có thì app hỏi trước rồi mới đưa `held`. */
  selfAssessPrompt: string | null;
  held: Spoken[];
  escalation: Spoken | null;
  /** Số đo tham khảo (D-37), không xếp hạng. */
  accuracy: { notes: number; correct: number; wrong: number; missed: number; extra: number; referenceOnly: true };
}

interface Running {
  late: Set<number>;
  clip: Clip;
  idx: ClipIndex;
  follower: ScoreFollower;
  done: boolean[];
  firstIdx: number[];
  lastIdx: number[];
  detections: Detection[];
  deferred: FeedbackItem[];
}

export class TutorSession {
  readonly full: Clip;
  readonly lesson: string | null;
  readonly mode: PracticeMode;
  readonly clock: ClockMode;
  readonly policy: FeedbackPolicy;
  readonly phase: CuePhase;
  private readonly data: TutorData;
  private readonly allowedStatus: string[];
  private cur: Running | null = null;

  constructor(opts: SessionOptions) {
    this.data = opts.data;
    this.full = clipFromScore(opts.score, opts.partId);
    this.lesson = opts.lesson === undefined ? lessonCodeOf(opts.score.id) : opts.lesson;
    const isCheck = this.lesson !== null && opts.data.lessons.retentionUnits.includes(this.lesson);
    this.mode = opts.mode ?? (isCheck ? 'retention' : 'practice');
    this.clock = opts.clock ?? 'metronome';
    this.phase = opts.phase ?? (this.mode === 'retention' ? 'after_check' : 'practice');
    this.allowedStatus = opts.release === true ? opts.data.lessons.cueStatus.release : opts.data.lessons.cueStatus.dev;
    this.policy = new FeedbackPolicy(opts.data.th, opts.data.lessons, this.lesson, this.mode);
  }

  get speaker(): string {
    return this.data.lessons.speakerByInstrument[this.full.instrument] ?? 'idol.minh_an';
  }

  /**
   * Bắt đầu một lượt trên cả bài hoặc trên clip bài sửa (`gen.*`). `targets` (`LessonPackage v2`
   * `practice_targets[]`) cho dung sai onset riêng từng nốt ở vòng nóng.
   */
  startAttempt(opts: { clip?: Clip; startMs?: number | null; targets?: PracticeTarget[] } = {}): { attempt: number; selfAssess: boolean } {
    const clip = opts.clip ?? this.full;
    const th = this.data.th;
    const idx = buildClipIndex(clip, th.index);
    const beatMs = beatMsAt(idx.tm, clip.meter_map, 0);
    const startMs = opts.startMs === undefined ? null : opts.startMs;
    const tolerances = new Map((opts.targets ?? []).map((t) => [t.id, t.onset_tolerance_ms]));
    const follower = new ScoreFollower(idx.expected, beatMs, this.clock, this.clock === 'metronome' ? startMs : null, th.follower, tolerances);
    const firstIdx = idx.phrases.map(() => Infinity);
    const lastIdx = idx.phrases.map(() => -1);
    for (const e of idx.expected) {
      firstIdx[e.phrase] = Math.min(firstIdx[e.phrase], e.idx);
      lastIdx[e.phrase] = Math.max(lastIdx[e.phrase], e.idx);
    }
    this.cur = { late: new Set(), clip, idx, follower, done: idx.phrases.map(() => false), firstIdx, lastIdx, detections: [], deferred: [] };
    return this.policy.beginAttempt(`${clip.bars[0]}-${clip.bars[1]}`);
  }

  private running(): Running {
    if (this.cur === null) throw new Error('chưa startAttempt');
    return this.cur;
  }

  push(ev: MidiEvent): { hot: HotEvent[]; spoken: Spoken[] } {
    const r = this.running();
    const hot = r.follower.push(ev);
    for (const hit of hot) if (hit.idx !== null && hit.timing === 'late') r.late.add(hit.idx);
    const spoken = this.processReady(r, false);
    // Bài kiểm tra lưu giữ: không phản hồi khi đang chơi, kể cả màu nốt (docs/05 §5.4 mục 8).
    return this.mode === 'retention' ? { hot: [], spoken: [] } : { hot, spoken };
  }

  /** Thời gian trôi không có sự kiện (người học dừng): chốt nốt quá hạn. */
  tick(t: number): { hot: HotEvent[]; spoken: Spoken[] } {
    const r = this.running();
    const hot = r.follower.tick(t);
    const spoken = this.processReady(r, false);
    return this.mode === 'retention' ? { hot: [], spoken: [] } : { hot, spoken };
  }

  private quality(r: Running, p: number): 'ok' | 'unclear' | 'not_played' {
    let total = 0;
    let matched = 0;
    for (let i = r.firstIdx[p]; i <= r.lastIdx[p]; i++) {
      total++;
      const m = r.follower.matches[i];
      if (m !== null && m.status !== 'missed') matched++;
    }
    const extras = r.follower.extras.filter((x) => r.idx.expected[x.nearIdx]?.phrase === p).length;
    if (matched === 0 && extras === 0) return 'not_played';
    return total === 0 || matched / total < this.data.th.follower.minPhraseCoverage ? 'unclear' : 'ok';
  }

  private processReady(r: Running, final: boolean): Spoken[] {
    const out: Spoken[] = [];
    const fin = r.follower.finalizedBefore;
    const last = r.idx.phrases.length - 1;
    for (let p = 0; p <= last; p++) {
      if (r.done[p]) continue;
      const ready = final || (fin > r.lastIdx[p] && (p === last || fin > r.firstIdx[p + 1]));
      if (!ready) break;
      r.done[p] = true;
      const q = this.quality(r, p);
      const dets = q === 'ok' && r.clip.instrument === 'piano'
        ? runPianoDetectors({ idx: r.idx, follower: r.follower, th: this.data.th, lesson: this.lesson, phrases: [p] })
        : [];
      r.detections.push(...dets);
      const item = this.policy.phraseEnd(p, dets, q);
      if (item === null) continue;
      const duringPlay = !final && p < last;
      const s = this.speak(item, duringPlay);
      if (s.text === null && duringPlay && s.failReason !== null && s.failReason.startsWith('too_long')) r.deferred.push(item);
      else out.push(s);
    }
    return out;
  }

  private fillOptions(duringPlay: boolean): FillOptions {
    const c = this.data.th.cue;
    return { duringPlay, maxSyllables: c.maxSyllables, maxSyllablesDuringPlay: c.maxSyllablesDuringPlay, forbidden: this.data.cues.forbidden };
  }

  private systemLine(item: FeedbackItem, text: string, duringPlay: boolean): Spoken {
    const limit = duringPlay ? this.data.th.cue.maxSyllablesDuringPlay : this.data.th.cue.maxSyllables;
    const bare = findBareTokens(text);
    const tooLong = countSpokenSyllables(text) > limit;
    const fail = bare.length > 0 ? `bare_token: ${bare.join(', ')}` : tooLong ? 'too_long' : null;
    return { item, text: fail === null ? text : null, cueUid: null, cardRef: null, failReason: fail };
  }

  /** Chọn câu và điền slot cho một nhận xét (câu idol chỉ từ kho câu đã xuất, không sinh tự do). */
  speak(item: FeedbackItem, duringPlay: boolean): Spoken {
    const phrases = this.data.lessons.phrases;
    if (item.kind === 'unclear') return this.systemLine(item, phrases.unclear, duringPlay);
    if (item.kind === 'escalation') return this.systemLine(item, item.step === 'suggest_rest' ? phrases.rest : phrases.split, duringPlay);
    if (item.kind === 'safety' || item.code === null || item.detection === null) {
      return { item, text: null, cueUid: null, cardRef: null, failReason: item.kind === 'safety' ? 'safety_card' : 'no_detection' };
    }
    const r = selectAndFill(
      this.data.cues,
      { code: item.code, speaker: this.speaker, lesson: this.lesson, situations: item.situations, phase: this.phase, allowedStatus: this.allowedStatus },
      item.detection.slots,
      this.fillOptions(duringPlay),
    );
    if (!r.ok) return { item, text: null, cueUid: null, cardRef: null, failReason: `${r.reason}: ${r.detail}` };
    // Bậc "đổi bài tập": theo cột `do` của câu (docs/05 §5.5 cột "Bài sửa"): ưu tiên `ex.*`,
    // không có thì `gen.*` (VD HANDS_ASYNC → gen.hands_split); không có `do` thì giữ mặc định.
    const ex = r.cue.do.find((d) => d.startsWith('ex.')) ?? r.cue.do.find((d) => d.startsWith('gen.'));
    const actions = ex === undefined
      ? item.actions
      : item.actions.map((a) => (a.kind === 'ex' && a.params.fromCue === true ? { kind: ex.startsWith('ex.') ? ('ex' as const) : ('gen' as const), id: ex, params: {} } : a));
    return { item: { ...item, actions }, text: r.text, cueUid: r.cue.uid, cardRef: r.cue.cardRef, failReason: null };
  }

  /** Sự kiện an toàn: dừng lượt ngay; lời nói lấy từ thẻ an toàn đã ký (`knowledge/safety`). */
  safety(code: string): Spoken {
    return this.speak(this.policy.safety(code), false);
  }

  endAttempt(endMs?: number): AttemptReport {
    const r = this.running();
    r.follower.finish(endMs);
    const late = this.processReady(r, true);
    const minConf = this.policy.effectiveMinConfidence;
    let correct = 0;
    let wrong = 0;
    let missed = 0;
    for (const m of r.follower.matches) {
      if (m === null || m.status === 'missed') missed++;
      else if (m.status === 'wrong') wrong++;
      else correct++;
    }
    const notes = r.follower.matches.length;
    const barErrors: Record<number, number> = {};
    for (const e of r.idx.expected) {
      if (r.follower.matches[e.idx]?.status !== 'correct' || r.late.has(e.idx))
        barErrors[e.bar] = (barErrors[e.bar] ?? 0) + 1;
    }
    const passed = !r.detections.some((d) => d.scoring && d.confidence >= minConf) && (notes === 0 || missed / notes < 0.1);
    const outcome = this.policy.endAttempt(passed);
    const spoken = [...late, ...r.deferred.map((it) => this.speak(it, false))];
    const heldSpoken = outcome.held.map((it) => this.speak(it, false));
    this.cur = null;
    const isRetention = this.mode === 'retention';
    return {
      outcome,
      barErrors,
      detections: r.detections,
      spoken: isRetention ? [...spoken, ...heldSpoken] : spoken,
      selfAssessPrompt: outcome.selfAssess ? this.data.lessons.phrases.selfAssess : null,
      held: isRetention ? [] : heldSpoken,
      escalation: outcome.escalation === null ? null : this.speak(outcome.escalation, false),
      accuracy: { notes, correct, wrong, missed, extra: r.follower.extras.length, referenceOnly: true },
    };
  }
}
