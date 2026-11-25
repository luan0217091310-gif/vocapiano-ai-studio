import { randomBytes } from "node:crypto";
import { PLANS } from "../billing/plans.mjs";
const PLAN_SEATS = PLANS.studio.features.teacherSeats;
import { errors } from "../../core/http.mjs";
import { tx, nowIso } from "../../db/index.mjs";
import { v, validate } from "../../core/validate.mjs";
import { weekStart } from "../progress/gamification.mjs";

const vnDay = (d = new Date()) =>
  new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 10);

export function studioRoutes(router, db) {
  router.add({
    method: "POST",
    path: "/b2b/studios",
    auth: "user",
    doc: "Tạo phòng đàn đồng thương hiệu bằng tài khoản Studio",
    handler: ({ user, body }) => {
      if (user.plan !== "studio") throw errors.forbidden();
      const { name } = validate({ name: v.string({ min: 1, max: 80 }) }, body);
      if (db.prepare("SELECT 1 FROM b2b_studios WHERE owner_id=?").get(user.id))
        throw errors.conflict("Đã có phòng đàn.");
      const code = randomBytes(8).toString("hex").toUpperCase();
      db.prepare("INSERT INTO b2b_studios VALUES(?,?,?)").run(
        code,
        name,
        user.id,
      );
      return { status: 201, data: { code, name } };
    },
  });
  router.add({
    method: "PUT",
    path: "/b2b/enrollment",
    auth: "user",
    doc: "Gắn mã phòng hoặc thay đổi đồng ý chia sẻ từ thời điểm hiện tại",
    handler: ({ user, body }) =>
      tx(db, () => {
        const { code, sharePractice } = validate(
          { code: v.string({ min: 1, max: 32 }), sharePractice: v.bool() },
          body,
        );
        const room = db
          .prepare(
            "SELECT s.* FROM b2b_studios s JOIN users u ON u.id=s.owner_id WHERE s.code=? AND u.deleted_at IS NULL AND u.plan='studio' AND (u.plan_expires_at IS NULL OR u.plan_expires_at>?)",
          )
          .get(code.toUpperCase(), nowIso());
        if (!room) throw errors.notFound("Phòng không hoạt động.");
        if (room.owner_id === user.id)
          throw errors.conflict(
            "Chủ phòng không thể ghi danh vào phòng của mình.",
          );
        db.prepare(
          "INSERT INTO b2b_enrollments VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET studio_code=excluded.studio_code,share=excluded.share,since=CASE WHEN studio_code=excluded.studio_code AND share=excluded.share THEN since ELSE excluded.since END",
        ).run(user.id, room.code, Number(sharePractice), nowIso());
        db.prepare("UPDATE users SET b2b_partner_code=? WHERE id=?").run(
          room.code,
          user.id,
        );
        return {
          data: {
            code: room.code,
            name: room.name,
            sharePractice,
            showB2cUpsell: false,
          },
        };
      }),
  });
  router.add({
    method: "DELETE",
    path: "/b2b/enrollment",
    auth: "user",
    doc: "Rời phòng và thu hồi chia sẻ",
    handler: ({ user }) =>
      tx(db, () => {
        db.prepare("DELETE FROM b2b_enrollments WHERE user_id=?").run(user.id);
        db.prepare("UPDATE users SET b2b_partner_code=NULL WHERE id=?").run(
          user.id,
        );
        return { data: { left: true } };
      }),
  });
  router.add({
    method: "GET",
    path: "/b2b/studio",
    auth: "user",
    doc: "Bảng lớp của chủ phòng đàn: chỉ thời lượng tập tuần này và bài đã học của học viên đã đồng ý chia sẻ. Sắp theo tên, không xếp hạng.",
    handler: ({ user }) => {
      if (user.plan !== "studio") throw errors.forbidden();
      const room = db
        .prepare("SELECT code,name FROM b2b_studios WHERE owner_id=?")
        .get(user.id);
      if (!room) return { data: null };
      const week = weekStart(vnDay());
      const seatsUsed = db
        .prepare(
          "SELECT count(*) n FROM b2b_enrollments e JOIN users u ON u.id=e.user_id WHERE e.studio_code=? AND u.deleted_at IS NULL",
        )
        .get(room.code).n;
      const enrolled = db
        .prepare(
          "SELECT u.id,u.display_name AS name,e.since FROM b2b_enrollments e JOIN users u ON u.id=e.user_id WHERE e.studio_code=? AND e.share=1 AND u.deleted_at IS NULL ORDER BY u.display_name COLLATE NOCASE",
        )
        .all(room.code);
      const week$ = db.prepare(
        "SELECT COALESCE(SUM(duration_s),0) s,count(*) n,count(DISTINCT day) d FROM practice_sessions WHERE user_id=? AND created_at>=? AND day>=?",
      );
      const lessons$ = db.prepare(
        "SELECT DISTINCT lesson_id l FROM practice_sessions WHERE user_id=? AND created_at>=? ORDER BY lesson_id",
      );
      const last$ = db.prepare(
        "SELECT max(created_at) t FROM practice_sessions WHERE user_id=? AND created_at>=?",
      );
      const students = enrolled.map((st) => {
        const w = week$.get(st.id, st.since, week);
        return {
          id: st.id,
          name: st.name,
          minutesWeek: Math.round(w.s / 60),
          sessionsWeek: w.n,
          daysWeek: w.d,
          lessons: lessons$.all(st.id, st.since).map((r) => r.l),
          lastActiveAt: last$.get(st.id, st.since).t,
        };
      });
      return {
        data: {
          code: room.code,
          name: room.name,
          seats: PLAN_SEATS,
          seatsUsed,
          weekStart: week,
          students,
        },
      };
    },
  });
  router.add({
    method: "GET",
    path: "/b2b/studios/:code/practice",
    auth: "user",
    doc: "Tổng thời gian theo bài của học viên đồng ý, kể từ khi đồng ý.",
    handler: ({ user, params }) => {
      if (
        user.plan !== "studio" ||
        !db
          .prepare("SELECT 1 FROM b2b_studios WHERE owner_id=? AND code=?")
          .get(user.id, params.code)
      )
        throw errors.forbidden();
      return {
        data: db
          .prepare(
            "SELECT p.lesson_id AS lessonId,SUM(p.duration_s) AS durationS FROM practice_sessions p JOIN b2b_enrollments e ON e.user_id=p.user_id JOIN users u ON u.id=e.user_id WHERE e.studio_code=? AND e.share=1 AND u.deleted_at IS NULL AND p.created_at>=e.since GROUP BY p.lesson_id ORDER BY p.lesson_id",
          )
          .all(params.code),
      };
    },
  });
}
export function goalRoutes(router, db) {
  const path = "/me/weekly-goal";
  router.add({
    method: "GET",
    path,
    auth: "user",
    doc: "Mục tiêu luyện tập cá nhân trong tuần",
    handler: ({ user }) => ({
      data: db
        .prepare("SELECT minutes,days FROM weekly_goals WHERE user_id=?")
        .get(user.id) ?? { minutes: 60, days: 3 },
    }),
  });
  router.add({
    method: "PUT",
    path,
    auth: "user",
    doc: "Đặt tổng số phút và số ngày tập mỗi tuần",
    handler: ({ user, body }) => {
      const { minutes, days } = validate(
        {
          minutes: v.int({ min: 1, max: 10080 }),
          days: v.int({ min: 1, max: 7 }),
        },
        body,
      );
      db.prepare(
        "INSERT INTO weekly_goals VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET minutes=excluded.minutes,days=excluded.days",
      ).run(user.id, minutes, days);
      return { data: { minutes, days } };
    },
  });
}
