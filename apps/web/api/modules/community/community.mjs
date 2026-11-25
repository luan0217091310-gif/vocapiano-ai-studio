// Module Ghi chú cá nhân, Cộng đồng có kiểm duyệt, Rương thưởng & Bảng xếp hạng Trò chơi âm nhạc (Mục 4, 5, 7).
import { errors } from "../../core/http.mjs";

const STARTER_POSTS = [
  {
    author_name: "Minh Anh (Piano Cấp 2)",
    lesson_id: "TS01",
    kind: "achievement",
    content:
      "Mình vừa hoàn thành trọn bài Nơi Này Có Anh (Acoustic Ballad) ở tốc độ 100% đạt 3 ⭐ và mở được Rương Bạc! Đoạn điệp khúc ô 9–12 tập chậm ở 50% trước rồi tăng dần cực kỳ hiệu quả.",
    likes: 18,
  },
  {
    author_name: "Gia Huy (Sáo trúc C5)",
    lesson_id: "TS26",
    kind: "comment",
    content:
      "Bài Để Mị Nói Cho Mà Nghe bản Sáo trúc C5 thổi cuốn lắm mọi người ơi! Nhớ lấy hơi sâu ở cuối ô 4 và ô 8 như Gia Phong nhắc để nốt Đô6 không bị hụt hơi nhé.",
    likes: 14,
  },
  {
    author_name: "Thảo Nguyên (Acoustic Lover)",
    lesson_id: "TS04",
    kind: "achievement",
    content:
      "Thử tính năng Nhập nhạc tự động từ file MP3 Nàng Thơ ra ngay bản Piano 3 độ khó + Sáo C5, chỉnh lại 2 nốt trên trình sửa nhanh là đánh mượt từ đầu đến cuối luôn!",
    likes: 23,
  },
  {
    author_name: "CLB Sáo Trúc & Piano Học Đường",
    lesson_id: "TS15",
    kind: "challenge",
    content:
      "🔥 Thử thách nhóm tuần này: Cùng luyện trọn bài Quê Hương (TS15) hoặc River Flows in You (TS32) đạt từ 85% trở lên ở tốc độ 100% để nhận Huy hiệu Nghệ Sĩ Tuần và +150 XP!",
    likes: 31,
  },
];

const STARTER_SCORES = [
  {
    player: "Minh Anh · Piano",
    game_id: "falling_notes",
    difficulty: "hard",
    score: 980,
    stars: 3,
    xp: 45,
  },
  {
    player: "Gia Huy · Sáo C5",
    game_id: "flute_fingering",
    difficulty: "hard",
    score: 940,
    stars: 3,
    xp: 45,
  },
  {
    player: "Thảo Nguyên",
    game_id: "ear_training",
    difficulty: "medium",
    score: 890,
    stars: 3,
    xp: 35,
  },
  {
    player: "Hoàng Nam",
    game_id: "staff_reader",
    difficulty: "medium",
    score: 860,
    stars: 3,
    xp: 35,
  },
  {
    player: "Lan Chi",
    game_id: "rhythm_tap",
    difficulty: "hard",
    score: 920,
    stars: 3,
    xp: 40,
  },
  {
    player: "Đức Phúc Fan",
    game_id: "song_quiz",
    difficulty: "medium",
    score: 950,
    stars: 3,
    xp: 40,
  },
];

function seedIfNeeded(db) {
  const c = db.prepare("SELECT COUNT(*) AS n FROM community_posts").get();
  if ((c?.n ?? 0) === 0) {
    const ins = db.prepare(
      "INSERT INTO community_posts (author_name, lesson_id, kind, content, likes) VALUES (?, ?, ?, ?, ?)",
    );
    for (const p of STARTER_POSTS) {
      ins.run(p.author_name, p.lesson_id, p.kind, p.content, p.likes);
    }
  }
  const g = db.prepare("SELECT COUNT(*) AS n FROM game_scores").get();
  if ((g?.n ?? 0) === 0) {
    const insG = db.prepare(
      "INSERT INTO game_scores (player, game_id, difficulty, score, stars, xp) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const s of STARTER_SCORES) {
      insG.run(s.player, s.game_id, s.difficulty, s.score, s.stars, s.xp);
    }
  }
}

export function communityRoutes(router, db) {
  seedIfNeeded(db);

  // 0. TỔNG QUAN HỌC THUẬT & LỘ TRÌNH (ACADEMIC CURRICULUM OVERVIEW API)
  router.add({
    method: "GET",
    path: "/academic/overview",
    auth: "public",
    doc: "Tổng quan hệ thống học thuật VocaVerse (lộ trình 3 cấp độ, kho bài, thẻ kỹ năng kb://, trò chơi học thuật)",
    handler: () => {
      const userSongsCount =
        db.prepare("SELECT COUNT(*) AS n FROM user_songs").get()?.n ?? 0;
      const notesCount =
        db.prepare("SELECT COUNT(*) AS n FROM lesson_notes").get()?.n ?? 0;
      const postsCount =
        db
          .prepare("SELECT COUNT(*) AS n FROM community_posts WHERE hidden = 0")
          .get()?.n ?? 0;
      return {
        data: {
          ssotSchema: "vocascore/0.1",
          starterLessons: 22,
          fullTestSongs: 36,
          fullArrangements: 216,
          publicDomainClassics: 16,
          technicalExercises: 210,
          skillCardsKb: 24,
          academicGames: 6,
          userImportedSongs: userSongsCount,
          activeNotes: notesCount,
          communityPosts: postsCount,
          levels: [
            {
              code: "beginner",
              title: "Cấp 1 · Nhập môn",
              focus: "Tư thế D-40, 5 nốt Đô–Sol, âm đầu tiên & hơi đều Sáo C5",
            },
            {
              code: "easy",
              title: "Cấp 2 · Cơ bản",
              focus:
                "Phối hợp hai tay độc lập, hợp âm I–V7, trọn thang âm Sáo C5 & luyến",
            },
            {
              code: "intermediate",
              title: "Cấp 3 · Tự tin",
              focus:
                "Chơi trọn bài 20 ô nhịp (5 đoạn), hợp âm rải Ballad/Acoustic & quãng 2 Sáo C5",
            },
          ],
        },
      };
    },
  });

  // 1. GHI CHÚ THEO BÀI & Ô NHỊP
  router.add({
    method: "GET",
    path: "/notes",
    auth: "public",
    doc: "Lấy danh sách ghi chú cá nhân theo bài và ô nhịp",
    handler: ({ user, query }) => {
      if (!user) return { data: [] };
      const lessonId = query.get("lessonId");
      const rows = lessonId
        ? db
            .prepare(
              "SELECT id, lesson_id AS lessonId, bar_number AS barNumber, content, created_at AS createdAt FROM lesson_notes WHERE user_id = ? AND lesson_id = ? ORDER BY bar_number ASC, id DESC",
            )
            .all(user.id, lessonId)
        : db
            .prepare(
              "SELECT id, lesson_id AS lessonId, bar_number AS barNumber, content, created_at AS createdAt FROM lesson_notes WHERE user_id = ? ORDER BY id DESC LIMIT 100",
            )
            .all(user.id);
      return { data: rows };
    },
  });

  router.add({
    method: "POST",
    path: "/notes",
    auth: "user",
    doc: "Thêm ghi chú vào bài học hoặc ô nhịp cụ thể",
    handler: ({ user, body }) => {
      const lessonId = String(body?.lessonId || "PN01").slice(0, 40);
      const barNumber = Math.max(
        1,
        Math.min(200, Number(body?.barNumber) || 1),
      );
      const content = String(body?.content || "")
        .trim()
        .slice(0, 500);
      if (!content)
        throw errors.badRequest("Nội dung ghi chú không được để trống.");
      const info = db
        .prepare(
          "INSERT INTO lesson_notes (user_id, lesson_id, bar_number, content) VALUES (?, ?, ?, ?)",
        )
        .run(user.id, lessonId, barNumber, content);
      return {
        status: 201,
        data: {
          id: Number(info.lastInsertRowid),
          lessonId,
          barNumber,
          content,
        },
      };
    },
  });

  router.add({
    method: "DELETE",
    path: "/notes/:id",
    auth: "user",
    doc: "Xoá ghi chú cá nhân",
    handler: ({ user, params }) => {
      db.prepare("DELETE FROM lesson_notes WHERE id = ? AND user_id = ?").run(
        Number(params.id),
        user.id,
      );
      return { data: { deleted: true } };
    },
  });

  // 2. CỘNG ĐỒNG & KIỂM DUYỆT (BÁO CÁO, ẨN, CHẶN, DƯỚI 16 TUỔI CHỈ XEM)
  router.add({
    method: "GET",
    path: "/community/posts",
    auth: "public",
    doc: "Danh sách bài đăng, thành tích, bình luận và thử thách cộng đồng",
    handler: ({ user, query }) => {
      const lessonId = query.get("lessonId");
      const blocked = user
        ? new Set(
            db
              .prepare(
                "SELECT blocked_user_id FROM user_blocks WHERE user_id = ?",
              )
              .all(user.id)
              .map((r) => r.blocked_user_id),
          )
        : new Set();
      const rows = lessonId
        ? db
            .prepare(
              "SELECT * FROM community_posts WHERE hidden = 0 AND lesson_id = ? ORDER BY id DESC LIMIT 50",
            )
            .all(lessonId)
        : db
            .prepare(
              "SELECT * FROM community_posts WHERE hidden = 0 ORDER BY id DESC LIMIT 50",
            )
            .all();
      return {
        data: rows
          .filter((r) => !r.user_id || !blocked.has(r.user_id))
          .map((r) => ({
            id: r.id,
            userId: r.user_id,
            authorName: r.author_name,
            lessonId: r.lesson_id,
            kind: r.kind,
            content: r.content,
            likes: r.likes,
            reports: r.reports,
            createdAt: r.created_at,
          })),
      };
    },
  });

  router.add({
    method: "POST",
    path: "/community/posts",
    auth: "user",
    doc: "Đăng chia sẻ thành tích hoặc bình luận dưới bài học (chặn tự động nếu < 16 tuổi hoặc chứa ghi âm chưa đồng ý)",
    handler: ({ user, body }) => {
      if (body?.under16 === true) {
        throw errors.forbidden(
          "Tài khoản người học dưới 16 tuổi mặc định ở chế độ Chỉ xem cộng đồng để bảo vệ an toàn.",
        );
      }
      const content = String(body?.content || "")
        .trim()
        .slice(0, 600);
      if (!content)
        throw errors.badRequest("Nội dung chia sẻ không được để trống.");
      if (/\.(mp3|wav|mp4|webm|ogg)\b/i.test(content) && !body?.mediaConsent) {
        throw errors.forbidden(
          "Không tự đăng ghi âm hoặc hình ảnh của người học khi chưa có đồng ý rõ ràng (Cổng P1).",
        );
      }
      const lessonId = String(body?.lessonId || "TS01").slice(0, 40);
      const kind = ["comment", "achievement", "challenge"].includes(body?.kind)
        ? body.kind
        : "comment";
      const authorName = user.display_name || user.email.split("@")[0];
      const info = db
        .prepare(
          "INSERT INTO community_posts (user_id, author_name, lesson_id, kind, content) VALUES (?, ?, ?, ?, ?)",
        )
        .run(user.id, authorName, lessonId, kind, content);
      return {
        status: 201,
        data: {
          id: Number(info.lastInsertRowid),
          userId: user.id,
          authorName,
          lessonId,
          kind,
          content,
          likes: 0,
        },
      };
    },
  });

  router.add({
    method: "POST",
    path: "/community/posts/:id/like",
    auth: "public",
    doc: "Thả tim cổ vũ bài chia sẻ trong cộng đồng",
    handler: ({ params }) => {
      db.prepare(
        "UPDATE community_posts SET likes = likes + 1 WHERE id = ?",
      ).run(Number(params.id));
      const row = db
        .prepare("SELECT id, likes FROM community_posts WHERE id = ?")
        .get(Number(params.id));
      return { data: row ?? { id: Number(params.id), likes: 1 } };
    },
  });

  router.add({
    method: "POST",
    path: "/community/posts/:id/report",
    auth: "public",
    doc: "Báo cáo bình luận vi phạm (tự động ẩn khi có từ 3 báo cáo)",
    handler: ({ params }) => {
      db.prepare(
        "UPDATE community_posts SET reports = reports + 1, hidden = CASE WHEN reports + 1 >= 3 THEN 1 ELSE hidden END WHERE id = ?",
      ).run(Number(params.id));
      return {
        data: {
          id: Number(params.id),
          reported: true,
          message: "Đã ghi nhận báo cáo vi phạm để kiểm duyệt.",
        },
      };
    },
  });

  router.add({
    method: "POST",
    path: "/community/posts/:id/hide",
    auth: "public",
    doc: "Ẩn bình luận khỏi bảng tin cộng đồng",
    handler: ({ params }) => {
      db.prepare("UPDATE community_posts SET hidden = 1 WHERE id = ?").run(
        Number(params.id),
      );
      return { data: { id: Number(params.id), hidden: true } };
    },
  });

  router.add({
    method: "POST",
    path: "/community/block",
    auth: "user",
    doc: "Chặn người dùng vi phạm",
    handler: ({ user, body }) => {
      const targetId = Number(body?.blockedUserId);
      if (!targetId) throw errors.badRequest("Thiếu mã người dùng cần chặn.");
      db.prepare(
        "INSERT OR IGNORE INTO user_blocks (user_id, blocked_user_id) VALUES (?, ?)",
      ).run(user.id, targetId);
      return { data: { blockedUserId: targetId, blocked: true } };
    },
  });

  // 3. RƯƠNG THƯỞNG (REWARD CHESTS) & TRÒ CHƠI ÂM NHẠC (6 GAMES LEADERBOARD)
  router.add({
    method: "GET",
    path: "/rewards/summary",
    auth: "public",
    doc: "Tổng hợp XP, chuỗi ngày, huy hiệu và các rương thưởng đã mở",
    handler: ({ user }) => {
      const chests = user
        ? db
            .prepare(
              "SELECT chest_key AS chestKey, xp_awarded AS xpAwarded, claimed_at AS claimedAt FROM reward_chests WHERE user_id = ?",
            )
            .all(user.id)
        : [];
      const gameXp = user
        ? (db
            .prepare(
              "SELECT COALESCE(SUM(xp), 0) AS total FROM game_scores WHERE user_id = ?",
            )
            .get(user.id)?.total ?? 0)
        : 0;
      const chestXp = chests.reduce((s, c) => s + (c.xpAwarded || 0), 0);
      return {
        data: {
          claimedChests: chests.map((c) => c.chestKey),
          chests,
          bonusXp: chestXp + gameXp,
        },
      };
    },
  });

  router.add({
    method: "POST",
    path: "/rewards/chests/:key/claim",
    auth: "user",
    doc: "Mở rương thưởng khi hoàn thành mốc nhiệm vụ ngày hoặc chặng học",
    handler: ({ user, params }) => {
      const key = String(params.key || "chest_daily_1").slice(0, 40);
      const xpMap = {
        chest_daily_1: 50,
        chest_stage_1: 100,
        chest_master_1: 200,
      };
      const xp = xpMap[key] ?? 60;
      db.prepare(
        "INSERT OR IGNORE INTO reward_chests (user_id, chest_key, xp_awarded) VALUES (?, ?, ?)",
      ).run(user.id, key, xp);
      db.prepare(
        "INSERT OR IGNORE INTO user_badges (user_id, badge) VALUES (?, ?)",
      ).run(user.id, `badge_${key}`);
      return {
        data: {
          chestKey: key,
          xpAwarded: xp,
          badgeEarned: `badge_${key}`,
        },
      };
    },
  });

  router.add({
    method: "GET",
    path: "/games/leaderboard",
    auth: "public",
    doc: "Bảng xếp hạng cá nhân & thử thách tuần của 6 trò chơi âm nhạc",
    handler: ({ query }) => {
      const gameId = query.get("gameId");
      const rows = gameId
        ? db
            .prepare(
              "SELECT id, player, game_id AS gameId, difficulty, score, stars, xp, created_at AS createdAt FROM game_scores WHERE game_id = ? ORDER BY score DESC LIMIT 15",
            )
            .all(gameId)
        : db
            .prepare(
              "SELECT id, player, game_id AS gameId, difficulty, score, stars, xp, created_at AS createdAt FROM game_scores ORDER BY score DESC LIMIT 25",
            )
            .all();
      return { data: rows };
    },
  });

  router.add({
    method: "POST",
    path: "/games/score",
    auth: "public",
    doc: "Lưu điểm số, sao (1–3) và XP khi hoàn thành lượt chơi trong 6 trò chơi âm nhạc",
    handler: ({ user, body }) => {
      const gameId = String(body?.gameId || "falling_notes").slice(0, 40);
      const difficulty = ["easy", "medium", "hard"].includes(body?.difficulty)
        ? body.difficulty
        : "medium";
      const score = Math.max(0, Math.min(10000, Number(body?.score) || 0));
      const stars = score >= 850 ? 3 : score >= 600 ? 2 : 1;
      const xp =
        stars *
        (difficulty === "hard" ? 20 : difficulty === "medium" ? 15 : 10);
      const player =
        user?.display_name ||
        String(body?.player || "Học viên VocaVerse").slice(0, 40);
      const info = db
        .prepare(
          "INSERT INTO game_scores (user_id, player, game_id, difficulty, score, stars, xp) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(user?.id ?? null, player, gameId, difficulty, score, stars, xp);
      return {
        status: 201,
        data: {
          id: Number(info.lastInsertRowid),
          gameId,
          difficulty,
          score,
          stars,
          xp,
          player,
        },
      };
    },
  });
}
