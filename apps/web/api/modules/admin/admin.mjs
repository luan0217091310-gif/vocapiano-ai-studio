// Quản trị: người dùng (lọc/sắp xếp/phân trang, đổi vai trò/gói, khoá-mở), thống kê, sự kiện, liên hệ.
import { errors, pagination } from "../../core/http.mjs";
import { v, validate } from "../../core/validate.mjs";

export const adminRepository = (db) => ({
  stats() {
    const one = (sql, ...a) => db.prepare(sql).get(...a);
    const since = (days) =>
      new Date(Date.now() - days * 86400_000).toISOString();
    return {
      users: one("SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL").n,
      verified: one(
        "SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND email_verified_at IS NOT NULL",
      ).n,
      byPlan: db
        .prepare(
          "SELECT plan, COUNT(*) AS n FROM users WHERE deleted_at IS NULL GROUP BY plan",
        )
        .all()
        .reduce((o, r) => ({ ...o, [r.plan]: r.n }), {
          free: 0,
          plus: 0,
          studio: 0,
        }),
      activeUsers7d: one(
        "SELECT COUNT(DISTINCT user_id) AS n FROM practice_sessions WHERE created_at >= ?",
        since(7),
      ).n,
      sessions7d: one(
        "SELECT COUNT(*) AS n FROM practice_sessions WHERE created_at >= ?",
        since(7),
      ).n,
      revenueSandboxVnd: one(
        "SELECT COALESCE(SUM(amount_vnd),0) AS n FROM payments WHERE status = 'paid'",
      ).n,
      openContacts: one(
        "SELECT COUNT(*) AS n FROM contact_messages WHERE handled_at IS NULL",
      ).n,
      // 14 ngày gần nhất: lượt tập và người đăng ký mới theo ngày (giờ VN).
      daily: db
        .prepare(
          `WITH RECURSIVE d(day) AS (SELECT date('now','+7 hours','-13 days') UNION ALL SELECT date(day,'+1 day') FROM d WHERE day < date('now','+7 hours'))
           SELECT d.day,
             (SELECT COUNT(*) FROM practice_sessions s WHERE s.day = d.day) AS sessions,
             (SELECT COUNT(*) FROM users u WHERE date(u.created_at,'+7 hours') = d.day) AS signups
           FROM d ORDER BY d.day`,
        )
        .all(),
      topLessons: db
        .prepare(
          "SELECT lesson_id AS lessonId, COUNT(*) AS sessions FROM practice_sessions WHERE created_at >= ? GROUP BY lesson_id ORDER BY sessions DESC LIMIT 5",
        )
        .all(since(30)),
    };
  },
  events({ name, limit, offset }) {
    const where = name ? "WHERE name = ?" : "";
    const args = name ? [name] : [];
    return {
      total: db
        .prepare(`SELECT COUNT(*) AS n FROM events ${where}`)
        .get(...args).n,
      items: db
        .prepare(
          `SELECT id, user_id AS userId, name, props, created_at AS createdAt FROM events ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
        )
        .all(...args, limit, offset)
        .map((e) => ({ ...e, props: e.props ? JSON.parse(e.props) : null })),
      names: db
        .prepare(
          "SELECT name, COUNT(*) AS n FROM events GROUP BY name ORDER BY n DESC",
        )
        .all(),
    };
  },
  contacts({ limit, offset }) {
    return {
      total: db.prepare("SELECT COUNT(*) AS n FROM contact_messages").get().n,
      items: db
        .prepare(
          "SELECT id, name, email, topic, message, handled_at AS handledAt, created_at AS createdAt FROM contact_messages ORDER BY handled_at IS NOT NULL, id DESC LIMIT ? OFFSET ?",
        )
        .all(limit, offset),
    };
  },
  handleContact(id) {
    return db
      .prepare(
        "UPDATE contact_messages SET handled_at = ? WHERE id = ? AND handled_at IS NULL",
      )
      .run(new Date().toISOString(), id).changes;
  },
});

export function adminController({ repo, users, authRepo, notify, track }) {
  const target = (ctx) => {
    const { id } = validate(
      { id: v.string({ max: 12, pattern: /^\d+$/ }) },
      ctx.params,
    );
    return Number(id);
  };
  return {
    stats: () => ({ data: repo.stats() }),
    users(ctx) {
      const p = pagination(ctx.query);
      const q = ctx.query;
      const filters = validate(
        {
          q: v.optional(v.string({ max: 80 })),
          role: v.optional(v.oneOf(["user", "admin"])),
          plan: v.optional(
            v.oneOf(["free", "starter", "plus", "founder", "studio"]),
          ),
          status: v.optional(v.oneOf(["active", "deleted", "all"])),
          sort: v.optional(v.oneOf(["created_at", "email", "name"])),
          order: v.optional(v.oneOf(["asc", "desc"])),
        },
        Object.fromEntries([...q.entries()].filter(([, val]) => val !== "")),
      );
      const { total, items } = users.list({
        ...filters,
        limit: p.pageSize,
        offset: p.offset,
      });
      return {
        data: items,
        meta: { page: p.page, pageSize: p.pageSize, total },
      };
    },
    updateUser(ctx) {
      const id = target(ctx);
      const body = validate(
        {
          role: v.optional(v.oneOf(["user", "admin"])),
          plan: v.optional(
            v.oneOf(["free", "starter", "plus", "founder", "studio"]),
          ),
          active: v.optional(v.bool()),
        },
        ctx.body,
      );
      if (id === ctx.user.id && (body.role === "user" || body.active === false))
        throw errors.badRequest(
          "Không thể tự hạ quyền hoặc tự khoá tài khoản của mình.",
        );
      const exists = users.findByIdAny(id);
      if (!exists) throw errors.notFound("Không tìm thấy người dùng.");
      const fields = {
        role: body.role,
        plan: body.plan,
        planExpiresAt: body.plan ? null : undefined,
      };
      if (body.active === false) fields.deletedAt = new Date().toISOString();
      if (body.active === true) fields.deletedAt = null;
      users.update(id, fields);
      if (body.active === false) authRepo.revokeAllRefresh(id);
      if (body.plan && body.plan !== exists.plan)
        notify(
          id,
          "billing",
          `Gói của bạn đã đổi sang ${body.plan}`,
          "Thay đổi do quản trị viên thực hiện.",
        );
      track(ctx.user.id, "admin.update_user", { target: id, ...body });
      return { data: users.findByIdAny(id) };
    },
    events(ctx) {
      const p = pagination(ctx.query, { pageSize: 50 });
      const name = ctx.query.get("name") || undefined;
      const { total, items, names } = repo.events({
        name,
        limit: p.pageSize,
        offset: p.offset,
      });
      return {
        data: items,
        meta: { page: p.page, pageSize: p.pageSize, total, names },
      };
    },
    contacts(ctx) {
      const p = pagination(ctx.query);
      const { total, items } = repo.contacts({
        limit: p.pageSize,
        offset: p.offset,
      });
      return {
        data: items,
        meta: { page: p.page, pageSize: p.pageSize, total },
      };
    },
    handleContact(ctx) {
      if (!repo.handleContact(target(ctx)))
        throw errors.notFound("Không tìm thấy liên hệ chưa xử lý.");
      return { data: { handled: true } };
    },
  };
}

export function adminRoutes(router, c) {
  router.add({
    method: "GET",
    path: "/admin/stats",
    auth: "admin",
    handler: c.stats,
    doc: "Thống kê tổng quan",
  });
  router.add({
    method: "GET",
    path: "/admin/users",
    auth: "admin",
    handler: c.users,
    doc: "Danh sách người dùng",
  });
  router.add({
    method: "PATCH",
    path: "/admin/users/:id",
    auth: "admin",
    handler: c.updateUser,
    doc: "Đổi vai trò/gói, khoá/mở",
  });
  router.add({
    method: "GET",
    path: "/admin/events",
    auth: "admin",
    handler: c.events,
    doc: "Sự kiện analytics",
  });
  router.add({
    method: "GET",
    path: "/admin/contacts",
    auth: "admin",
    handler: c.contacts,
    doc: "Tin nhắn liên hệ",
  });
  router.add({
    method: "POST",
    path: "/admin/contacts/:id/handle",
    auth: "admin",
    handler: c.handleContact,
    doc: "Đánh dấu đã xử lý",
  });
}
