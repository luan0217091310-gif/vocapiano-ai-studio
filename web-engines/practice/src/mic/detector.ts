/**
 * Bộ dò cao độ Micro thời gian thực trên thiết bị (AudioWorklet + fallback AnalyserNode).
 *
 * - 100% xử lý cục bộ trên trình duyệt, KHÔNG gửi âm thanh lên máy chủ (D-21).
 * - Noise Gate tự hiệu chuẩn ồn phòng (mặc định 1 giây im lặng, hoặc truyền `noiseFloorDb`).
 * - Hỗ trợ cả 2 chữ ký gọi:
 *   1) Hợp đồng B: `createMicPitchDetector(options)` -> bộ điều khiển có `start()`, `stop()`,
 *      `calibrate()`, `processFrame()`, `dispose()` cùng `onPitch(event)`, `onNoteOn`, `onNoteOff`.
 *   2) Gắn trực tiếp vào `AudioContext` + `MediaStream`:
 *      `await createMicPitchDetector(context, stream, options)` -> trả về phiên đang chạy.
 */

import { createMicNoteTracker } from './tracker.ts';
import type { MicProfile, MicTrackerStats } from './tracker.ts';
import { detectPitchYIN } from './yin.ts';
import type { PitchEstimate, YinOptions } from './yin.ts';

/** Sự kiện cao độ chuẩn Hợp đồng B (kèm trường tương thích ngược cho `createMicNoteTracker`). */
export interface MicPitchEvent extends PitchEstimate {
  /** Mốc thời gian theo đồng hồ `performance.now()` (ms). */
  timestampMs: number;
  /** Bí danh mốc thời gian (ms). */
  t: number;
  /** Tần số cơ bản ước lượng (Hz; 0 khi im lặng/chưa có tiếng). */
  frequencyHz: number;
  /** Nốt MIDI nguyên gần nhất (0 khi im lặng). */
  nearestMidi: number;
  /** Độ lệch so với nốt gần nhất tính bằng cent (-50..+50). */
  centsOff: number;
  /** `true` khi vượt cổng ồn và dò được cao độ hợp lệ. */
  isVoiced: boolean;
}

export interface MicPitchDetectorOptions extends YinOptions {
  /** Nhạc cụ theo Hợp đồng B (`piano` | `sao_truc`). */
  instrument?: MicProfile;
  /** Bí danh nhạc cụ. */
  profile?: MicProfile;
  /** Tần số lấy mẫu mặc định khi gọi `processFrame` ngoại tuyến (mặc định 48000 Hz). */
  sampleRate?: number;
  /** Ngưỡng nền ồn phòng ban đầu theo dBFS (VD `-48`); bỏ qua nếu muốn hiệu chuẩn tự động. */
  noiseFloorDb?: number;
  /** Thời gian hiệu chuẩn tiếng ồn phòng tự động (ms; mặc định 1000 ms, 0 nếu dùng noiseFloorDb). */
  calibrationMs?: number;
  /** Kích thước khung phân tích YIN (1024 hoặc 2048 mẫu). */
  frameSize?: 1024 | 2048;
  /** Bước trượt giữa các khung (1..512 mẫu; mặc định 128 mẫu ~ 2.67 ms ở 48 kHz). */
  hopSize?: number;
  /** Dung sai cao độ cho bộ bám nốt tích hợp (cent). */
  centsTolerance?: number;
  /** AudioContext và MediaStream có sẵn (tuỳ chọn khi dùng chữ ký 1 tham số). */
  audioContext?: AudioContext;
  stream?: MediaStream;
  /** Callback đo mức âm lượng phòng theo từng khung (RMS 0..1 và dBFS). */
  onLevel?: (rms: number, db: number) => void;
  /** Callback cao độ từng khung (chế độ 3 tham số truyền `null` khi im lặng để giữ tương thích). */
  onPitch?: (event: MicPitchEvent | null, t: number) => void;
  /** Callback nốt bật (Hợp đồng B). */
  onNoteOn?: (midi: number, velocity: number, timestampMs: number) => void;
  /** Callback nốt tắt (Hợp đồng B). */
  onNoteOff?: (midi: number, timestampMs: number) => void;
}

export interface NoiseGate {
  observe(rms: number, t: number): boolean;
  recalibrate(durationMs?: number): void;
  reset(): void;
  readonly threshold: number;
  readonly thresholdDb: number;
  readonly calibrated: boolean;
}

export interface MicPitchDetectorHandle {
  readonly mode: 'worklet' | 'analyser' | 'idle';
  readonly gate: NoiseGate;
  readonly tracker: ReturnType<typeof createMicNoteTracker>;
  readonly stats: MicTrackerStats;
  start(stream?: MediaStream, context?: AudioContext): Promise<'worklet' | 'analyser'>;
  processFrame(frame: Float32Array | number[], timestampMs?: number, sampleRate?: number): MicPitchEvent;
  calibrate(durationMs?: number): void;
  stop(): void;
  dispose(): Promise<void>;
}

const MIN_RMS_FLOOR = 0.002;
const rmsToDb = (rms: number): number => 20 * Math.log10(Math.max(1e-7, rms));
const dbToRms = (db: number): number => 10 ** (db / 20);

/**
 * Cổng lọc ồn phòng (Noise Gate): đo im lặng trong `calibrationMs` (mặc định 1000 ms) để tự đặt
 * ngưỡng RMS động `max(floor, meanNoise * 2.8)`. Hỗ trợ đặt ngưỡng sẵn bằng `noiseFloorDb`.
 */
export function createNoiseGate(calibrationMs = 1000, noiseFloorDb?: number): NoiseGate {
  const baseFloor =
    noiseFloorDb !== undefined && Number.isFinite(noiseFloorDb)
      ? Math.max(MIN_RMS_FLOOR, dbToRms(noiseFloorDb))
      : MIN_RMS_FLOOR;
  let targetCalibrationMs = Math.max(0, calibrationMs);
  let start = NaN;
  let noise = 0;
  let count = 0;
  let threshold = baseFloor;
  let done = targetCalibrationMs === 0;

  return {
    observe(rms: number, t: number): boolean {
      if (targetCalibrationMs === 0) {
        done = true;
        return rms >= threshold;
      }
      if (!Number.isFinite(start)) start = t;
      if (t - start < targetCalibrationMs) {
        noise += (rms - noise) / ++count;
        threshold = Math.max(baseFloor, noise * 2.8);
        done = false;
        return false;
      }
      done = true;
      return rms >= threshold;
    },
    recalibrate(durationMs = 1000): void {
      targetCalibrationMs = Math.max(0, durationMs);
      start = NaN;
      noise = 0;
      count = 0;
      threshold = baseFloor;
      done = targetCalibrationMs === 0;
    },
    reset(): void {
      start = NaN;
      noise = 0;
      count = 0;
      threshold = baseFloor;
      done = targetCalibrationMs === 0;
    },
    get threshold(): number {
      return threshold;
    },
    get thresholdDb(): number {
      return rmsToDb(threshold);
    },
    get calibrated(): boolean {
      return done;
    },
  };
}

// Mã nguồn AudioWorklet nội tuyến: không tải tệp ngoài, độ trễ trượt đúng `hop` mẫu.
const WORKLET_SOURCE = `
class FrameProcessor extends AudioWorkletProcessor {
  constructor({ processorOptions: { size, hop } }) {
    super();
    this.frame = new Float32Array(size);
    this.used = 0;
    this.hop = hop;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (let i = 0; i < input.length; i++) {
      this.frame[this.used++] = input[i];
      if (this.used === this.frame.length) {
        const frame = this.frame.slice();
        this.port.postMessage({ frame, end: (currentFrame + i + 1) / sampleRate }, [frame.buffer]);
        this.frame.copyWithin(0, this.hop);
        this.used -= this.hop;
      }
    }
    return true;
  }
}
registerProcessor('vocaverse-mic-frame', FrameProcessor);
`;

const registrations = new WeakMap<AudioContext, Promise<void>>();
async function registerWorklet(context: AudioContext): Promise<void> {
  const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'text/javascript' }));
  try {
    await context.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function makeUnvoicedEvent(rms: number, t: number): MicPitchEvent {
  return {
    timestampMs: t,
    t,
    frequency: 0,
    frequencyHz: 0,
    midi: 0,
    nearestMidi: 0,
    midiFloat: 0,
    cents: 0,
    centsOff: 0,
    confidence: 0,
    rms,
    period: 0,
    isVoiced: false,
  };
}

function makeVoicedEvent(p: PitchEstimate, t: number): MicPitchEvent {
  return {
    ...p,
    timestampMs: t,
    t,
    frequencyHz: p.frequency,
    nearestMidi: p.midi,
    centsOff: p.cents,
    isVoiced: true,
  };
}

function createDetectorCore(
  options: MicPitchDetectorOptions,
  emitNullOnSilence: boolean,
): MicPitchDetectorHandle {
  const size = options.frameSize ?? 1024;
  const hop = options.hopSize ?? 128;
  if (![1024, 2048].includes(size) || !Number.isInteger(hop) || hop < 1 || hop > 512) {
    throw new RangeError('frameSize 1024/2048, hopSize 1–512');
  }
  const profile: MicProfile = options.profile ?? options.instrument ?? 'piano';
  const flute = profile === 'sao_truc';
  const defaultCalMs = options.calibrationMs ?? (options.noiseFloorDb !== undefined ? 0 : 1000);
  const gate = createNoiseGate(defaultCalMs, options.noiseFloorDb);
  const tracker = createMicNoteTracker({
    profile,
    centsTolerance: options.centsTolerance,
    onNoteOn: options.onNoteOn,
    onNoteOff: options.onNoteOff,
  });
  const baseLimits: YinOptions = {
    profile,
    minFrequency: flute ? 490 : 122,
    maxFrequency: profile === 'piano' ? 1120 : 2220,
    ...options,
  };

  let activeMode: 'worklet' | 'analyser' | 'idle' = 'idle';
  let activeContext: AudioContext | undefined = options.audioContext;
  let ownedContext = false;
  let ownedStream: MediaStream | undefined;
  let activeSampleRate = options.sampleRate ?? options.audioContext?.sampleRate ?? 48000;
  let cleanupGraph: (() => void) | null = null;
  let lastHz: number | null = null;

  const processFrame = (
    frame: Float32Array | number[],
    timestampMs?: number,
    sampleRateOverride?: number,
  ): MicPitchEvent => {
    const t = timestampMs ?? performance.now();
    const sr = sampleRateOverride ?? activeSampleRate;
    let energy = 0;
    for (let i = 0; i < frame.length; i++) energy += frame[i] * frame[i];
    const rms = Math.sqrt(energy / Math.max(1, frame.length));
    options.onLevel?.(rms, rmsToDb(rms));

    const pitch = gate.observe(rms, t)
      ? detectPitchYIN(frame, sr, {
          ...baseLimits,
          rmsThreshold: Math.max(baseLimits.rmsThreshold ?? MIN_RMS_FLOOR, gate.threshold),
          previousFrequency: lastHz,
        })
      : null;

    if (pitch !== null) {
      lastHz = pitch.frequency;
      const event = makeVoicedEvent(pitch, t);
      options.onPitch?.(event, t);
      if (options.onNoteOn || options.onNoteOff) tracker.push(event, t);
      return event;
    }

    lastHz = null;
    const unvoiced = makeUnvoicedEvent(rms, t);
    options.onPitch?.(emitNullOnSilence ? null : unvoiced, t);
    if (options.onNoteOn || options.onNoteOff) tracker.push(null, t);
    return unvoiced;
  };

  const stop = (): void => {
    cleanupGraph?.();
    cleanupGraph = null;
    lastHz = null;
    if (options.onNoteOn || options.onNoteOff) tracker.flush(performance.now());
  };

  const start = async (
    streamArg?: MediaStream,
    contextArg?: AudioContext,
  ): Promise<'worklet' | 'analyser'> => {
    stop();
    let stream = streamArg ?? options.stream;
    if (!stream) {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập Micro (getUserMedia).');
      }
      // Tắt khử vọng/nén tự động để giữ nguyên biên độ & hoạ âm thật của Piano và Sáo trúc.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      ownedStream = stream;
    }

    let ctx = contextArg ?? activeContext;
    if (!ctx) {
      ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: options.sampleRate });
      activeContext = ctx;
      ownedContext = true;
    }
    if (ctx.state === 'suspended') await ctx.resume();
    activeSampleRate = ctx.sampleRate;

    const source = ctx.createMediaStreamSource(stream);
    let node: AudioWorkletNode | undefined;
    if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
      try {
        if (!registrations.has(ctx)) registrations.set(ctx, registerWorklet(ctx));
        await registrations.get(ctx);
        node = new AudioWorkletNode(ctx, 'vocaverse-mic-frame', {
          processorOptions: { size, hop },
        });
      } catch {
        registrations.delete(ctx); // Trình duyệt cũ hoặc CSP chặn Blob Worklet -> dùng AnalyserNode
      }
    }

    if (node) {
      const worklet = node;
      const runCtx = ctx;
      worklet.port.onmessage = ({ data }: MessageEvent<{ frame: Float32Array; end: number }>) => {
        const t = performance.now() - (runCtx.currentTime - data.end) * 1000;
        processFrame(data.frame, t, runCtx.sampleRate);
      };
      source.connect(worklet);
      // Đầu ra của FrameProcessor im lặng hoàn toàn; nối tới destination để trình duyệt kéo process().
      worklet.connect(runCtx.destination);
      activeMode = 'worklet';
      cleanupGraph = () => {
        worklet.port.onmessage = null;
        worklet.port.close();
        source.disconnect();
        worklet.disconnect();
      };
      return 'worklet';
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = size;
    source.connect(analyser);
    const frame = new Float32Array(size);
    const runCtx = ctx;
    let last = -Infinity;
    const timer = setInterval(() => {
      const end = runCtx.currentTime;
      if (end <= last) return;
      last = end;
      analyser.getFloatTimeDomainData(frame);
      const t = performance.now() - (runCtx.currentTime - end) * 1000;
      processFrame(frame, t, runCtx.sampleRate);
    }, (1000 * hop) / runCtx.sampleRate);

    activeMode = 'analyser';
    cleanupGraph = () => {
      clearInterval(timer);
      source.disconnect();
      analyser.disconnect();
    };
    return 'analyser';
  };

  return {
    get mode() {
      return activeMode;
    },
    gate,
    tracker,
    get stats() {
      return tracker.stats;
    },
    start,
    processFrame,
    calibrate(durationMs = 1000) {
      gate.recalibrate(durationMs);
      lastHz = null;
    },
    stop,
    async dispose() {
      stop();
      if (ownedStream) {
        for (const track of ownedStream.getTracks()) track.stop();
        ownedStream = undefined;
      }
      if (ownedContext && activeContext) {
        await activeContext.close();
        activeContext = undefined;
        ownedContext = false;
      }
    },
  };
}

/** Chữ ký 1 tham số (Hợp đồng B) và chữ ký 3 tham số (truyền thẳng AudioContext + MediaStream). */
export function createMicPitchDetector(options?: MicPitchDetectorOptions): MicPitchDetectorHandle;
export function createMicPitchDetector(
  context: AudioContext,
  stream: MediaStream,
  options?: MicPitchDetectorOptions,
): Promise<MicPitchDetectorHandle>;
export function createMicPitchDetector(
  first?: AudioContext | MicPitchDetectorOptions,
  stream?: MediaStream,
  options: MicPitchDetectorOptions = {},
): MicPitchDetectorHandle | Promise<MicPitchDetectorHandle> {
  if (first !== undefined && 'createMediaStreamSource' in first && stream !== undefined) {
    const handle = createDetectorCore({ ...options, audioContext: first, stream }, true);
    return handle.start(stream, first).then(() => handle);
  }
  return createDetectorCore((first as MicPitchDetectorOptions | undefined) ?? {}, false);
}
