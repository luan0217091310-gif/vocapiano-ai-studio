/**
 * Bộ chuyển đổi ổn định Pitch Stream -> Onset/Offset MIDI Events (`createMicNoteTracker`).
 *
 * Hỗ trợ 2 hồ sơ nhạc cụ:
 * - `sao_truc`: đơn âm C5–C7 (MIDI 72–96, 523–2093 Hz), dung sai cao độ linh hoạt (±45 cent
 *   cho hơi Việt), chống nhảy quãng 8/bậc 3 ảo, phát hiện hụt hơi (`breathDrops`) & nốt ngân
 *   không ổn định (`unstableNotes`).
 * - `piano`: C3–C6 (MIDI 48–84, 130–1046 Hz), lọc đuôi dội âm (decay tail) để 1 nốt đánh không
 *   bị đếm nhầm thành 2 nốt, vẫn bắt chuẩn đánh lặp lại (re-attack) khi RMS vọt lên rõ rệt.
 */

import type { MidiEvent } from '../types.ts';
import type { PitchEstimate } from './yin.ts';

export type MicProfile = 'sao_truc' | 'piano';

export interface MicPitchFrame extends PitchEstimate {
  t: number;
  isVoiced?: boolean;
}

export interface MicNoteTrackerOptions {
  /** Hồ sơ nhạc cụ (`sao_truc` hoặc `piano`). */
  profile?: MicProfile;
  /** Bí danh khớp Hợp đồng B (`instrument`). */
  instrument?: MicProfile;
  emit?: (event: MidiEvent) => void;
  onEvent?: (event: MidiEvent) => void;
  onNoteOn?: (midi: number, velocity: number, timestampMs: number) => void;
  onNoteOff?: (midi: number, timestampMs: number) => void;
  /** Dung sai cao độ (cent): mặc định ±45 cent cho Sáo trúc, ±35 cent cho Piano. */
  centsTolerance?: number;
  /** Ngưỡng độ tin cậy YIN tối thiểu (mặc định 0.65). */
  minConfidence?: number;
}

export interface MicTrackerStats {
  breathDrops: number;
  unstableNotes: number;
  frames: number;
  notesEmitted: number;
  meanAbsCents: number;
}

/** Chuyển chuỗi khung cao độ thành sự kiện MIDI `on`/`off` sạch nối thẳng vào `TutorSession`. */
export function createMicNoteTracker(options: MicNoteTrackerOptions) {
  const profile: MicProfile = options.profile ?? options.instrument ?? 'piano';
  const isFlute = profile === 'sao_truc';
  const lo = isFlute ? 72 : 48; // C5 (523 Hz) cho sáo, C3 (130 Hz) cho piano
  const hi = isFlute ? 96 : 84; // C7 (2093 Hz) cho sáo, C6 (1046 Hz) cho piano
  const tolerance = options.centsTolerance ?? (isFlute ? 45 : 35);
  const minConf = options.minConfidence ?? 0.65;
  const releaseMs = isFlute ? 28 : 32;

  const emit = options.emit ?? options.onEvent ?? (() => undefined);

  let tailSuppressed = false;
  let active: number | null = null;
  let activeSince = 0;
  let lastVoiced = -Infinity;
  let candidate: number | null = null;
  let candidateCount = 0;
  let lastOffPitch: number | null = null;
  let lastOffAt = -Infinity;
  let centsSum = 0;
  let centsSq = 0;
  let centsN = 0;
  let totalAbsCents = 0;
  let totalCentsFrames = 0;
  let previousRms = 0;
  let peakRms = 0;
  let gapStart: number | null = null;
  let interruptedPitch: number | null = null;

  const stats: MicTrackerStats = {
    breathDrops: 0,
    unstableNotes: 0,
    frames: 0,
    notesEmitted: 0,
    meanAbsCents: 0,
  };

  const out = (ev: MidiEvent, sink: MidiEvent[]): void => {
    sink.push(ev);
    emit(ev);
    if (ev.type === 'on') {
      stats.notesEmitted++;
      options.onNoteOn?.(ev.pitch, ev.velocity, ev.t);
    } else if (ev.type === 'off') {
      options.onNoteOff?.(ev.pitch, ev.t);
    }
  };

  const close = (t: number, sink: MidiEvent[]): void => {
    if (active === null) return;
    out({ type: 'off', t, pitch: active }, sink);
    if (isFlute && t - activeSince > 450 && centsN > 2) {
      const sd = Math.sqrt(Math.max(0, centsSq / centsN - (centsSum / centsN) ** 2));
      if (sd > tolerance * 0.65) stats.unstableNotes++;
    }
    lastOffPitch = active;
    lastOffAt = t;
    active = null;
    centsSum = centsSq = centsN = 0;
  };

  return {
    push(frame: MicPitchFrame | null, atMs?: number): MidiEvent[] {
      const sink: MidiEvent[] = [];
      const t = frame?.t ?? atMs ?? performance.now();
      stats.frames++;

      const voiced =
        frame !== null &&
        frame.isVoiced !== false &&
        frame.confidence >= minConf &&
        frame.midi >= lo &&
        frame.midi <= hi &&
        Math.abs(frame.cents) <= tolerance;

      if (!voiced) {
        if (t - lastVoiced > 220) tailSuppressed = false;
        gapStart ??= t;
        candidate = null;
        candidateCount = 0;
        if (active !== null && t - lastVoiced >= releaseMs) {
          interruptedPitch = isFlute && lastVoiced - activeSince > 250 ? active : null;
          close(gapStart, sink);
        }
        return sink;
      }

      lastVoiced = t;
      totalAbsCents += Math.abs(frame.cents);
      totalCentsFrames++;
      stats.meanAbsCents = totalAbsCents / totalCentsFrames;

      const pitch = frame.midi;
      // Phát hiện đánh lặp lại cùng một phím piano khi biên độ RMS bật lên mạnh sau pha tắt dần.
      const reattack =
        !isFlute &&
        active === pitch &&
        t - activeSince > 65 &&
        frame.rms > previousRms * 2.2 &&
        previousRms < peakRms * 0.4;
      if (reattack) close(t, sink);

      if (active === pitch) {
        if (isFlute && gapStart !== null && t - gapStart >= 12 && t - activeSince > 250) {
          stats.breathDrops++;
        }
        gapStart = null;
        previousRms = frame.rms;
        peakRms = Math.max(peakRms, frame.rms);
        centsSum += frame.cents;
        centsSq += frame.cents * frame.cents;
        centsN++;
        candidate = null;
        candidateCount = 0;
        return sink;
      }

      if (candidate === pitch) candidateCount++;
      else {
        candidate = pitch;
        candidateCount = 1;
      }

      // Chống nhảy quãng 8 (±12 bán cung) và bội bậc 3 (±19 bán cung) thoáng qua ở nốt đang ngân.
      const harmonicJump =
        active !== null && (Math.abs(active - pitch) === 12 || Math.abs(active - pitch) === 19);
      if (candidateCount < (harmonicJump ? 4 : 2)) return sink;

      if (active !== null) close(t, sink);

      // Lọc đuôi dội âm (decay tail) cho piano: không đếm nhầm đuôi rung thành lần bấm thứ 2.
      if (
        !isFlute &&
        !reattack &&
        lastOffPitch === pitch &&
        (t - lastOffAt < 190 || tailSuppressed) &&
        frame.rms < peakRms * 0.25
      ) {
        tailSuppressed = true;
        return sink;
      }

      tailSuppressed = false;
      if (interruptedPitch === pitch && t - lastOffAt < 160) stats.breathDrops++;
      interruptedPitch = null;
      gapStart = null;
      peakRms = previousRms = frame.rms;
      active = pitch;
      activeSince = t;
      centsSum = frame.cents;
      centsSq = frame.cents * frame.cents;
      centsN = 1;

      const velocity = Math.max(1, Math.min(127, Math.round(35 + 700 * frame.rms)));
      out({ type: 'on', t, pitch, velocity }, sink);
      return sink;
    },

    flush(t: number): MidiEvent[] {
      const sink: MidiEvent[] = [];
      close(Math.max(t, lastVoiced), sink);
      candidate = null;
      candidateCount = 0;
      return sink;
    },

    reset(): void {
      active = candidate = lastOffPitch = interruptedPitch = gapStart = null;
      candidateCount = centsSum = centsSq = centsN = peakRms = previousRms = 0;
      totalAbsCents = totalCentsFrames = 0;
      stats.frames = stats.breathDrops = stats.unstableNotes = stats.notesEmitted = 0;
      stats.meanAbsCents = 0;
      tailSuppressed = false;
      lastVoiced = lastOffAt = -Infinity;
    },

    get activePitch(): number | null {
      return active;
    },

    get stats(): MicTrackerStats {
      return { ...stats };
    },
  };
}
