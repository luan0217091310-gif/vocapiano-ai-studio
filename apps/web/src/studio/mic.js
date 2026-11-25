// Kết nối trực tiếp lõi dò cao độ Micro AudioWorklet + YIN + Noise Gate của WT-3 vào Practice Studio.
// Mọi xử lý chạy 100% cục bộ trên thiết bị; không ghi âm, không gửi audio lên máy chủ (D-21).
import {
  createMicNoteTracker,
  createMicPitchDetector as wt3CreateMicPitchDetector,
  createNoiseGate,
  detectPitchYIN,
} from "../../../../web-engines/practice/src/mic/index.ts";

export { createNoiseGate };

/** Ước lượng cao độ YIN độ chính xác cao từ WT-3. */
export function estimatePitch(frame, sampleRate, options = {}) {
  return detectPitchYIN(frame, sampleRate, options);
}

/** Bộ dò cao độ Micro AudioWorklet (có fallback AnalyserNode) từ WT-3. */
export async function createMicPitchDetector(context, stream, options = {}) {
  return wt3CreateMicPitchDetector(context, stream, options);
}

/**
 * Biến luồng cao độ liên tục thành sự kiện nốt on/off cho TutorSession
 * (dùng `createMicNoteTracker` chống nhảy quãng 8 & lọc đuôi vang của WT-3).
 */
export function createNoteTracker({
  onEvent,
  profile = "piano",
  centsTolerance,
}) {
  const tracker = createMicNoteTracker({
    profile,
    centsTolerance,
    emit: onEvent,
  });
  return {
    push(pitch, t) {
      tracker.push(pitch ? { ...pitch, t } : null, t);
    },
    flush(t) {
      tracker.flush(t);
    },
    get current() {
      return tracker.activePitch;
    },
    get stats() {
      return tracker.stats;
    },
  };
}

/**
 * Micro giả lập để test tự động và demo không cần quyền micro: đọc nốt kỳ vọng tại thời điểm
 * hiện tại và phát khung cao độ (có thể lệch `cents` hoặc sai `semitones`).
 */
export function createSimulatedMic({
  expectedAt,
  onPitch,
  onLevel,
  cents = 0,
  semitones = 0,
  hopMs = 23,
}) {
  let t = 0;
  const timer = setInterval(() => {
    t += hopMs;
    const note = expectedAt();
    onLevel?.(note ? 0.08 : 0.001);
    if (!note) return onPitch(null);
    const exact = note.pitch + semitones + cents / 100,
      midi = Math.round(exact);
    onPitch({
      frequency: 440 * 2 ** ((exact - 69) / 12),
      midi,
      midiFloat: exact,
      cents: Math.round((exact - midi) * 100),
      confidence: 0.95,
      rms: 0.08,
      period: 0,
      t,
    });
  }, hopMs);
  return {
    gate: { threshold: 0.003, reset() {} },
    stop: () => clearInterval(timer),
  };
}
