/**
 * Bộ bám bản nhạc trực tuyến cho sự kiện MIDI (piano theo ký hiệu, docs/05 §5.1).
 *
 * Thuật toán (tham lam, cửa sổ trượt, O(1) trung bình mỗi sự kiện):
 * - Vị trí dự đoán của nốt SSOT `e`: `offset + rate × e.onMs`. `offset` bám theo trung vị độ lệch
 *   của vài nốt khớp gần nhất (đi theo người học khi nhanh hay chậm dần); `rate` cố định 1 khi có
 *   máy đếm nhịp, ước lượng lại bằng bình phương tối thiểu ở chế độ tự do.
 * - note-on trùng cao độ với một nốt chưa khớp trong cửa sổ ±W → khớp đúng ngay (vòng nóng);
 *   không có thì nhận nốt cùng cao độ đầu tiên trong 2 nhóm onset chưa khớp kế tiếp (khựng, đổi tempo).
 * - note-on không trùng cao độ → chờ; khi thời gian qua `t + W` thì phân giải: gần một nốt chưa
 *   khớp (ưu tiên gần thời gian, rồi gần cao độ) → nốt sai; không có → nốt thừa.
 * - Nốt SSOT thành thiếu khi người học đã chơi nốt ở onset sau nó (bị vượt), khi quá hạn chờ
 *   (`tick`), hoặc khi kết thúc lượt.
 * Dữ liệu MIDI chỉ nằm trong bộ nhớ (D-21).
 */

import type { ExpectedNote } from './clip.ts';
import type { ClockMode, MidiEvent } from './types.ts';

export interface FollowerConfig {
  windowBeats: number;
  minWindowMs: number;
  rateMin: number;
  rateMax: number;
  rateWindow: number;
  offsetWindow: number;
  onsetToleranceMs: number;
  missTimeoutBeats: number;
}

export interface PlayedNote {
  pitch: number;
  onMs: number;
  velocity: number;
  offMs: number | null;
}

export type MatchStatus = 'correct' | 'wrong' | 'missed';

export interface NoteMatch {
  status: MatchStatus;
  played: PlayedNote | null;
}

export interface ExtraNote {
  played: PlayedNote;
  /** Nốt SSOT gần nhất theo thời gian, để định vị câu và ô. */
  nearIdx: number;
}

export type HotKind = 'hit' | 'wrong' | 'miss' | 'extra';

/** Sự kiện cho vòng nóng (tô màu nốt ngay). */
export interface HotEvent {
  kind: HotKind;
  idx: number | null;
  pitch: number;
  t: number;
  timing: 'early' | 'on_time' | 'late' | null;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function lsq(pairs: { e: number; a: number }[]): { slope: number; icept: number } {
  const n = pairs.length;
  let se = 0;
  let sa = 0;
  for (const p of pairs) {
    se += p.e;
    sa += p.a;
  }
  const me = se / n;
  const ma = sa / n;
  let num = 0;
  let den = 0;
  for (const p of pairs) {
    num += (p.e - me) * (p.a - ma);
    den += (p.e - me) * (p.e - me);
  }
  const slope = den > 0 ? num / den : 1;
  return { slope, icept: ma - slope * me };
}

export class ScoreFollower {
  readonly expected: ExpectedNote[];
  readonly matches: (NoteMatch | null)[];
  readonly extras: ExtraNote[] = [];
  private readonly cfg: FollowerConfig;
  private readonly beatMs: number;
  private readonly clock: ClockMode;
  private readonly fixedStart: number | null;
  private readonly pending: PlayedNote[] = [];
  private readonly open = new Map<number, PlayedNote[]>();
  private readonly pairs: { e: number; a: number }[] = [];
  private readonly allPairs: { e: number; a: number }[] = [];
  private readonly pedalSpans: [number, number][] = [];
  private offset: number | null;
  private rate = 1;
  private lo = 0;
  private now = -Infinity;
  private pedalDown = false;
  private pedalStart = 0;
  private finished = false;

  /** Dung sai onset riêng theo id nốt (`PracticeTarget.onset_tolerance_ms`); thiếu thì dùng cấu hình chung. */
  private readonly tolerances: Map<string, number>;

  /**
   * @param expected nốt SSOT đã sắp theo thời gian (từ `buildClipIndex`)
   * @param beatMs mili giây một phách ở tempo của đoạn
   * @param clock `metronome`: biết `startMs` (đếm vào); `free`: tự ước lượng từ nốt đầu
   * @param startMs thời điểm tick 0 trên đồng hồ sự kiện (đã trừ độ trễ thiết bị), hoặc `null`
   * @param tolerances dung sai onset theo id nốt cho vòng nóng
   */
  constructor(
    expected: ExpectedNote[],
    beatMs: number,
    clock: ClockMode,
    startMs: number | null,
    cfg: FollowerConfig,
    tolerances: Map<string, number> = new Map(),
  ) {
    this.tolerances = tolerances;
    this.expected = expected;
    this.matches = new Array<NoteMatch | null>(expected.length).fill(null);
    this.beatMs = beatMs;
    this.clock = clock;
    this.fixedStart = clock === 'metronome' ? startMs : null;
    this.offset = startMs;
    this.cfg = cfg;
  }

  /** Mọi nốt có chỉ số < giá trị này đã chốt (khớp, sai hoặc thiếu). */
  get finalizedBefore(): number {
    return this.lo;
  }

  get isFinished(): boolean {
    return this.finished;
  }

  window(): number {
    return Math.max(this.cfg.minWindowMs, this.cfg.windowBeats * this.beatMs * this.rate);
  }

  private pred(e: ExpectedNote): number {
    return (this.offset ?? 0) + this.rate * e.onMs;
  }

  push(ev: MidiEvent): HotEvent[] {
    const hot: HotEvent[] = [];
    if (this.finished) return hot;
    this.now = Math.max(this.now, ev.t);
    this.advance(ev.t, hot);
    if (ev.type === 'on') {
      if (ev.velocity > 0) this.onNoteOn(ev.pitch, ev.velocity, ev.t, hot);
      else this.onNoteOff(ev.pitch, ev.t);
    } else if (ev.type === 'off') {
      this.onNoteOff(ev.pitch, ev.t);
    } else if (ev.down && !this.pedalDown) {
      this.pedalDown = true;
      this.pedalStart = ev.t;
    } else if (!ev.down && this.pedalDown) {
      this.pedalDown = false;
      this.pedalSpans.push([this.pedalStart, ev.t]);
    }
    return hot;
  }

  /**
   * Cho thời gian trôi khi không có sự kiện: chốt nốt chờ; nốt SSOT quá hạn chờ
   * (`miss_timeout_beats` phách sau vị trí dự đoán) thành thiếu.
   */
  tick(t: number): HotEvent[] {
    const hot: HotEvent[] = [];
    if (this.finished) return hot;
    this.now = Math.max(this.now, t);
    this.advance(t, hot);
    if (this.offset === null) return hot;
    const timeout = this.cfg.missTimeoutBeats * this.beatMs * this.rate;
    for (let i = this.lo; i < this.expected.length; i++) {
      if (this.matches[i] !== null) continue;
      if (this.pred(this.expected[i]) + timeout >= t) break;
      this.matches[i] = { status: 'missed', played: null };
      hot.push({ kind: 'miss', idx: i, pitch: this.expected[i].note.pitch, t, timing: null });
    }
    this.advanceLo();
    return hot;
  }

  /** Chơi tự do: coi note-on đầu tiên là nhóm onset đầu của đoạn. */
  private initOffset(t: number): void {
    const first = this.expected[this.lo];
    this.offset = first === undefined ? t : t - this.rate * first.onMs;
  }

  private onNoteOn(pitch: number, velocity: number, t: number, hot: HotEvent[]): void {
    const played: PlayedNote = { pitch, onMs: t, velocity, offMs: null };
    const list = this.open.get(pitch);
    if (list === undefined) this.open.set(pitch, [played]);
    else list.push(played);
    if (this.offset === null) this.initOffset(t);
    const w = this.window();
    // Tầng 1: nốt cùng cao độ, chưa khớp, trong ±W quanh vị trí dự đoán (gần nhất).
    // Tầng 2: không có thì nhận nốt cùng cao độ ĐẦU TIÊN trong các nhóm onset chưa khớp kế tiếp
    // (người học khựng hay đổi tempo rồi chơi tiếp), sau đó đặt lại mốc thời gian.
    const ahead = 2 * this.beatMs * this.rate;
    let best = -1;
    let bestD = Infinity;
    let tier2 = -1;
    let groups = 0;
    let lastTick = -1;
    for (let i = this.lo; i < this.expected.length; i++) {
      const e = this.expected[i];
      const pr = this.pred(e);
      if (pr > t + ahead || (pr > t + w && groups > 2)) break;
      if (this.matches[i] !== null) continue;
      if (e.note.tick !== lastTick) {
        groups++;
        lastTick = e.note.tick;
      }
      if (e.note.pitch !== pitch) continue;
      const d = Math.abs(t - pr);
      if (d <= w && d < bestD) {
        best = i;
        bestD = d;
      }
      // Đến muộn (khựng): nhận trong 2 nhóm kế tiếp. Đến sớm quá cửa sổ: chỉ nhóm đầu tiên, để nốt
      // sai trùng cao độ với nốt sau không bị khớp nhầm thành nốt đúng.
      if (tier2 < 0 && (pr <= t + w ? groups <= 2 : groups === 1)) tier2 = i;
    }
    const chosen = best >= 0 ? best : tier2;
    if (chosen >= 0) {
      this.matches[chosen] = { status: 'correct', played };
      this.recordPair(this.expected[chosen].onMs, t, best < 0);
      hot.push({ kind: 'hit', idx: chosen, pitch, t, timing: this.timingClass(chosen, t) });
      this.supersede(chosen, t, hot);
      this.advanceLo();
    } else {
      this.pending.push(played);
      hot.push({ kind: 'wrong', idx: null, pitch, t, timing: null });
    }
  }

  /** Nốt SSOT ở onset sớm hơn mà người học đã vượt qua (đã chơi nốt sau) → thiếu. */
  private supersede(j: number, t: number, hot: HotEvent[]): void {
    const w = this.window();
    const tick = this.expected[j].note.tick;
    for (let i = this.lo; i < j; i++) {
      if (this.matches[i] !== null) continue;
      const e = this.expected[i];
      if (e.note.tick < tick && t - this.pred(e) > w) {
        this.matches[i] = { status: 'missed', played: null };
        hot.push({ kind: 'miss', idx: i, pitch: e.note.pitch, t, timing: null });
      }
    }
  }

  private onNoteOff(pitch: number, t: number): void {
    const list = this.open.get(pitch);
    if (list === undefined || list.length === 0) return;
    const p = list.shift();
    if (p !== undefined) p.offMs = t;
  }

  private timingClass(i: number, t: number): 'early' | 'on_time' | 'late' {
    const nominal = this.fixedStart !== null ? this.fixedStart + this.expected[i].onMs : this.pred(this.expected[i]);
    const d = t - nominal;
    const tol = this.tolerances.get(this.expected[i].note.id) ?? this.cfg.onsetToleranceMs;
    if (d < -tol) return 'early';
    if (d > tol) return 'late';
    return 'on_time';
  }

  private recordPair(e: number, a: number, jump: boolean): void {
    if (jump) this.pairs.length = 0;
    this.pairs.push({ e, a });
    if (this.pairs.length > this.cfg.rateWindow) this.pairs.shift();
    if (this.allPairs.length < 256) this.allPairs.push({ e, a });
    if (this.clock === 'free' && this.pairs.length >= 4) {
      const span = this.pairs[this.pairs.length - 1].e - this.pairs[0].e;
      if (span >= 2 * this.beatMs) {
        const { slope } = lsq(this.pairs);
        this.rate = Math.min(this.cfg.rateMax, Math.max(this.cfg.rateMin, slope));
      }
    }
    const recent = this.pairs.slice(-this.cfg.offsetWindow).map((p) => p.a - this.rate * p.e);
    this.offset = median(recent);
  }

  private advanceLo(): void {
    while (this.lo < this.expected.length && this.matches[this.lo] !== null) this.lo++;
  }

  /** Phân giải nốt chờ đã quá cửa sổ: gần một nốt chưa khớp thì là nốt sai, không thì nốt thừa. */
  private advance(t: number, hot: HotEvent[]): void {
    const w = this.window();
    while (this.pending.length > 0 && this.pending[0].onMs + w < t) {
      const p = this.pending.shift();
      if (p !== undefined) this.resolve(p, hot);
    }
  }

  private resolve(played: PlayedNote, hot: HotEvent[]): void {
    const w = this.window();
    let best = -1;
    let bestDt = Infinity;
    let bestDp = Infinity;
    let near = -1;
    let nearD = Infinity;
    for (let i = this.lo; i < this.expected.length; i++) {
      const e = this.expected[i];
      const pr = this.pred(e);
      const dt = Math.abs(played.onMs - pr);
      if (dt < nearD) {
        near = i;
        nearD = dt;
      }
      if (pr > played.onMs + w) break;
      if (this.matches[i] !== null || pr < played.onMs - w) continue;
      const dp = Math.abs(played.pitch - e.note.pitch);
      if (dt < bestDt - 1 || (Math.abs(dt - bestDt) <= 1 && dp < bestDp)) {
        best = i;
        bestDt = dt;
        bestDp = dp;
      }
    }
    if (best >= 0) {
      this.matches[best] = { status: 'wrong', played };
      hot.push({ kind: 'wrong', idx: best, pitch: played.pitch, t: played.onMs, timing: null });
      this.advanceLo();
    } else {
      this.extras.push({ played, nearIdx: Math.max(0, near >= 0 ? near : Math.min(this.lo, this.expected.length - 1)) });
      hot.push({ kind: 'extra', idx: null, pitch: played.pitch, t: played.onMs, timing: null });
    }
  }

  /** Kết thúc lượt: phân giải mọi nốt chờ, đánh dấu nốt chưa chơi là thiếu, đóng nốt còn giữ. */
  finish(endMs?: number): HotEvent[] {
    const hot: HotEvent[] = [];
    if (this.finished) return hot;
    const end = Math.max(endMs ?? this.now, this.now);
    this.now = end;
    while (this.pending.length > 0) {
      const p = this.pending.shift();
      if (p !== undefined) this.resolve(p, hot);
    }
    for (let i = this.lo; i < this.expected.length; i++) {
      if (this.matches[i] === null) {
        this.matches[i] = { status: 'missed', played: null };
        hot.push({ kind: 'miss', idx: i, pitch: this.expected[i].note.pitch, t: end, timing: null });
      }
    }
    this.advanceLo();
    for (const list of this.open.values()) for (const p of list) if (p.offMs === null) p.offMs = end;
    if (this.pedalDown) this.pedalSpans.push([this.pedalStart, end]);
    this.finished = true;
    return hot;
  }

  /** Lúc âm thanh thật sự tắt: note-off, kéo dài tới lúc nhả pedal nếu pedal đang giữ. */
  soundEnd(p: PlayedNote): number | null {
    if (p.offMs === null) return null;
    for (const [s, e] of this.pedalSpans) if (p.offMs >= s && p.offMs < e) return e;
    if (this.pedalDown && p.offMs >= this.pedalStart) return Math.max(p.offMs, this.now);
    return p.offMs;
  }

  /**
   * Đường tham chiếu (đồng hồ app) của tick 0 và tỉ lệ tempo, để đo lệch so với nhịp danh nghĩa.
   * Có máy đếm nhịp: cố định. Chơi tự do: đường Theil–Sen qua mọi nốt khớp đúng (bền với lỗi cục bộ).
   */
  reference(): { start: number; rate: number } {
    if (this.fixedStart !== null) return { start: this.fixedStart, rate: 1 };
    const ps = this.allPairs;
    if (ps.length >= 2) {
      const slopes: number[] = [];
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const de = ps[j].e - ps[i].e;
          if (de > 0) slopes.push((ps[j].a - ps[i].a) / de);
        }
      }
      const rate = slopes.length === 0 ? 1 : Math.min(this.cfg.rateMax, Math.max(this.cfg.rateMin, median(slopes)));
      return { start: median(ps.map((p) => p.a - rate * p.e)), rate };
    }
    if (ps.length === 1) return { start: ps[0].a - ps[0].e, rate: 1 };
    return { start: this.offset ?? 0, rate: 1 };
  }

  get clockMode(): ClockMode {
    return this.clock;
  }

  /** Độ lệch onset (ms) của nốt thứ `i` so với nhịp danh nghĩa; `null` nếu chưa chơi. */
  devMs(i: number): number | null {
    const m = this.matches[i];
    if (m === null || m.played === null) return null;
    const ref = this.reference();
    return m.played.onMs - (ref.start + ref.rate * this.expected[i].onMs);
  }
}
