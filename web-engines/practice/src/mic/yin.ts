/**
 * Ước lượng cao độ đơn âm độ trễ thấp bằng thuật toán YIN (hàm sai phân chuẩn hoá tích luỹ)
 * kết hợp chống nhảy quãng 8 ảo (harmonic 2x / 3x và bám liên tục cho Sáo trúc C5 & Piano).
 *
 * Tối ưu hiệu năng: tái sử dụng bộ đệm scratch không cấp phát lặp trong vòng lặp thời gian thực
 * (< 1 ms/khung 1024–2048 mẫu trên trình duyệt). 100% cục bộ trên thiết bị (D-21).
 */

export interface PitchEstimate {
  /** Tần số cơ bản ước lượng (Hz). */
  frequency: number;
  /** Số nốt MIDI nguyên gần nhất (VD 60 = C4, 72 = C5). */
  midi: number;
  /** Số nốt MIDI thực (liên tục) để vẽ tuner mượt. */
  midiFloat: number;
  /** Độ lệch so với nốt MIDI gần nhất tính bằng cent (-50..+50). */
  cents: number;
  /** Độ tin cậy ước lượng cao độ (0..1; 1 = tuần hoàn rất rõ). */
  confidence: number;
  /** Biên độ RMS chuẩn hoá của khung tín hiệu (0..1). */
  rms: number;
  /** Chu kỳ ước lượng tính bằng số mẫu (đã nội suy parabol). */
  period: number;
}

export interface YinOptions {
  /** Ngưỡng CMNDF YIN (mặc định 0.15; thấp hơn = khắt khe hơn). */
  threshold?: number;
  /** Tần số thấp nhất cần dò (Hz). */
  minFrequency?: number;
  /** Tần số cao nhất cần dò (Hz). */
  maxFrequency?: number;
  /** Ngưỡng RMS tối thiểu để xem là có tiếng (mặc định 0.002). */
  rmsThreshold?: number;
  /** Hồ sơ nhạc cụ tự đặt dải tần chuẩn (`piano`: C3–C6, `sao_truc`: C5–C7). */
  profile?: 'piano' | 'sao_truc';
  /** Tần số khung trước (Hz, tuỳ chọn) để giảm nhảy quãng 8 thoáng qua. */
  previousFrequency?: number | null;
}

const midiOf = (hz: number): number => 69 + 12 * Math.log2(hz / 440);

// Tái sử dụng bộ đệm CMNDF để tránh cấp phát rác (GC) ở tốc độ ~90–375 khung/giây.
let scratchBuf = new Float64Array(1025);
function getScratch(length: number): Float64Array {
  if (scratchBuf.length < length) {
    scratchBuf = new Float64Array(length);
  }
  return scratchBuf;
}

/** Nội suy giá trị đáy parabol tại vị trí k để so sánh chính xác độ sâu hai thung lũng. */
function valleyDepth(d: Float64Array, k: number, maxTau: number): number {
  if (k <= 1 || k >= maxTau) return d[k];
  const slope = (d[k + 1] - d[k - 1]) / 2;
  const curvature = d[k + 1] + d[k - 1] - 2 * d[k];
  return curvature > 0 ? Math.max(0, d[k] - (slope * slope) / (2 * curvature)) : d[k];
}

/** Tìm cực tiểu cục bộ gần lag mục tiêu `center` trong cửa sổ ±radius. */
function localMinAround(
  d: Float64Array,
  center: number,
  radius: number,
  minTau: number,
  maxTau: number,
): number {
  const lo = Math.max(minTau, center - radius);
  const hi = Math.min(maxTau, center + radius);
  let best = lo;
  for (let t = lo + 1; t <= hi; t++) {
    if (d[t] < d[best]) best = t;
  }
  return best;
}

/**
 * YIN: hàm sai phân -> chuẩn hoá trung bình tích luỹ (CMNDF) -> chọn thung lũng đầu dưới ngưỡng
 * -> chống lỗi nhảy quãng 8 (kiểm tra bội chu kỳ 2×tau, 3×tau và liên tục khung trước)
 * -> nội suy parabol đạt sai số thường < 2 cent.
 */
export function detectPitchYIN(
  samples: Float32Array | number[],
  sampleRate: number,
  options: YinOptions = {},
): PitchEstimate | null {
  const n = samples.length;
  if (n < 32 || !Number.isFinite(sampleRate) || sampleRate <= 0) return null;

  let energy = 0;
  let mean = 0;
  for (let i = 0; i < n; i++) {
    const x = samples[i];
    mean += x;
    energy += x * x;
  }
  mean /= n;
  const rms = Math.sqrt(Math.max(0, energy / n - mean * mean));
  if (!Number.isFinite(rms) || rms < (options.rmsThreshold ?? 0.002)) return null;

  const defaultMinHz = options.profile === 'sao_truc' ? 490 : options.profile === 'piano' ? 122 : 70;
  const defaultMaxHz = options.profile === 'sao_truc' ? 2220 : options.profile === 'piano' ? 1120 : 2400;
  const minHz = Math.max(20, options.minFrequency ?? defaultMinHz);
  const maxHz = Math.min(sampleRate / 2.1, options.maxFrequency ?? defaultMaxHz);
  const minTau = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxTau = Math.min(Math.floor(n / 2), Math.ceil(sampleRate / minHz));
  if (maxTau <= minTau) return null;

  const d = getScratch(maxTau + 1);
  const end = n - maxTau;
  // Giữ đầy đủ độ phân giải trên trục lag tau; lấy bước 2 trên tổng tương quan để đạt < 1ms/khung.
  const stride = end >= 512 ? 2 : 1;
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < end; i += stride) {
      const delta = samples[i] - samples[i + tau];
      sum += delta * delta;
    }
    d[tau] = sum;
  }

  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    running += d[tau];
    d[tau] = running === 0 ? 1 : (d[tau] * tau) / running;
  }

  const threshold = options.threshold ?? 0.15;
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= maxTau && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    let best = minTau;
    for (let t = minTau + 1; t <= maxTau; t++) {
      if (d[t] < d[best]) best = t;
    }
    if (d[best] > 0.35) return null;
    tau = best;
  }

  // Chống nhảy quãng 8 lên (hài bậc 2 hoặc bậc 3 trội hơn âm cơ bản — hay gặp ở Sáo trúc C5).
  const vTau = valleyDepth(d, tau, maxTau);
  for (const mult of [2, 3]) {
    const candidateCenter = tau * mult;
    if (candidateCenter > maxTau) continue;
    const h = localMinAround(d, candidateCenter, mult === 2 ? 2 : 3, minTau, maxTau);
    const vH = valleyDepth(d, h, maxTau);
    if (vTau - vH > 0.018 && vH < vTau * 0.45) {
      tau = h;
      break;
    }
  }

  // Bám liên tục nếu biết tần số khung liền trước: tránh nhảy quãng 8 ảo khi hai đáy gần bằng nhau.
  const prevHz = options.previousFrequency;
  if (prevHz !== undefined && prevHz !== null && Number.isFinite(prevHz) && prevHz >= minHz && prevHz <= maxHz) {
    const curHz = sampleRate / tau;
    const ratio = curHz / prevHz;
    if ((ratio > 1.85 && ratio < 2.15) || (ratio > 0.46 && ratio < 0.54)) {
      const targetTau = Math.round(sampleRate / prevHz);
      if (targetTau >= minTau && targetTau <= maxTau) {
        const alt = localMinAround(d, targetTau, 2, minTau, maxTau);
        if (d[alt] < Math.max(threshold, 0.22) && d[alt] <= d[tau] + 0.04) {
          tau = alt;
        }
      }
    }
  }

  const left = d[tau - 1];
  const mid = d[tau];
  const right = tau < maxTau ? d[tau + 1] : d[tau];
  const denom = 2 * (2 * mid - right - left);
  const refined = denom === 0 ? tau : tau + (right - left) / denom;
  const frequency = sampleRate / refined;
  if (!Number.isFinite(frequency) || frequency < minHz * 0.98 || frequency > maxHz * 1.02) {
    return null;
  }
  const midiFloat = midiOf(frequency);
  const midi = Math.round(midiFloat);
  return {
    frequency,
    midi,
    midiFloat,
    cents: (midiFloat - midi) * 100,
    confidence: Math.max(0, Math.min(1, 1 - mid)),
    rms,
    period: refined,
  };
}
