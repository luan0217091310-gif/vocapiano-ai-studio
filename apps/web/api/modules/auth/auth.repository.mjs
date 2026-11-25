// Token phiên (refresh) và token email (xác minh, đặt lại mật khẩu). Chỉ lưu hash SHA-256 của token.
import { nowIso } from "../../db/index.mjs";

const inSeconds = (s) => new Date(Date.now() + s * 1000).toISOString();

export const authRepository = (db) => ({
  saveRefresh(userId, tokenHash, ttl) {
    db.prepare(
      "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    ).run(userId, tokenHash, inSeconds(ttl));
  },
  findRefresh(tokenHash) {
    return db
      .prepare(
        "SELECT id, user_id, expires_at, revoked_at, rotated_at FROM refresh_tokens WHERE token_hash = ?",
      )
      .get(tokenHash);
  },
  /** Thu hồi một token (đăng xuất): không còn ân hạn. */
  revokeRefresh(id) {
    db.prepare(
      "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, ?), rotated_at = NULL WHERE id = ?",
    ).run(nowIso(), id);
  },
  /** Đánh dấu token đã được thay bằng token mới (xoay vòng): còn ân hạn ngắn. */
  rotateRefresh(id) {
    const now = nowIso();
    db.prepare(
      "UPDATE refresh_tokens SET revoked_at = ?, rotated_at = ? WHERE id = ? AND revoked_at IS NULL",
    ).run(now, now, id);
  },
  /** Thu hồi mọi phiên của người dùng (đổi mật khẩu, khoá, nghi đánh cắp): huỷ cả ân hạn. */
  revokeAllRefresh(userId) {
    db.prepare(
      "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, ?), rotated_at = NULL WHERE user_id = ?",
    ).run(nowIso(), userId);
  },
  saveEmailToken(userId, purpose, tokenHash, ttl) {
    db.prepare(
      "UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL",
    ).run(nowIso(), userId, purpose);
    db.prepare(
      "INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, ?)",
    ).run(userId, purpose, tokenHash, inSeconds(ttl));
  },
  /** Lấy và đánh dấu đã dùng (dùng một lần). Trả null nếu sai, hết hạn hoặc đã dùng. */
  consumeEmailToken(purpose, tokenHash) {
    const row = db
      .prepare(
        "SELECT id, user_id, expires_at, used_at FROM email_tokens WHERE token_hash = ? AND purpose = ?",
      )
      .get(tokenHash, purpose);
    if (!row || row.used_at || row.expires_at < nowIso()) return null;
    db.prepare("UPDATE email_tokens SET used_at = ? WHERE id = ?").run(
      nowIso(),
      row.id,
    );
    return row.user_id;
  },
  /** Xoá token hết hạn hoặc đã dùng/thu hồi quá 7 ngày; trả số dòng đã xoá. */
  purgeExpired(now = new Date()) {
    const nowIso = now.toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 86400_000).toISOString();
    const a = db
      .prepare(
        "DELETE FROM refresh_tokens WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)",
      )
      .run(nowIso, weekAgo).changes;
    const b = db
      .prepare(
        "DELETE FROM email_tokens WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)",
      )
      .run(nowIso, weekAgo).changes;
    return a + b;
  },
  mailbox(limit = 50) {
    return db
      .prepare(
        'SELECT id, to_email AS "to", subject, body, created_at AS createdAt FROM outbox ORDER BY id DESC LIMIT ?',
      )
      .all(limit);
  },
});
