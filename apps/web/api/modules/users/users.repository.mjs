// Truy cập bảng users. Mọi truy vấn dùng tham số (?) để chống SQL injection.
import { syncPlan } from "../billing/periods.mjs";
import { nowIso } from "../../db/index.mjs";

const PUBLIC_COLS =
  "id, email, display_name, role, plan, plan_expires_at, (SELECT s.code FROM b2b_studios s JOIN users owner ON owner.id=s.owner_id WHERE s.code=users.b2b_partner_code AND owner.deleted_at IS NULL AND owner.plan='studio' AND (owner.plan_expires_at IS NULL OR owner.plan_expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))) AS b2b_partner_code, starter_instrument, locale, onboarding, email_verified_at, created_at, updated_at, deleted_at";

export function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    plan:
      row.plan_expires_at && Date.parse(row.plan_expires_at) <= Date.now()
        ? "free"
        : row.plan,
    planExpiresAt: row.plan_expires_at,
    starterInstrument: row.starter_instrument,
    b2bPartnerCode: row.b2b_partner_code,
    showB2cUpsell: !row.b2b_partner_code,
    locale: row.locale,
    onboarding: row.onboarding ? JSON.parse(row.onboarding) : null,
    emailVerified: Boolean(row.email_verified_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null,
  };
}

export const usersRepository = (db) => ({
  findById(id) {
    syncPlan(db, id);
    return toUser(
      db
        .prepare(
          `SELECT ${PUBLIC_COLS} FROM users WHERE id = ? AND deleted_at IS NULL`,
        )
        .get(id),
    );
  },
  /** Kể cả tài khoản đã khoá (xoá mềm) — dùng cho quản trị. */
  findByIdAny(id) {
    return toUser(
      db.prepare(`SELECT ${PUBLIC_COLS} FROM users WHERE id = ?`).get(id),
    );
  },
  findAuthByEmail(email) {
    return db
      .prepare(
        "SELECT id, password_hash, deleted_at FROM users WHERE email = ?",
      )
      .get(email);
  },
  passwordHash(id) {
    return db.prepare("SELECT password_hash FROM users WHERE id = ?").get(id)
      ?.password_hash;
  },
  create({
    email,
    passwordHash,
    displayName,
    role = "user",
    plan = "free",
    verified = false,
  }) {
    const r = db
      .prepare(
        "INSERT INTO users (email, password_hash, display_name, role, plan, email_verified_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        email,
        passwordHash,
        displayName,
        role,
        plan,
        verified ? nowIso() : null,
      );
    return Number(r.lastInsertRowid);
  },
  update(id, fields) {
    if (fields.plan !== undefined)
      db.prepare("DELETE FROM plan_periods WHERE user_id=?").run(id);
    const map = {
      displayName: "display_name",
      role: "role",
      plan: "plan",
      planExpiresAt: "plan_expires_at",
      locale: "locale",
      onboarding: "onboarding",
      passwordHash: "password_hash",
      emailVerifiedAt: "email_verified_at",
      deletedAt: "deleted_at",
    };
    const sets = [];
    const vals = [];
    for (const [k, col] of Object.entries(map)) {
      if (fields[k] === undefined) continue;
      sets.push(`${col} = ?`);
      vals.push(
        k === "onboarding" && fields[k] ? JSON.stringify(fields[k]) : fields[k],
      );
    }
    if (!sets.length) return;
    sets.push("updated_at = ?");
    vals.push(nowIso(), id);
    db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  },
  /** Danh sách có tìm kiếm, lọc, sắp xếp, phân trang (dành cho quản trị). */
  list({
    q,
    role,
    plan,
    status = "active",
    sort = "created_at",
    order = "desc",
    limit,
    offset,
  }) {
    const where = [];
    const vals = [];
    if (status === "active") where.push("deleted_at IS NULL");
    else if (status === "deleted") where.push("deleted_at IS NOT NULL");
    if (q) {
      where.push(
        "(email LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\')",
      );
      const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
      vals.push(like, like);
    }
    if (role) {
      where.push("role = ?");
      vals.push(role);
    }
    if (plan) {
      where.push("plan = ?");
      vals.push(plan);
    }
    const cols = {
      created_at: "created_at",
      email: "email",
      name: "display_name",
    };
    const sql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = db
      .prepare(`SELECT COUNT(*) AS n FROM users ${sql}`)
      .get(...vals).n;
    const rows = db
      .prepare(
        `SELECT ${PUBLIC_COLS} FROM users ${sql} ORDER BY ${cols[sort] ?? "created_at"} ${order === "asc" ? "ASC" : "DESC"}, id DESC LIMIT ? OFFSET ?`,
      )
      .all(...vals, limit, offset);
    return { total, items: rows.map(toUser) };
  },
});
