// Gửi lượt luyện tập lên API; báo XP và huy hiệu mới bằng toast. Lỗi mạng không làm gián đoạn Studio.
import { api, isLoggedIn } from "../api/client.js";
import { toast } from "../ui/toast.js";

export async function reportPractice(session) {
  if (!isLoggedIn()) return;
  try {
    const r = await api.post("/me/sessions", {
      ...session,
      accuracy: Math.min(
        1,
        Math.max(0, Math.round(session.accuracy * 1000) / 1000),
      ),
      durationS: Math.min(7200, session.durationS),
    });
    toast.success(`+${r.session.xp} XP · chuỗi ${r.streak.current} ngày`);
    for (const b of r.newBadges) toast.success(`Huy hiệu mới: ${b.title}`);
  } catch (err) {
    toast.error(
      err.code === "PLAN_REQUIRED"
        ? `${err.message} Lượt này chưa được cộng tiến độ.`
        : "Chưa lưu được lượt tập lên tài khoản (đã giữ trên máy này).",
    );
  }
}
