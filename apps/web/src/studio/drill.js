// Phân tích độ chính xác theo ô nhịp và đề xuất đoạn luyện "Sửa lỗi 1 chạm".
// Fallback cho `buildErrorDrill` (Hợp đồng B, WT-3): cùng đầu ra `{ from, to, speed, reason }`.

export const DRILL_SPEED = 70;
const WEAK = 0.8;

/**
 * @param {{idx:number, bar:number}[]} expected  nốt kỳ vọng của đoạn vừa tập
 * @param {Record<number,string>} noteStates      trạng thái từng nốt: hit | timing | wrong | miss
 * @param {{bar?:number, scoring?:boolean}[]} [detections]
 * @returns {{bar:number,total:number,hit:number,timing:number,wrong:number,miss:number,accuracy:number}[]}
 */
export function barAccuracy(expected, noteStates, detections = []) {
  const bars = new Map();
  for (const e of expected) {
    const row = bars.get(e.bar) ?? {
      bar: e.bar,
      total: 0,
      hit: 0,
      timing: 0,
      wrong: 0,
      miss: 0,
      flagged: 0,
    };
    const st = noteStates[e.idx] ?? "miss";
    row.total++;
    row[st in row ? st : "miss"]++;
    bars.set(e.bar, row);
  }
  for (const d of detections)
    if (d.scoring && bars.has(d.bar)) bars.get(d.bar).flagged++;
  return [...bars.values()]
    .sort((a, b) => a.bar - b.bar)
    .map((r) => ({
      ...r,
      // Lệch nhịp tính nửa điểm: đúng nốt nhưng chưa đúng lúc.
      accuracy: r.total ? (r.hit + r.timing * 0.5) / r.total : 1,
    }));
}

/**
 * Chọn đoạn yếu nhất: chuỗi ô liên tiếp dưới ngưỡng có điểm trung bình thấp nhất (tối đa 4 ô).
 * Trả về null khi mọi ô đều đạt.
 */
export function buildErrorDrill(
  perBar,
  { maxBars = 4, speed = DRILL_SPEED } = {},
) {
  const weak = perBar.filter((b) => b.accuracy < WEAK || b.flagged);
  if (!weak.length) return null;
  const runs = [];
  let run = [];
  for (const b of perBar) {
    if (b.accuracy < WEAK || b.flagged) run.push(b);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  const avg = (r) => r.reduce((s, b) => s + b.accuracy, 0) / r.length;
  let best = runs.sort((a, b) => avg(a) - avg(b) || b.length - a.length)[0];
  if (best.length > maxBars) {
    // Giữ cửa sổ maxBars ô có điểm thấp nhất trong chuỗi dài.
    let pick = 0,
      low = Infinity;
    for (let i = 0; i + maxBars <= best.length; i++) {
      const v = avg(best.slice(i, i + maxBars));
      if (v < low) {
        low = v;
        pick = i;
      }
    }
    best = best.slice(pick, pick + maxBars);
  }
  const wrong = best.reduce((s, b) => s + b.wrong, 0),
    miss = best.reduce((s, b) => s + b.miss, 0),
    timing = best.reduce((s, b) => s + b.timing, 0);
  const reason =
    wrong >= miss && wrong >= timing
      ? "sai cao độ"
      : miss >= timing
        ? "thiếu nốt"
        : "lệch nhịp";
  return {
    from: best[0].bar,
    to: best.at(-1).bar,
    speed,
    reason,
    accuracy: avg(best),
  };
}
