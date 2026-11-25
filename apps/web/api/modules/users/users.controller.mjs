// Hồ sơ và cài đặt của chính người dùng.
import { v, validate } from "../../core/validate.mjs";
import { errors } from "../../core/http.mjs";
import { verifyPassword } from "../../core/security.mjs";

export function usersController({ db, users, authRepo, track }) {
  return {
    updateProfile(ctx) {
      const body = validate(
        {
          displayName: v.optional(v.string({ min: 1, max: 60 })),
          locale: v.optional(v.oneOf(["vi", "en"])),
        },
        ctx.body,
      );
      users.update(ctx.user.id, body);
      return { data: { user: users.findById(ctx.user.id) } };
    },
    saveOnboarding(ctx) {
      const body = validate(
        {
          instrument: v.oneOf(["piano", "sao_truc"]),
          level: v.oneOf(["new", "basic", "returning"]),
          device: v.oneOf(["midi", "mic", "virtual"]),
          time: v.oneOf(["10", "15", "30"]),
          skipped: v.optional(v.bool()),
        },
        ctx.body,
      );
      users.update(ctx.user.id, { onboarding: { ...body, complete: true } });
      track(ctx.user.id, "onboarding.complete", body);
      return { data: { user: users.findById(ctx.user.id) } };
    },
    getConsents(ctx) {
      const rows = db
        ? db
            .prepare(
              "SELECT consent_type AS consentType, granted, note, updated_at AS updatedAt FROM user_consents WHERE user_id=?",
            )
            .all(ctx.user.id)
        : [];
      return {
        data: rows.map((r) => ({ ...r, granted: Boolean(r.granted) })),
      };
    },
    saveConsent(ctx) {
      const body = validate(
        {
          consentType: v.oneOf([
            "terms_privacy",
            "parent_guardian",
            "b2b_studio_share",
            "local_mic_only",
          ]),
          granted: v.bool(),
          note: v.optional(v.string({ min: 0, max: 200 })),
        },
        ctx.body,
      );
      if (db) {
        db.prepare(
          `INSERT INTO user_consents (user_id, consent_type, granted, note, updated_at)
           VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
           ON CONFLICT(user_id, consent_type) DO UPDATE SET
             granted=excluded.granted, note=excluded.note, updated_at=excluded.updated_at`,
        ).run(
          ctx.user.id,
          body.consentType,
          Number(body.granted),
          body.note ?? null,
        );
      }
      return this.getConsents(ctx);
    },
    exportData(ctx) {
      const profile = users.findById(ctx.user.id);
      const sessions = db
        ? db
            .prepare(
              "SELECT lesson_id AS lessonId, mode, accuracy, duration_s AS durationS, xp, day, created_at AS createdAt FROM practice_sessions WHERE user_id=? ORDER BY id DESC LIMIT 500",
            )
            .all(ctx.user.id)
        : [];
      const consents = this.getConsents(ctx).data;
      return {
        data: {
          exportedAt: new Date().toISOString(),
          user: profile,
          consents,
          sessions,
        },
      };
    },
    /** Xoá mềm tài khoản: cần nhập lại mật khẩu; thu hồi mọi phiên. */
    async deleteAccount(ctx) {
      const { password } = validate(
        { password: v.string({ min: 1, max: 128, trim: false }) },
        ctx.body,
      );
      if (!(await verifyPassword(password, users.passwordHash(ctx.user.id))))
        throw errors.badRequest("Mật khẩu không đúng.", {
          password: "không đúng",
        });
      users.update(ctx.user.id, { deletedAt: new Date().toISOString() });
      authRepo.revokeAllRefresh(ctx.user.id);
      track(ctx.user.id, "account.delete", {});
      return { data: { deleted: true } };
    },
  };
}

export function usersRoutes(router, c) {
  router.add({
    method: "PATCH",
    path: "/me",
    auth: "user",
    handler: c.updateProfile,
    doc: "Cập nhật hồ sơ",
  });
  router.add({
    method: "PUT",
    path: "/me/onboarding",
    auth: "user",
    handler: c.saveOnboarding,
    doc: "Lưu khảo sát đầu vào",
  });
  router.add({
    method: "GET",
    path: "/me/consents",
    auth: "user",
    handler: (ctx) => c.getConsents(ctx),
    doc: "Danh sách đồng ý quyền riêng tư & phụ huynh (D-21, D-30)",
  });
  router.add({
    method: "PUT",
    path: "/me/consents",
    auth: "user",
    handler: (ctx) => c.saveConsent(ctx),
    doc: "Cập nhật đồng ý quyền riêng tư / phụ huynh",
  });
  router.add({
    method: "GET",
    path: "/me/export",
    auth: "user",
    handler: (ctx) => c.exportData(ctx),
    doc: "Xuất toàn bộ dữ liệu cá nhân & lịch sử tập ra JSON",
  });
  router.add({
    method: "DELETE",
    path: "/me",
    auth: "user",
    rate: "auth",
    handler: c.deleteAccount,
    doc: "Xoá tài khoản (xoá mềm)",
  });
}
