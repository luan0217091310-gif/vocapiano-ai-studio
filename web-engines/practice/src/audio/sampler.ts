/**
 * Bộ tổng hợp âm thanh nhạc cụ ấm chân thực 100% cục bộ bằng Web Audio API (0 tải tệp ngoài).
 *
 * - **Piano**: đa hoạ âm có độ lệch cứng dây (inharmonicity) + dây đôi unison nhẹ + bộ lọc thùng
 *   đàn động theo lực bấm (`velocity`) + tiếng búa nỉ mềm đầu nốt + suy giảm tự nhiên theo cao độ.
 * - **Sáo trúc C5 (`sao_truc`)**: âm sắc tre ấm (âm cơ bản + bậc 2/3/4 mềm qua bộ lọc thân ống)
 *   + tiếng chiff hơi đầu nốt + nền hơi nhẹ khi ngân + trượt cao độ tự nhiên đầu nốt & vibrato nhẹ.
 *
 * Tuân thủ Hợp đồng B (`playNote`, `stopNote`, `stopAll`, `dispose`) đồng thời giữ tương thích ngược
 * với `noteOn`, `noteOff`, `allOff`, `setInstrument`, `click`.
 */

import type { MicProfile } from '../mic/tracker.ts';

export interface InstrumentAudio {
  /**
   * Phát một nốt nhạc.
   * Hỗ trợ cả Hợp đồng B `playNote(midi, velocity, durationS, when?)` (velocity 0..1 hoặc 1..127)
   * lẫn thứ tự cũ `playNote(midi, durationS, velocity, when?)` khi `arg3` là MIDI velocity (> 1).
   */
  playNote(midi: number, velocityOrDuration?: number, durationOrVelocity?: number, when?: number): () => void;
  /** Dừng êm một nốt đang kêu (Hợp đồng B). */
  stopNote(midi: number): void;
  /** Bắt đầu giữ một nốt (dùng cho bàn phím / MIDI live). */
  noteOn(midi: number, velocity?: number): void;
  /** Bí danh `stopNote`. */
  noteOff(midi: number): void;
  /** Dừng toàn bộ nốt đang phát. */
  stopAll(): void;
  /** Bí danh `stopAll`. */
  allOff(): void;
  /** Chuyển nhanh nhạc cụ đang dùng (`piano` | `sao_truc`). */
  setInstrument(next: MicProfile): void;
  /** Tiếng gõ máy đếm nhịp (phách mạnh / phách nhẹ). */
  click(accent: boolean): void;
  /** Giải phóng tài nguyên AudioContext tự tạo (nếu caller không truyền sẵn context). */
  dispose(): Promise<void>;
}

/** Chuẩn hoá tham số `(arg2, arg3)` về `{ strength: 0..1, durationS }`. */
function resolvePlayArgs(
  arg2?: number,
  arg3?: number,
): { strength: number; durationS: number } {
  // Trường hợp tương thích ngược `playNote(midi, durationS=0.75, velocity=92)` (arg2 <= 10, arg3 > 1)
  if (arg2 !== undefined && arg3 !== undefined && arg3 > 1 && arg3 <= 127 && arg2 <= 10) {
    return {
      durationS: Math.max(0.02, arg2),
      strength: Math.max(0.05, Math.min(1, arg3 / 127)),
    };
  }
  // Hợp đồng B: `playNote(midi, velocity, durationS)`
  const rawVel = arg2 ?? 0.75;
  const strength = rawVel > 1 ? Math.max(0.05, Math.min(1, rawVel / 127)) : Math.max(0.05, Math.min(1, rawVel));
  const durationS = Math.max(0.02, arg3 ?? 0.65);
  return { strength, durationS };
}

function createNoiseBuffer(
  ctx: BaseAudioContext,
  durationS: number,
  decayRate: number,
  gain: number,
): AudioBuffer {
  const length = Math.max(1, Math.ceil(ctx.sampleRate * durationS));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Lọc hồng nhẹ để tiếng hơi / tiếng búa ấm, không gắt chói.
  let lp = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    lp = 0.65 * lp + 0.35 * white;
    const env = decayRate > 0 ? Math.exp((-decayRate * i) / length) : 1;
    data[i] = lp * env * gain;
  }
  return buffer;
}

export function createInstrumentAudio(
  input: MicProfile | BaseAudioContext = 'piano',
  options?: BaseAudioContext | { instrument?: MicProfile },
): InstrumentAudio {
  const supplied =
    typeof input === 'string'
      ? options && 'createGain' in options
        ? options
        : undefined
      : input;
  let instrument: MicProfile =
    typeof input === 'string'
      ? input
      : options && 'instrument' in options
        ? (options.instrument ?? 'piano')
        : 'piano';
  let context: BaseAudioContext | undefined = supplied;
  const voices = new Set<() => void>();
  const keys = new Map<number, () => void>();

  function playNote(
    midi: number,
    velocityOrDuration?: number,
    durationOrVelocity?: number,
    when?: number,
  ): () => void {
    context ??= new AudioContext({ latencyHint: 'interactive' });
    const ctx = context;
    if (typeof AudioContext !== 'undefined' && ctx instanceof AudioContext && ctx.state === 'suspended') {
      void ctx.resume();
    }

    const { strength, durationS } = resolvePlayArgs(velocityOrDuration, durationOrVelocity);
    const start = Math.max(ctx.currentTime, when ?? ctx.currentTime);
    const end = start + durationS;
    const flute = instrument === 'sao_truc';
    const hz = 440 * 2 ** ((midi - 69) / 12);
    const release = flute ? 0.065 : 0.18;
    const stopAt = end + release;

    // Kênh tổng của nốt -> bộ lọc ấm thân nhạc cụ -> destination.
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'lowpass';
    if (flute) {
      bodyFilter.frequency.setValueAtTime(Math.min(8800, hz * (4.2 + 2.2 * strength)), start);
      bodyFilter.Q.setValueAtTime(0.7, start);
    } else {
      // Thùng đàn piano: sáng khi bấm mạnh rồi dịu ấm dần theo thời gian.
      const brightHz = Math.min(14000, hz * (3.5 + 7.5 * strength));
      const warmHz = Math.min(4800, Math.max(700, hz * 2.6));
      bodyFilter.frequency.setValueAtTime(brightHz, start);
      bodyFilter.frequency.exponentialRampToValueAtTime(warmHz, start + Math.min(0.65, durationS));
      bodyFilter.Q.setValueAtTime(0.6, start);
    }

    const bus = ctx.createGain();
    bus.connect(bodyFilter);
    bodyFilter.connect(ctx.destination);

    bus.gain.setValueAtTime(0.0001, start);
    bus.gain.linearRampToValueAtTime(0.32 * strength ** 1.3, start + (flute ? 0.022 : 0.005));
    bus.gain.setTargetAtTime(0.0001, end, release / 5);

    const sources: AudioScheduledSourceNode[] = [];
    let vibrato: GainNode | undefined;

    if (flute && durationS > 0.32) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.8;
      vibrato = ctx.createGain();
      vibrato.gain.setValueAtTime(0, start + 0.22);
      vibrato.gain.linearRampToValueAtTime(5.5, start + 0.44);
      lfo.connect(vibrato);
      sources.push(lfo);
    }

    const harmonics = flute ? [1, 0.26, 0.11, 0.035] : [1, 0.46, 0.27, 0.15, 0.08, 0.04];
    const inharmonicityB = 0.00013;

    for (const [i, amplitude] of harmonics.entries()) {
      const h = i + 1;
      const freq = hz * h * (flute ? 1 : Math.sqrt(1 + inharmonicityB * (h * h - 1)));
      if (freq >= ctx.sampleRate / 2) continue;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      if (flute) {
        // Trượt nhẹ -9 cent lên đúng cao độ đầu nốt thổi để nghe mềm tự nhiên.
        osc.detune.setValueAtTime(-9, start);
        osc.detune.linearRampToValueAtTime(0, start + 0.024);
        vibrato?.connect(osc.detune);
      }

      const envelope = ctx.createGain();
      const gainLevel = amplitude * (i === 0 ? 1 : 0.42 + 0.58 * strength);
      envelope.gain.setValueAtTime(gainLevel, start);
      if (!flute) {
        // Bậc hài cao và nốt cao tắt nhanh hơn (đặc trưng dây đàn piano).
        const decayTau = Math.max(0.08, 2.5 / (h * Math.sqrt(Math.max(100, hz) / 260)));
        envelope.gain.setTargetAtTime(0.0001, start + 0.006, decayTau);
      }
      osc.connect(envelope).connect(bus);
      sources.push(osc);

      // Dây đôi unison lệch ±1.6 cent cho âm cơ bản piano (trung âm trở lên) tạo độ dày ấm.
      if (!flute && h === 1 && midi >= 48) {
        const unison = ctx.createOscillator();
        unison.type = 'sine';
        unison.frequency.setValueAtTime(freq, start);
        unison.detune.setValueAtTime(1.6, start);
        const uGain = ctx.createGain();
        uGain.gain.setValueAtTime(0.32, start);
        uGain.gain.setTargetAtTime(0.0001, start + 0.006, 2.3 / Math.sqrt(Math.max(100, hz) / 260));
        unison.connect(uGain).connect(bus);
        sources.push(unison);
      }
    }

    // Tiếng đầu nốt: chiff hơi cho Sáo trúc / tiếng búa nỉ gõ dây cho Piano.
    const attackNoise = ctx.createBufferSource();
    attackNoise.buffer = createNoiseBuffer(
      ctx,
      flute ? 0.06 : 0.035,
      flute ? 4.5 : 6.5,
      flute ? 0.22 : 0.12 * strength,
    );
    const attackFilter = ctx.createBiquadFilter();
    attackFilter.type = 'bandpass';
    attackFilter.frequency.setValueAtTime(
      flute ? Math.min(4200, Math.max(1600, hz * 2.2)) : Math.min(1800, Math.max(520, hz * 2.0)),
      start,
    );
    attackFilter.Q.setValueAtTime(flute ? 1.8 : 1.2, start);
    attackNoise.connect(attackFilter).connect(bus);
    sources.push(attackNoise);

    // Nền hơi nhẹ liên tục cho nốt ngân Sáo trúc (giữ biên độ thấp để không nhiễu YIN).
    if (flute && durationS > 0.12) {
      const airBed = ctx.createBufferSource();
      airBed.buffer = createNoiseBuffer(ctx, Math.min(durationS, 1.5), 0, 0.025 * strength);
      airBed.loop = durationS > 1.5;
      const airFilter = ctx.createBiquadFilter();
      airFilter.type = 'bandpass';
      airFilter.frequency.setValueAtTime(Math.min(4800, hz * 2.5), start);
      airFilter.Q.setValueAtTime(2.4, start);
      airBed.connect(airFilter).connect(bus);
      sources.push(airBed);
    }

    let remaining = sources.length;
    const releaseVoice = () => {
      if (!voices.delete(releaseVoice)) return;
      if (keys.get(midi) === releaseVoice) keys.delete(midi);
      const now = ctx.currentTime;
      try {
        bus.gain.cancelScheduledValues(now);
        bus.gain.setTargetAtTime(0.0001, now, release / 5);
        for (const source of sources) {
          try {
            source.stop(now + release);
          } catch {
            // Nguồn đã dừng trước đó hoặc chưa chạy.
          }
        }
      } catch {
        // AudioContext đã đóng.
      }
    };

    voices.add(releaseVoice);
    keys.set(midi, releaseVoice);
    for (const s of sources) {
      s.onended = () => {
        try {
          s.disconnect();
        } catch {
          /* ignore */
        }
        if (--remaining === 0) {
          try {
            bus.disconnect();
            bodyFilter.disconnect();
          } catch {
            /* ignore */
          }
          voices.delete(releaseVoice);
          if (keys.get(midi) === releaseVoice) keys.delete(midi);
        }
      };
      s.start(start);
      s.stop(stopAt);
    }
    return releaseVoice;
  }

  function stopNote(midi: number): void {
    const release = keys.get(midi);
    if (release) {
      keys.delete(midi);
      release();
    }
  }

  function stopAll(): void {
    for (const stop of [...voices]) stop();
    keys.clear();
  }

  return {
    playNote,
    stopNote,
    noteOff: stopNote,
    stopAll,
    allOff: stopAll,
    noteOn(midi: number, velocity = 80) {
      stopNote(midi);
      keys.set(midi, playNote(midi, velocity, 60));
    },
    setInstrument(next: MicProfile) {
      stopAll();
      instrument = next;
    },
    click(accent: boolean) {
      playNote(accent ? 91 : 86, accent ? 48 : 38, 0.035);
    },
    async dispose() {
      stopAll();
      if (!supplied && typeof AudioContext !== 'undefined' && context instanceof AudioContext) {
        await context.close();
      }
      context = supplied;
    },
  };
}
