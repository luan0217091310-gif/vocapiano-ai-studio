// Seed DỮ LIỆU MẪU cho demo: 3 tài khoản theo vai trò + vài lượt tập để dashboard/bảng xếp hạng có số.
// Tên hiển thị gắn "[Mẫu]" để không nhầm với người dùng thật. Chạy lặp lại an toàn (bỏ qua nếu đã có).
import { hashPassword } from "../core/security.mjs";
import { usersRepository } from "../modules/users/users.repository.mjs";
import { progressRepository } from "../modules/progress/progress.repository.mjs";
import { vnDay, xpFor } from "../modules/progress/gamification.mjs";

export const DEMO_PASSWORD = "VocaDemo2026";
export const DEMO_ACCOUNTS = [
  {
    email: "admin@vocaverse.demo",
    displayName: "[Mẫu] Quản trị viên",
    role: "admin",
    plan: "studio",
  },
  {
    email: "plus@vocaverse.demo",
    displayName: "[Mẫu] Lan Anh (Plus)",
    role: "user",
    plan: "plus",
  },
  {
    email: "hocvien@vocaverse.demo",
    displayName: "[Mẫu] Minh Khoa (Free)",
    role: "user",
    plan: "free",
  },
];

export async function seed(db) {
  const users = usersRepository(db);
  const progress = progressRepository(db);
  const created = [];
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const a of DEMO_ACCOUNTS) {
    if (users.findAuthByEmail(a.email)) continue;
    const id = users.create({ ...a, passwordHash, verified: true });
    users.update(id, {
      onboarding: {
        instrument: "piano",
        level: "new",
        device: "virtual",
        time: "15",
        complete: true,
      },
    });
    created.push(a.email);
    if (a.role === "admin") continue;
    // Lượt tập mẫu trong 4 ngày gần nhất.
    const today = vnDay();
    const lessons =
      a.plan === "plus" ? ["PN01", "PN02", "PN05", "SA03"] : ["PN01", "PN02"];
    lessons.forEach((lessonId, i) => {
      const day = vnDay(
        new Date(Date.now() - (lessons.length - 1 - i) * 86400_000),
      );
      const s = {
        lessonId,
        mode: "learn",
        accuracy: 0.7 + i * 0.07,
        durationS: 180,
      };
      progress.insertSession({ userId: id, ...s, xp: xpFor(s), day });
    });
    progress.award(id, "first_session");
    if (lessons.length >= 3) progress.award(id, "streak_3");
    progress.addFavorite(id, "PN01");
    db.prepare(
      "INSERT INTO notifications (user_id, kind, title, body) VALUES (?, 'welcome', ?, ?)",
    ).run(
      id,
      "Chào mừng bạn đến VocaVerse!",
      `Tài khoản mẫu tạo ngày ${today}.`,
    );
  }
  return created;
}
