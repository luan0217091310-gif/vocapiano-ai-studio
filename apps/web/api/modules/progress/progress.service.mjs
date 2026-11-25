// Nghiệp vụ tiến độ: ghi lượt tập (kiểm quyền theo gói), XP, chuỗi ngày, huy hiệu, bảng xếp hạng, yêu thích.
import { tx } from "../../db/index.mjs";
import { errors } from "../../core/http.mjs";
import { lessonAllowed, planOf } from "../billing/plans.mjs";
import {
  BADGES,
  eligibleBadges,
  streakOf,
  vnDay,
  xpFor,
} from "./gamification.mjs";

export function progressService({ db, progress, lessons, notify, track }) {
  const lessonOr404 = (id) => {
    const lesson = lessons.find((l) => l.id === id);
    if (!lesson) throw errors.notFound("Không tìm thấy bài học.");
    return lesson;
  };

  const summary = (user) => {
    const today = vnDay();
    const totals = progress.totals(user.id);
    const streak = streakOf(progress.practiceDays(user.id), today);
    const badges = progress
      .badges(user.id)
      .map((b) => ({ id: b.badge, ...BADGES[b.badge], earnedAt: b.earnedAt }));
    return {
      totals,
      streak,
      badges,
      level: 1 + Math.floor(Math.sqrt(totals.xp / 50)),
    };
  };

  return {
    summary,

    recordSession(user, input) {
      const lesson = lessonOr404(input.lessonId);
      if (!lessonAllowed(user, lesson, lessons))
        throw errors.planRequired(
          "Bài này thuộc thư viện Plus. Nâng cấp để luyện tập.",
        );
      if (input.mode === "exam" && !planOf(user).features.examMode)
        throw errors.planRequired("Chế độ Kiểm tra dành cho gói Plus.");
      const xp = xpFor(input);
      const { id, newBadges } = tx(db, () => {
        const id = progress.insertSession({
          userId: user.id,
          ...input,
          xp,
          day: vnDay(),
        });
        const totals = progress.totals(user.id);
        const streak = streakOf(progress.practiceDays(user.id), vnDay());
        const newBadges = eligibleBadges({
          session: input,
          totals,
          streak,
        }).filter((b) => progress.award(user.id, b));
        return { id, newBadges };
      });
      for (const b of newBadges)
        notify(
          user.id,
          "badge",
          `Huy hiệu mới: ${BADGES[b].title}`,
          BADGES[b].description,
        );
      track(user.id, "practice.session", {
        lessonId: input.lessonId,
        mode: input.mode,
        xp,
      });
      return {
        session: { id, xp },
        newBadges: newBadges.map((b) => ({ id: b, ...BADGES[b] })),
        ...summary(user),
      };
    },

    history(user, { page, pageSize, offset }) {
      const days = planOf(user).features.practiceHistoryDays;
      const sinceIso = new Date(Date.now() - days * 86400_000).toISOString();
      const { total, items } = progress.sessions(user.id, {
        sinceIso,
        limit: pageSize,
        offset,
      });
      return { items, meta: { page, pageSize, total, historyDays: days } };
    },

    favorites: (user) => progress.favorites(user.id),
    addFavorite(user, lessonId) {
      lessonOr404(lessonId);
      progress.addFavorite(user.id, lessonId);
      return progress.favorites(user.id);
    },
    removeFavorite(user, lessonId) {
      progress.removeFavorite(user.id, lessonId);
      return progress.favorites(user.id);
    },

    /** Danh mục bài kèm cờ khoá theo gói (khách xem như Free). */
    catalog(user) {
      return lessons.map((l) => ({
        id: l.id,
        title: l.title,
        instrument: l.instrument,
        locked: !lessonAllowed(user, l, lessons),
      }));
    },
  };
}
