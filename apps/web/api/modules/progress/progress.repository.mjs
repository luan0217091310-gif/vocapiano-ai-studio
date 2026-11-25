// Lượt luyện tập, yêu thích, huy hiệu.
export const progressRepository = (db) => ({
  insertSession({ userId, lessonId, mode, accuracy, durationS, xp, day }) {
    const r = db
      .prepare(
        "INSERT INTO practice_sessions (user_id, lesson_id, mode, accuracy, duration_s, xp, day) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(userId, lessonId, mode, accuracy, durationS, xp, day);
    return Number(r.lastInsertRowid);
  },
  sessions(userId, { sinceIso, limit, offset }) {
    const total = db
      .prepare(
        "SELECT COUNT(*) AS n FROM practice_sessions WHERE user_id = ? AND created_at >= ?",
      )
      .get(userId, sinceIso).n;
    const items = db
      .prepare(
        "SELECT id, lesson_id AS lessonId, mode, accuracy, duration_s AS durationS, xp, day, created_at AS createdAt FROM practice_sessions WHERE user_id = ? AND created_at >= ? ORDER BY id DESC LIMIT ? OFFSET ?",
      )
      .all(userId, sinceIso, limit, offset);
    return { total, items };
  },
  practiceDays(userId) {
    return db
      .prepare(
        "SELECT DISTINCT day FROM practice_sessions WHERE user_id = ? ORDER BY day DESC LIMIT 400",
      )
      .all(userId)
      .map((r) => r.day);
  },
  totals(userId) {
    return db
      .prepare(
        "SELECT COUNT(*) AS sessions, COALESCE(SUM(xp),0) AS xp, COALESCE(SUM(duration_s),0) AS seconds, COUNT(DISTINCT lesson_id) AS lessons, COALESCE(MAX(accuracy),0) AS bestAccuracy FROM practice_sessions WHERE user_id = ?",
      )
      .get(userId);
  },
  badges(userId) {
    return db
      .prepare(
        "SELECT badge, earned_at AS earnedAt FROM user_badges WHERE user_id = ? ORDER BY earned_at",
      )
      .all(userId);
  },
  /** Trả true nếu huy hiệu mới được trao (chưa có trước đó). */
  award(userId, badge) {
    return (
      db
        .prepare(
          "INSERT OR IGNORE INTO user_badges (user_id, badge) VALUES (?, ?)",
        )
        .run(userId, badge).changes > 0
    );
  },
  favorites(userId) {
    return db
      .prepare(
        "SELECT lesson_id AS lessonId, created_at AS createdAt FROM favorites WHERE user_id = ? ORDER BY created_at DESC",
      )
      .all(userId);
  },
  addFavorite(userId, lessonId) {
    db.prepare(
      "INSERT OR IGNORE INTO favorites (user_id, lesson_id) VALUES (?, ?)",
    ).run(userId, lessonId);
  },
  removeFavorite(userId, lessonId) {
    db.prepare("DELETE FROM favorites WHERE user_id = ? AND lesson_id = ?").run(
      userId,
      lessonId,
    );
  },
});
