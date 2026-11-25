// Thông báo trong ứng dụng + theo dõi sự kiện (analytics) + form liên hệ.
// Gộp một module vì cả ba đều nhỏ; tách lớp repository / service / controller bên trong.
import { pagination } from "../../core/http.mjs";
import { v, validate } from "../../core/validate.mjs";

// ---- repository
export const engagementRepository = (db) => ({
  notify(userId, kind, title, body) {
    db.prepare(
      "INSERT INTO notifications (user_id, kind, title, body) VALUES (?, ?, ?, ?)",
    ).run(userId, kind, title, body);
  },
  notifications(userId, { limit, offset }) {
    const total = db
      .prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?")
      .get(userId).n;
    const unread = db
      .prepare(
        "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL",
      )
      .get(userId).n;
    const items = db
      .prepare(
        "SELECT id, kind, title, body, read_at AS readAt, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
      )
      .all(userId, limit, offset);
    return { total, unread, items };
  },
  markRead(userId, id) {
    const now = new Date().toISOString();
    if (id === "all")
      db.prepare(
        "UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL",
      ).run(now, userId);
    else
      db.prepare(
        "UPDATE notifications SET read_at = ? WHERE user_id = ? AND id = ? AND read_at IS NULL",
      ).run(now, userId, Number(id));
  },
  track(userId, name, props) {
    db.prepare(
      "INSERT INTO events (user_id, name, props) VALUES (?, ?, ?)",
    ).run(
      userId ?? null,
      name,
      props && Object.keys(props).length ? JSON.stringify(props) : null,
    );
  },
  contact({ name, email, topic, message }) {
    db.prepare(
      "INSERT INTO contact_messages (name, email, topic, message) VALUES (?, ?, ?, ?)",
    ).run(name, email, topic, message);
  },
});

// Tên sự kiện client được phép gửi (chặn rác vào bảng events).
const CLIENT_EVENTS = [
  "page.view",
  "lesson.open",
  "studio.start",
  "studio.finish",
  "demo3d.play",
  "pricing.view",
  "upgrade.click",
];

// ---- controller
export function engagementController({ repo }) {
  return {
    list(ctx) {
      const p = pagination(ctx.query);
      const { total, unread, items } = repo.notifications(ctx.user.id, {
        limit: p.pageSize,
        offset: p.offset,
      });
      return {
        data: items,
        meta: { page: p.page, pageSize: p.pageSize, total, unread },
      };
    },
    read(ctx) {
      const { id } = validate(
        { id: v.string({ max: 12, pattern: /^(all|\d+)$/ }) },
        ctx.params,
      );
      repo.markRead(ctx.user.id, id);
      return { data: { ok: true } };
    },
    event(ctx) {
      const body = validate(
        {
          name: v.oneOf(CLIENT_EVENTS),
          path: v.optional(v.string({ max: 200 })),
          lessonId: v.optional(v.string({ max: 20 })),
        },
        ctx.body,
      );
      const { name, ...props } = body;
      repo.track(ctx.user?.id, name, props);
      return { data: { ok: true }, status: 202 };
    },
    contact(ctx) {
      const body = validate(
        {
          name: v.string({ min: 1, max: 80 }),
          email: v.email(),
          topic: v.oneOf(["support", "school", "partnership", "other"]),
          message: v.string({ min: 10, max: 2000 }),
        },
        ctx.body,
      );
      repo.contact(body);
      repo.track(ctx.user?.id, "contact.submit", { topic: body.topic });
      return { data: { received: true }, status: 201 };
    },
  };
}

export function engagementRoutes(router, c) {
  router.add({
    method: "GET",
    path: "/me/notifications",
    auth: "user",
    handler: c.list,
    doc: "Thông báo của tôi",
  });
  router.add({
    method: "POST",
    path: "/me/notifications/:id/read",
    auth: "user",
    handler: c.read,
    doc: "Đánh dấu đã đọc (id hoặc all)",
  });
  router.add({
    method: "POST",
    path: "/events",
    auth: "optional",
    rate: "events",
    handler: c.event,
    doc: "Ghi sự kiện analytics",
  });
  router.add({
    method: "POST",
    path: "/contact",
    auth: "optional",
    rate: "auth",
    handler: c.contact,
    doc: "Gửi liên hệ",
  });
}
