export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceVnd: { month: 0, year: 0 },
    features: {
      freeLessonsPerInstrument: 4,
      examMode: false,
      verifiedHand3d: false,
      practiceHistoryDays: 7,
    },
  },
  plus: {
    id: "plus",
    name: "Plus",
    priceVnd: { month: 99_000, quarter: 199_000, year: 699_000 },
    features: {
      freeLessonsPerInstrument: Infinity,
      examMode: true,
      verifiedHand3d: true,
      practiceHistoryDays: 365,
    },
  },
  studio: {
    id: "studio",
    name: "Studio",
    // Gói cho phòng đàn/giáo viên: báo giá theo ghế, mở qua quản trị viên (không tự thanh toán).
    priceVnd: null,
    features: {
      freeLessonsPerInstrument: Infinity,
      examMode: true,
      verifiedHand3d: true,
      practiceHistoryDays: 365 * 3,
      teacherSeats: 30,
    },
  },
};

PLANS.starter = {
  id: "starter",
  name: "Khởi động",
  priceVnd: { month: 49000 },
  features: { ...PLANS.free.features, freeLessonsPerInstrument: Infinity },
};
PLANS.founder = {
  ...PLANS.plus,
  id: "founder",
  name: "Sáng lập",
  priceVnd: { year: 499000 },
};
export const planOf = (user) =>
  user?.b2bPartnerCode ? PLANS.plus : (PLANS[user?.plan] ?? PLANS.free);

/** Bài được mở cho gói: Free mở N bài đầu của mỗi nhạc cụ, theo thứ tự mã bài. */
export function lessonAllowed(user, lesson, lessons) {
  if (
    !user?.b2bPartnerCode &&
    user?.plan === "starter" &&
    lesson.instrument !== user.starterInstrument
  )
    return lessonAllowed(null, lesson, lessons);
  const limit = planOf(user).features.freeLessonsPerInstrument;
  if (limit === Infinity) return true;
  const same = lessons
    .filter((l) => l.instrument === lesson.instrument)
    .map((l) => l.id)
    .sort();
  return same.indexOf(lesson.id) < limit;
}

export const publicPlans = () =>
  Object.values(PLANS).map(({ id, name, priceVnd, features }) => ({
    id,
    name,
    priceVnd,
    features: Object.fromEntries(
      Object.entries(features).map(([k, val]) => [
        k,
        val === Infinity ? "unlimited" : val,
      ]),
    ),
  }));
