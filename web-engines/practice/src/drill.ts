/**
 * Bộ phân tích lỗi & sinh bài luyện sửa cá nhân hoá 1 chạm (`buildErrorDrill`).
 *
 * Từ báo cáo lượt tập (`AttemptReport`), tự động chọn cụm 2–4 ô nhịp sai nhiều nhất
 * (sai cao độ, trễ nhịp, rớt nốt), áp dụng `genLoop` + `genSlow` (60%–80%) + `genSplit`
 * (cho sáo trúc theo luật hơi an toàn L6/L7), kiểm lại bất biến và xuất câu nhận xét tiếng Việt
 * ấm áp chuẩn sư phạm (0 cụm từ cấm `forbidden_phrases.yaml`, 0 so sánh tuyệt đối D-01).
 */

import rawThresholds from '../config/thresholds.json' with { type: 'json' };
import rawCues from '../data/cues.json' with { type: 'json' };
import rawSafety from '../data/safety_params.json' with { type: 'json' };
import { clipFromScore } from './clip.ts';
import type { Clip } from './clip.ts';
import { parseSafetyParams, parseThresholds } from './config.ts';
import { checkInvariants, checkLevelRules, cutBars, genLoop, genSlow, genSplit } from './gen.ts';
import type { AttemptReport } from './session.ts';
import type { VocaScore } from './types.ts';

const thresholds = parseThresholds(rawThresholds, parseSafetyParams(rawSafety));
const forbiddenPatterns: RegExp[] = ((rawCues as { forbidden_patterns?: { regex: string }[] }).forbidden_patterns ?? []).map(
  (p) => new RegExp(p.regex, 'iu'),
);

export interface DrillTarget {
  scoreId: string;
  instrument: string;
  bars: [number, number];
  tempoPct: number;
  repeat: number;
  noteIds: string[];
  clip: Clip;
  splitCount: number;
}

export interface ErrorDrill {
  // Hợp đồng B (cho WT-4 Practice Studio: nút "Luyện lại đoạn vừa sai" 1 chạm)
  startBar: number;
  endBar: number;
  suggestedTempoRatio: number;
  summaryVi: string;
  cueTextVi: string;
  drillTarget: DrillTarget;
  // Tương thích ngược
  clip: Clip;
  bars: [number, number];
  tempoPct: number;
  from: number;
  to: number;
  speed: number;
  reason: string;
  feedback: string;
}

function dominantFocus(
  report: Pick<AttemptReport, 'detections'>,
  first: number,
  last: number,
): 'pitch' | 'rhythm' | 'general' {
  let pitch = 0;
  let rhythm = 0;
  for (const d of report.detections ?? []) {
    if (d.bar < first || d.bar > last || !d.scoring) continue;
    if (d.aspect === 'pitch') pitch += Math.max(1, d.noteIds.length);
    else if (d.aspect === 'rhythm' || d.aspect === 'flow') rhythm += Math.max(1, d.noteIds.length);
  }
  if (pitch > rhythm) return 'pitch';
  if (rhythm > 0) return 'rhythm';
  return 'general';
}

function buildWarmCopy(
  instrument: string,
  first: number,
  last: number,
  tempoPct: number,
  errorCount: number,
  focus: 'pitch' | 'rhythm' | 'general',
): { summaryVi: string; cueTextVi: string } {
  const barRange = first === last ? `ô ${first}` : `ô ${first}–${last}`;
  const isFlute = instrument === 'sao_truc';
  const summaryVi = `Đoạn ${barRange} có ${errorCount} điểm cần rà lại — tập chậm ở ${tempoPct}% tốc độ.`;

  let cueTextVi: string;
  if (isFlute) {
    cueTextVi =
      focus === 'pitch'
        ? `Mình tách riêng ${barRange} ở ${tempoPct}% tốc độ nhé. Giữ vai thả lỏng, nghe nốt đầu rồi thổi đều hơi.`
        : `Mình luyện lại ${barRange} ở ${tempoPct}% tốc độ nhé. Lấy hơi vừa đủ, giữ nhịp thật êm rồi ghép lại cả câu.`;
  } else if (focus === 'pitch') {
    cueTextVi = `Mình cùng tập ${barRange} ở ${tempoPct}% tốc độ nhé. Đặt tay gọn trên thế phím rồi đánh từng nốt thật rõ.`;
  } else if (focus === 'rhythm') {
    cueTextVi = `Mình tách ${barRange} ở ${tempoPct}% tốc độ nhé. Nghe nhịp đếm trước rồi vào thật đều cùng tiếng gõ.`;
  } else {
    cueTextVi = `Mình cùng tập ${barRange} ở ${tempoPct}% tốc độ nhé. Nghe nốt đầu rồi vào chậm rãi cùng nhịp đếm.`;
  }

  for (const rx of forbiddenPatterns) {
    if (rx.test(summaryVi) || rx.test(cueTextVi)) {
      return {
        summaryVi: `Đoạn ${barRange} cần luyện lại ở ${tempoPct}% tốc độ.`,
        cueTextVi: `Mình cùng tập lại ${barRange} ở ${tempoPct}% tốc độ nhé.`,
      };
    }
  }
  return { summaryVi, cueTextVi };
}

/**
 * Tự động tìm cụm 2–4 ô nhịp sai nhiều nhất trong lượt tập, tính tốc độ thích ứng 60%–80%,
 * kiểm bất biến + luật hơi an toàn L6/L7 và trả cấu hình bài sửa 1 chạm.
 */
export function buildErrorDrill(
  score: VocaScore,
  report: Pick<AttemptReport, 'barErrors' | 'detections'>,
): ErrorDrill | null {
  const full = clipFromScore(score);
  const totalBars = full.bars[1];
  const minBar = full.bars[0];
  const errors: Record<number, number> = { ...report.barErrors };

  if (!report.barErrors) {
    for (const d of report.detections ?? []) {
      if (d.scoring && ['pitch', 'rhythm', 'flow'].includes(d.aspect)) {
        errors[d.bar] = (errors[d.bar] ?? 0) + Math.max(1, d.noteIds.length);
      }
    }
  }

  // Chọn cửa sổ liên tiếp ngắn nhất (2–4 ô) chứa nhiều lỗi nhất; hoà thì ưu tiên cửa sổ có ô đầu chứa lỗi.
  const minWidth = Math.min(2, totalBars - minBar + 1);
  const maxWidth = Math.min(4, totalBars - minBar + 1);
  let bestCount = 0;
  let bestStartsWithError = false;
  let first = minBar;
  let last = minBar + minWidth - 1;

  for (let width = minWidth; width <= maxWidth; width++) {
    for (let i = minBar; i + width - 1 <= totalBars; i++) {
      let count = 0;
      for (let j = i; j < i + width; j++) count += errors[j] ?? 0;
      const startsErr = (errors[i] ?? 0) > 0;
      if (
        count > bestCount ||
        (count === bestCount && count > 0 && startsErr && !bestStartsWithError && last - first + 1 === width)
      ) {
        bestCount = count;
        bestStartsWithError = startsErr;
        first = i;
        last = i + width - 1;
      }
    }
  }

  if (bestCount === 0) return null;

  const selected = cutBars(full, first, last);
  const midpoint = Math.floor((first + last) / 2);
  const loop = genLoop(selected, midpoint, {
    ...thresholds,
    gen: { ...thresholds.gen, loopSpanBars: Math.max(last - midpoint, midpoint - first) },
  });

  // Tỉ lệ lỗi càng cao -> tốc độ đề xuất càng chậm trong khoảng 60%–80%.
  const errorRatio = Math.min(1, bestCount / Math.max(1, selected.notes.length));
  const targetPct = Math.max(60, Math.min(80, 80 - Math.round(20 * errorRatio)));
  const slow = genSlow(loop, targetPct, thresholds, 'clamp');

  let clip: Clip;
  if (slow.ok && slow.appliedPct <= 80) {
    clip = full.instrument === 'sao_truc' ? genSplit(slow.clip, thresholds) : slow.clip;
  } else if (full.instrument === 'sao_truc') {
    // Luật an toàn hơi D-40 / L6: nếu nốt sáo quá dài không hạ <= 80% được, chia câu giữ nhịp gốc.
    clip = genSplit(loop, thresholds);
  } else {
    return null;
  }

  if (checkInvariants(full, clip).length > 0 || checkLevelRules(clip, thresholds).length > 0) {
    return null;
  }

  const focus = dominantFocus(report, first, last);
  const { summaryVi, cueTextVi } = buildWarmCopy(
    full.instrument,
    first,
    last,
    clip.tempoPct,
    bestCount,
    focus,
  );
  const suggestedTempoRatio = Number((clip.tempoPct / 100).toFixed(2));

  return {
    startBar: first,
    endBar: last,
    suggestedTempoRatio,
    summaryVi,
    cueTextVi,
    drillTarget: {
      scoreId: score.id,
      instrument: full.instrument,
      bars: clip.bars,
      tempoPct: clip.tempoPct,
      repeat: clip.repeat,
      noteIds: clip.notes.map((n) => n.id),
      clip,
      splitCount: clip.splits.length,
    },
    clip,
    bars: clip.bars,
    tempoPct: clip.tempoPct,
    from: first,
    to: last,
    speed: clip.tempoPct,
    reason: `${bestCount} nốt cần luyện lại`,
    feedback: cueTextVi,
  };
}
