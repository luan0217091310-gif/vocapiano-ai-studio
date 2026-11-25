// Luật gamification thuần (không truy cập DB) để dễ kiểm thử: XP, chuỗi ngày, huy hiệu, tuần.

/** Ngày theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD. */
export function vnDay(date = new Date()) {
  return new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

const shiftDay = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Thứ Hai của tuần chứa `day`. */
export function weekStart(day) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = CN
  return shiftDay(day, -((dow + 6) % 7));
}

/** XP: 10 điểm tham gia + tối đa 40 theo độ chính xác; Kiểm tra ×1.5; lượt < 20 giây chỉ được 2 XP. */
export function xpFor({ accuracy, mode, durationS }) {
  if (durationS < 20) return 2;
  const base = 10 + Math.round(accuracy * 40);
  return mode === "exam" ? Math.round(base * 1.5) : base;
}

/** Chuỗi ngày: đếm ngày liên tiếp kết thúc hôm nay hoặc hôm qua (chưa tập hôm nay vẫn giữ chuỗi). */
export function streakOf(daysDesc, today) {
  if (!daysDesc.length) return { current: 0, best: 0, practicedToday: false };
  const set = new Set(daysDesc);
  let start = set.has(today) ? today : shiftDay(today, -1);
  let current = 0;
  while (set.has(start)) {
    current += 1;
    start = shiftDay(start, -1);
  }
  const asc = [...set].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < asc.length; i++) {
    run = shiftDay(asc[i - 1], 1) === asc[i] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return {
    current,
    best: Math.max(best, current),
    practicedToday: set.has(today),
  };
}

export const BADGES = {
  first_session: {
    title: "Nốt đầu tiên",
    description: "Hoàn thành lượt luyện tập đầu tiên.",
  },
  streak_3: {
    title: "Ba ngày liền",
    description: "Luyện tập 3 ngày liên tiếp.",
  },
  streak_7: {
    title: "Một tuần bền bỉ",
    description: "Luyện tập 7 ngày liên tiếp.",
  },
  accuracy_90: {
    title: "Chuẩn từng nốt",
    description: "Đạt độ chính xác từ 90% trong một lượt.",
  },
  lessons_5: { title: "Khám phá", description: "Luyện 5 bài khác nhau." },
  exam_pass: {
    title: "Qua bài kiểm tra",
    description: "Đạt từ 80% ở chế độ Kiểm tra.",
  },
};

/** Huy hiệu đủ điều kiện sau một lượt (bộ gọi tự lọc những huy hiệu đã có). */
export function eligibleBadges({ session, totals, streak }) {
  const out = [];
  if (totals.sessions >= 1) out.push("first_session");
  if (streak.current >= 3) out.push("streak_3");
  if (streak.current >= 7) out.push("streak_7");
  if (session.accuracy >= 0.9 && session.durationS >= 20)
    out.push("accuracy_90");
  if (totals.lessons >= 5) out.push("lessons_5");
  if (session.mode === "exam" && session.accuracy >= 0.8) out.push("exam_pass");
  return out;
}
