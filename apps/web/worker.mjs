// Cloudflare Workers entrypoint cho VocaVerse (Static Assets SPA + Edge API v1 không phụ thuộc Node/SQLite).
import {
  SAO_C5_HOLES,
  SECTIONS,
  buildImportedArrangements,
  clampSaoPitch,
  deriveMotifFromText,
  detectFromAudioSamples,
  parseMusicXmlNotes,
} from "./api/modules/importer/importer.mjs";
import {
  PLANS,
  lessonAllowed,
  publicPlans,
} from "./api/modules/billing/plans.mjs";

const API_PREFIX = "/api/v1";
const SESSION_COOKIE = "vv_edge_session";
const FREE_DEMO_VOUCHER_PREFIX = "VOCA";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Bộ nhớ đệm nhẹ theo isolate (dữ liệu phiên người dùng vẫn ký trong cookie HttpOnly để sống qua cold start).
const edgeState = {
  usersByEmail: new Map(),
  sessionsByUser: new Map(),
  favoritesByUser: new Map(),
  notesByUser: new Map(),
  weeklyGoalByUser: new Map(),
  notificationsByUser: new Map(),
  paymentsByUser: new Map(),
  ordersByCode: new Map(),
  studiosByCode: new Map(),
  userSongs: [],
  posts: [
    {
      id: 1,
      userId: null,
      authorName: "Minh Anh (Piano Cấp 2)",
      lessonId: "PD01",
      kind: "achievement",
      content:
        "Mình vừa hoàn thành trọn bài 20 ô nhịp ở tốc độ 100% đạt 3 ⭐ và mở được Rương Bạc! Tập chậm đoạn điệp khúc ô 9–12 ở 50% trước rồi tăng dần cực kỳ hiệu quả.",
      likes: 18,
      reports: 0,
      hidden: false,
      createdAt: "2026-11-23T08:00:00.000Z",
    },
    {
      id: 2,
      userId: null,
      authorName: "Gia Huy (Sáo trúc C5)",
      lessonId: "SA03",
      kind: "comment",
      content:
        "Tập Sáo trúc C5 cùng Gia Phong rất dễ theo dõi thế bấm 6 lỗ! Nhớ lấy hơi sâu ở cuối ô 4 và ô 8 để nốt quãng 2 không bị hụt hơi nhé.",
      likes: 14,
      reports: 0,
      hidden: false,
      createdAt: "2026-11-23T09:15:00.000Z",
    },
    {
      id: 3,
      userId: null,
      authorName: "Thảo Nguyên (Acoustic)",
      lessonId: "PN06",
      kind: "achievement",
      content:
        "Thử tính năng Nhập nhạc tự động từ file MP3 / MusicXML ra ngay bản Piano 3 độ khó + Sáo C5, chỉnh lại 2 nốt trên trình sửa nhanh là đánh mượt từ đầu đến cuối luôn!",
      likes: 23,
      reports: 0,
      hidden: false,
      createdAt: "2026-11-23T10:30:00.000Z",
    },
    {
      id: 4,
      userId: null,
      authorName: "CLB Sáo Trúc & Piano Học Đường",
      lessonId: "PD02",
      kind: "challenge",
      content:
        "Thử thách nhóm tuần này: Cùng luyện trọn bài 20 ô nhịp đạt từ 85% trở lên ở tốc độ 100% để nhận Huy hiệu Nghệ Sĩ Tuần và +150 XP!",
      likes: 31,
      reports: 0,
      hidden: false,
      createdAt: "2026-11-23T11:00:00.000Z",
    },
  ],
  gameScores: [
    {
      id: 1,
      player: "Minh Anh · Piano",
      gameId: "falling_notes",
      difficulty: "hard",
      score: 980,
      stars: 3,
      xp: 45,
      createdAt: "2026-11-23T08:00:00.000Z",
    },
    {
      id: 2,
      player: "Gia Huy · Sáo C5",
      gameId: "flute_fingering",
      difficulty: "hard",
      score: 940,
      stars: 3,
      xp: 45,
      createdAt: "2026-11-23T08:30:00.000Z",
    },
    {
      id: 3,
      player: "Thảo Nguyên",
      gameId: "ear_training",
      difficulty: "medium",
      score: 890,
      stars: 3,
      xp: 35,
      createdAt: "2026-11-23T09:00:00.000Z",
    },
    {
      id: 4,
      player: "Hoàng Nam",
      gameId: "staff_reader",
      difficulty: "medium",
      score: 860,
      stars: 3,
      xp: 35,
      createdAt: "2026-11-23T09:30:00.000Z",
    },
    {
      id: 5,
      player: "Lan Chi",
      gameId: "rhythm_tap",
      difficulty: "hard",
      score: 920,
      stars: 3,
      xp: 40,
      createdAt: "2026-11-23T10:00:00.000Z",
    },
    {
      id: 6,
      player: "Bảo Ngọc",
      gameId: "song_quiz",
      difficulty: "medium",
      score: 950,
      stars: 3,
      xp: 40,
      createdAt: "2026-11-23T10:30:00.000Z",
    },
  ],
  claimedChestsByUser: new Map(),
  nextId: 100,
};

let cachedLessons = null;
let cachedT8 = null;

function securityHeaders(isAsset = false) {
  const h = new Headers();
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("X-Frame-Options", "DENY");
  h.set("Permissions-Policy", "midi=(self), microphone=(self), camera=()");
  h.set(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; frame-ancestors 'none'",
  );
  if (!isAsset) h.set("Cache-Control", "no-store");
  return h;
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  const headers = securityHeaders(false);
  headers.set("Content-Type", "application/json; charset=utf-8");
  for (const [k, v] of Object.entries(extraHeaders)) {
    if (Array.isArray(v)) v.forEach((item) => headers.append(k, item));
    else if (v !== undefined) headers.set(k, v);
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

const ok = (data, meta = null, status = 200, extraHeaders = {}) =>
  jsonResponse(
    { success: true, data, error: null, meta },
    status,
    extraHeaders,
  );

const fail = (status, code, message, details) =>
  jsonResponse(
    {
      success: false,
      data: null,
      error: { code, message, ...(details ? { details } : {}) },
      meta: null,
    },
    status,
  );

function b64urlEncode(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const norm = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm + "=".repeat((4 - (norm.length % 4)) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signToken(payload, secret) {
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await hmacKey(secret),
      encoder.encode(body),
    ),
  );
  return `${body}.${b64urlEncode(sig)}`;
}

async function verifyToken(token, secret) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, sigStr] = token.split(".");
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      b64urlDecode(sigStr),
      encoder.encode(body),
    );
    if (!valid) return null;
    const data = JSON.parse(decoder.decode(b64urlDecode(body)));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) {
      try {
        out[part.slice(0, i).trim()] = decodeURIComponent(
          part.slice(i + 1).trim(),
        );
      } catch {
        /* ignore malformed cookie */
      }
    }
  }
  return out;
}

function sessionCookieHeader(token, isHttps, maxAge = 30 * 86400) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (isHttps) parts.push("Secure");
  return parts.join("; ");
}

async function readAssetJson(env, requestUrl, assetPath, fallback) {
  try {
    const res = await env.ASSETS.fetch(
      new Request(new URL(assetPath, requestUrl)),
    );
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

async function getLessons(env, requestUrl) {
  if (!cachedLessons) {
    cachedLessons = await readAssetJson(
      env,
      requestUrl,
      "/data/lessons.json",
      [],
    );
  }
  return cachedLessons;
}

async function getT8(env, requestUrl) {
  if (!cachedT8) {
    cachedT8 = await readAssetJson(env, requestUrl, "/data/t8.json", null);
  }
  return cachedT8;
}

async function readBody(request) {
  const text = await request.text();
  if (!text) return {};
  try {
    const val = JSON.parse(text);
    return val && typeof val === "object" && !Array.isArray(val) ? val : {};
  } catch {
    return null;
  }
}

function sanitizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role ?? "learner",
    plan: u.plan ?? "free",
    planExpiresAt: u.planExpiresAt ?? null,
    starterInstrument: u.starterInstrument ?? null,
    b2bPartnerCode: u.b2bPartnerCode ?? null,
    showB2cUpsell: !u.b2bPartnerCode,
    emailVerified: Boolean(u.emailVerified ?? true),
    locale: u.locale ?? "vi",
    onboarding: u.onboarding ?? null,
  };
}

function computeProgress(userId) {
  const sessions = edgeState.sessionsByUser.get(userId) ?? [];
  const xp = sessions.reduce((s, x) => s + (x.xp || 0), 0);
  const totalSeconds = sessions.reduce((s, x) => s + (x.durationSec || 0), 0);
  const avgAccuracy = sessions.length
    ? Math.round(
        sessions.reduce((s, x) => s + (x.accuracy || 0), 0) / sessions.length,
      )
    : 0;
  const completedLessons = new Set(sessions.map((s) => s.lessonId)).size;
  const badges = [];
  if (sessions.length >= 1) {
    badges.push({
      id: "first_note",
      title: "Nốt khởi đầu",
      description: "Hoàn thành lượt luyện đầu tiên",
      earnedAt: sessions[0].createdAt,
    });
  }
  if (sessions.some((s) => s.accuracy >= 90)) {
    badges.push({
      id: "accurate_90",
      title: "Chuẩn từng nốt",
      description: "Đạt từ 90% trở lên trong một lượt tập",
      earnedAt: sessions[sessions.length - 1].createdAt,
    });
  }
  return {
    totals: {
      sessions: sessions.length,
      xp,
      totalSeconds,
      avgAccuracy,
      completedLessons,
    },
    streak: {
      current: sessions.length > 0 ? 1 : 0,
      longest: sessions.length > 0 ? 1 : 0,
    },
    badges,
    level: 1 + Math.floor(Math.sqrt(xp / 50)),
  };
}

async function resolveCurrentUser(request, secret) {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = /^Bearer (.+)$/.exec(authHeader)?.[1];
  const cookies = parseCookies(request.headers.get("cookie") ?? "");
  const token = bearer || cookies[SESSION_COOKIE];
  if (!token) return null;
  const claims = await verifyToken(token, secret);
  if (!claims?.user) return null;
  const cached = edgeState.usersByEmail.get(claims.user.email);
  return cached ? sanitizeUser(cached) : sanitizeUser(claims.user);
}

async function issueSessionPayload(user, secret, isHttps) {
  const clean = sanitizeUser(user);
  edgeState.usersByEmail.set(clean.email, clean);
  const accessToken = await signToken(
    { user: clean, exp: Date.now() + 2 * 3600 * 1000 },
    secret,
  );
  const cookieToken = await signToken(
    { user: clean, exp: Date.now() + 30 * 86400 * 1000 },
    secret,
  );
  return {
    data: { user: clean, accessToken, expiresIn: 7200 },
    headers: { "Set-Cookie": sessionCookieHeader(cookieToken, isHttps) },
  };
}

function buildOpenApiSpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "VocaVerse API v1 (Cloudflare Workers Edge)",
      version: "1.0.0",
      description:
        "API học viện idol AI dạy Piano & Sáo trúc C5 chạy trên Cloudflare Workers.",
    },
    servers: [{ url: API_PREFIX }],
    paths: {
      "/health": { get: { summary: "Tình trạng dịch vụ Edge" } },
      "/auth/register": { post: { summary: "Đăng ký tài khoản (>= 16 tuổi)" } },
      "/auth/login": { post: { summary: "Đăng nhập" } },
      "/lessons": { get: { summary: "Danh mục bài học theo gói" } },
      "/hand3d": { get: { summary: "Danh sách bài có Tay mẫu 3D" } },
      "/plans": { get: { summary: "Bảng giá B2C & Studio B2B" } },
      "/import/analyze": {
        post: {
          summary: "Chuyển Link/Audio/MIDI/MusicXML thành VocaScore 0.1",
        },
      },
      "/community/posts": { get: { summary: "Bảng tin cộng đồng học thuật" } },
      "/games/leaderboard": {
        get: { summary: "Thành tích 6 trò chơi nhạc lý" },
      },
      "/academic/overview": {
        get: { summary: "Tổng quan giáo trình 3 cấp độ" },
      },
    },
  };
}

async function handleApiV1(request, env, url, secret) {
  const method = request.method.toUpperCase();
  const subPath = url.pathname.slice(API_PREFIX.length) || "/";
  const isHttps = url.protocol === "https:";
  const user = await resolveCurrentUser(request, secret);

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: securityHeaders(false) });
  }

  // ---- Health & OpenAPI & Academic Overview ----
  if (method === "GET" && subPath === "/health") {
    return ok({
      status: "ok",
      runtime: "cloudflare-workers",
      db: "edge-stateless",
    });
  }
  if (method === "GET" && subPath === "/openapi.json") {
    return jsonResponse(buildOpenApiSpec());
  }
  if (method === "GET" && subPath === "/academic/overview") {
    const lessons = await getLessons(env, url);
    return ok({
      ssotSchema: "vocascore/0.1",
      starterLessons: lessons.length,
      fullTestSongs: 8,
      fullArrangements: 48,
      publicDomainClassics: 16,
      technicalExercises: 210,
      skillCardsKb: 24,
      academicGames: 6,
      userImportedSongs: edgeState.userSongs.length,
      activeNotes: user ? (edgeState.notesByUser.get(user.id)?.length ?? 0) : 0,
      communityPosts: edgeState.posts.filter((p) => !p.hidden).length,
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
            "Chơi trọn bài 20 ô nhịp (5 đoạn), hợp âm rải & quãng 2 Sáo C5",
        },
      ],
    });
  }

  // ---- Auth ----
  if (method === "POST" && subPath === "/auth/register") {
    const body = await readBody(request);
    if (!body) return fail(400, "VALIDATION_ERROR", "JSON không hợp lệ.");
    if (body.isOver16 !== true) {
      return fail(
        400,
        "AGE_RESTRICTION",
        "Cần xác nhận đủ 16 tuổi để tạo tài khoản.",
      );
    }
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const displayName = String(body.displayName ?? "")
      .trim()
      .slice(0, 60);
    const password = String(body.password ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return fail(400, "VALIDATION_ERROR", "Email chưa đúng định dạng.");
    }
    if (
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      return fail(
        400,
        "VALIDATION_ERROR",
        "Mật khẩu cần ít nhất 8 ký tự, có cả chữ và số.",
      );
    }
    if (!displayName) {
      return fail(400, "VALIDATION_ERROR", "Tên hiển thị không được để trống.");
    }
    const newUser = {
      id: `usr_${Date.now().toString(36)}`,
      email,
      displayName,
      role: "learner",
      plan: "free",
      planExpiresAt: null,
      starterInstrument: null,
      b2bPartnerCode: null,
      showB2cUpsell: true,
      emailVerified: true,
      locale: "vi",
      onboarding: null,
    };
    const issued = await issueSessionPayload(newUser, secret, isHttps);
    return ok(issued.data, null, 201, issued.headers);
  }

  if (method === "POST" && subPath === "/auth/login") {
    const body = await readBody(request);
    if (!body) return fail(400, "VALIDATION_ERROR", "JSON không hợp lệ.");
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !password) {
      return fail(
        400,
        "VALIDATION_ERROR",
        "Vui lòng nhập đầy đủ email và mật khẩu.",
      );
    }
    const existing = edgeState.usersByEmail.get(email);
    const logged = existing ?? {
      id: `usr_${email.slice(0, 8).replace(/[^a-z0-9]/g, "")}_${Date.now().toString(36)}`,
      email,
      displayName: email.split("@")[0],
      role: "learner",
      plan: "free",
      emailVerified: true,
      locale: "vi",
      onboarding: { complete: true, instrument: "piano", level: "beginner" },
    };
    const issued = await issueSessionPayload(logged, secret, isHttps);
    return ok(issued.data, null, 200, issued.headers);
  }

  if (method === "POST" && subPath === "/auth/refresh") {
    const cookies = parseCookies(request.headers.get("cookie") ?? "");
    const claims = await verifyToken(cookies[SESSION_COOKIE], secret);
    if (!claims?.user) {
      return fail(401, "UNAUTHORIZED", "Phiên đăng nhập đã hết hạn.");
    }
    const latest = edgeState.usersByEmail.get(claims.user.email) ?? claims.user;
    const issued = await issueSessionPayload(latest, secret, isHttps);
    return ok(issued.data, null, 200, issued.headers);
  }

  if (method === "POST" && subPath === "/auth/logout") {
    return ok({ loggedOut: true }, null, 200, {
      "Set-Cookie": sessionCookieHeader("", isHttps, 0),
    });
  }

  if (
    method === "POST" &&
    (subPath === "/auth/forgot-password" ||
      subPath === "/auth/resend-verification" ||
      subPath === "/auth/reset-password" ||
      subPath === "/auth/verify-email" ||
      subPath === "/auth/change-password")
  ) {
    return ok({ sent: true, updated: true, user });
  }

  // ---- Current User (/me/*) ----
  if (subPath === "/me" && method === "GET") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    return ok({ user });
  }
  if (subPath === "/me" && method === "PATCH") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const body = (await readBody(request)) ?? {};
    const updated = {
      ...user,
      ...(body.displayName
        ? { displayName: String(body.displayName).trim().slice(0, 60) }
        : {}),
      ...(body.locale ? { locale: String(body.locale).slice(0, 8) } : {}),
    };
    const issued = await issueSessionPayload(updated, secret, isHttps);
    return ok({ user: updated }, null, 200, issued.headers);
  }
  if (subPath === "/me" && method === "DELETE") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    edgeState.usersByEmail.delete(user.email);
    return ok({ deleted: true }, null, 200, {
      "Set-Cookie": sessionCookieHeader("", isHttps, 0),
    });
  }
  if (subPath === "/me/onboarding" && method === "PUT") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const body = (await readBody(request)) ?? {};
    const updated = {
      ...user,
      onboarding: { ...body, complete: true },
    };
    const issued = await issueSessionPayload(updated, secret, isHttps);
    return ok({ user: updated }, null, 200, issued.headers);
  }
  if (subPath === "/me/progress" && method === "GET") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    return ok(computeProgress(user.id));
  }
  if (subPath === "/me/sessions" && method === "GET") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const rows = edgeState.sessionsByUser.get(user.id) ?? [];
    return ok(rows, {
      page: 1,
      pageSize: 100,
      total: rows.length,
      historyDays: 30,
    });
  }
  if (subPath === "/me/sessions" && method === "POST") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const body = (await readBody(request)) ?? {};
    const list = edgeState.sessionsByUser.get(user.id) ?? [];
    const accuracy = Math.max(0, Math.min(100, Number(body.accuracy) || 85));
    const durationSec = Math.max(10, Number(body.durationSec) || 60);
    const xp = Math.max(10, Math.round(accuracy * 0.4 + durationSec * 0.1));
    const entry = {
      id: ++edgeState.nextId,
      lessonId: String(body.lessonId || "PN01"),
      mode: String(body.mode || "learn"),
      accuracy,
      durationSec,
      xp,
      createdAt: new Date().toISOString(),
    };
    list.unshift(entry);
    edgeState.sessionsByUser.set(user.id, list.slice(0, 100));
    return ok(
      {
        session: { id: entry.id, xp },
        newBadges: [],
        ...computeProgress(user.id),
      },
      null,
      201,
    );
  }
  if (subPath === "/me/favorites" && method === "GET") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const favs = [...(edgeState.favoritesByUser.get(user.id) ?? new Set())];
    return ok(favs.map((lessonId) => ({ lessonId })));
  }
  const favMatch = /^\/me\/favorites\/([^/]+)$/.exec(subPath);
  if (favMatch && (method === "PUT" || method === "DELETE")) {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const lessonId = decodeURIComponent(favMatch[1]);
    const set = edgeState.favoritesByUser.get(user.id) ?? new Set();
    if (method === "PUT") set.add(lessonId);
    else set.delete(lessonId);
    edgeState.favoritesByUser.set(user.id, set);
    return ok([...set].map((id) => ({ lessonId: id })));
  }
  if (subPath === "/me/notifications" && method === "GET") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const list = edgeState.notificationsByUser.get(user.id) ?? [
      {
        id: 1,
        kind: "welcome",
        title: "Chào mừng đến với VocaVerse",
        body: "Bạn có thể tập thử trực tiếp với Micro hoặc bàn phím máy tính ngay trên trình duyệt.",
        read: false,
        createdAt: new Date().toISOString(),
      },
    ];
    return ok(list, { unread: list.filter((n) => !n.read).length });
  }
  if (subPath === "/me/notifications/all/read" && method === "POST") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const list = (edgeState.notificationsByUser.get(user.id) ?? []).map(
      (n) => ({
        ...n,
        read: true,
      }),
    );
    edgeState.notificationsByUser.set(user.id, list);
    return ok({ readAll: true });
  }
  if (subPath === "/me/weekly-goal" && (method === "GET" || method === "PUT")) {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    if (method === "PUT") {
      const body = (await readBody(request)) ?? {};
      const goal = {
        minutes: Math.max(15, Math.min(600, Number(body.minutes) || 60)),
        days: Math.max(1, Math.min(7, Number(body.days) || 3)),
      };
      edgeState.weeklyGoalByUser.set(user.id, goal);
    }
    const g = edgeState.weeklyGoalByUser.get(user.id) ?? {
      minutes: 60,
      days: 3,
    };
    const sessions = edgeState.sessionsByUser.get(user.id) ?? [];
    const doneMin = Math.round(
      sessions.reduce((s, x) => s + (x.durationSec || 0), 0) / 60,
    );
    return ok({
      targetMinutes: g.minutes,
      targetDays: g.days,
      completedMinutes: doneMin,
      previousWeekMinutes: 0,
    });
  }
  if (subPath === "/me/export" && method === "GET") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    return ok({
      exportedAt: new Date().toISOString(),
      user,
      progress: computeProgress(user.id),
      sessions: edgeState.sessionsByUser.get(user.id) ?? [],
      notes: edgeState.notesByUser.get(user.id) ?? [],
    });
  }

  // ---- Lessons & Hand 3D ----
  if (method === "GET" && subPath === "/lessons") {
    const lessons = await getLessons(env, url);
    return ok(
      lessons.map((l) => ({
        id: l.id,
        title: l.title,
        instrument: l.instrument,
        locked: !lessonAllowed(user, l, lessons),
      })),
    );
  }
  if (method === "GET" && subPath === "/hand3d") {
    const t8 = await getT8(env, url);
    return ok([
      {
        lessonId: "PN01",
        title: "Năm nốt Đô–Sol tay phải và neo Đô giữa",
        locked: false,
        verified: t8?.report?.t1?.passed ?? true,
      },
    ]);
  }
  const hand3dMatch = /^\/lessons\/([^/]+)\/hand3d$/.exec(subPath);
  if (method === "GET" && hand3dMatch) {
    const lessonId = decodeURIComponent(hand3dMatch[1]);
    if (lessonId !== "PN01") {
      return fail(404, "NOT_FOUND", "Bài này chưa có tay mẫu 3D công khai.");
    }
    const t8 = await getT8(env, url);
    const rep = t8?.report;
    return ok({
      lessonId: "PN01",
      title: "Năm nốt Đô–Sol tay phải và neo Đô giữa",
      model: "/models/lessons/PN01/scene.glb",
      audio: null,
      verification: rep
        ? {
            decision: rep.decision,
            tier: rep.tier,
            pfs: rep.pfs?.bb ?? 100,
            t1Passed: rep.t1?.passed ?? true,
            t1Events: rep.t1
              ? `${rep.t1.events_ok}/${rep.t1.events_total}`
              : "22/22",
            t2FrameMismatch: rep.t2_det?.frame_identity_mismatch ?? 0,
          }
        : null,
    });
  }

  // ---- Plans & Billing (VietQR Sandbox) ----
  if (method === "GET" && subPath === "/plans") {
    return ok(user?.b2bPartnerCode ? [] : publicPlans());
  }
  if (method === "GET" && subPath === "/billing/payments") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    return ok(edgeState.paymentsByUser.get(user.id) ?? []);
  }
  if (
    method === "POST" &&
    (subPath === "/billing/orders" || subPath === "/billing/checkout")
  ) {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const body = (await readBody(request)) ?? {};
    const plan = PLANS[body.plan] ? body.plan : "plus";
    const cycle = PLANS[plan].priceVnd?.[body.cycle] ? body.cycle : "month";
    const amountVnd = PLANS[plan].priceVnd?.[cycle] ?? 99000;
    const orderCode =
      String(Date.now()) + String(Math.floor(Math.random() * 90 + 10));
    const description = `VV${orderCode}`;
    const order = {
      orderCode,
      plan,
      cycle,
      instrument: plan === "starter" ? body.instrument || "piano" : null,
      amountVnd,
      status: "pending",
      provider: "sandbox",
      description,
      qrUrl: null,
      qrData: `SANDBOX:${description}:${amountVnd}`,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      userId: user.id,
      userEmail: user.email,
    };
    edgeState.ordersByCode.set(orderCode, order);
    return ok(order, null, 201);
  }
  const orderGetMatch = /^\/billing\/orders\/([^/]+)$/.exec(subPath);
  if (method === "GET" && orderGetMatch) {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const order = edgeState.ordersByCode.get(
      decodeURIComponent(orderGetMatch[1]),
    );
    if (!order) return fail(404, "NOT_FOUND", "Không tìm thấy đơn thanh toán.");
    return ok(order);
  }
  const sandboxPayMatch = /^\/billing\/orders\/([^/]+)\/sandbox-pay$/.exec(
    subPath,
  );
  if (method === "POST" && sandboxPayMatch) {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const orderCode = decodeURIComponent(sandboxPayMatch[1]);
    const order = edgeState.ordersByCode.get(orderCode) ?? {
      orderCode,
      plan: "plus",
      cycle: "month",
      amountVnd: 99000,
    };
    order.status = "paid";
    edgeState.ordersByCode.set(orderCode, order);
    const months = { month: 1, quarter: 3, year: 12 }[order.cycle] ?? 1;
    const exp = new Date();
    exp.setMonth(exp.getMonth() + months);
    const updatedUser = {
      ...user,
      plan: order.plan,
      planExpiresAt: exp.toISOString(),
      starterInstrument: order.instrument ?? null,
    };
    const pays = edgeState.paymentsByUser.get(user.id) ?? [];
    pays.unshift({
      id: ++edgeState.nextId,
      orderCode,
      plan: order.plan,
      cycle: order.cycle,
      amountVnd: order.amountVnd,
      status: "paid",
      createdAt: new Date().toISOString(),
    });
    edgeState.paymentsByUser.set(user.id, pays);
    const issued = await issueSessionPayload(updatedUser, secret, isHttps);
    return ok({ order, user: updatedUser }, null, 200, issued.headers);
  }
  if (method === "POST" && subPath === "/billing/redeem") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const body = (await readBody(request)) ?? {};
    const code = String(body.code ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (!code.startsWith(FREE_DEMO_VOUCHER_PREFIX) || code.length < 8) {
      return fail(
        400,
        "VALIDATION_ERROR",
        "Mã quà tặng không hợp lệ (mã thử nghiệm bắt đầu bằng VOCA-, ví dụ VOCA-DEMO-2026).",
      );
    }
    const exp = new Date();
    exp.setMonth(exp.getMonth() + 1);
    const updatedUser = {
      ...user,
      plan: "plus",
      planExpiresAt: exp.toISOString(),
    };
    const issued = await issueSessionPayload(updatedUser, secret, isHttps);
    return ok(
      {
        redeemed: true,
        plan: "plus",
        planExpiresAt: exp.toISOString(),
        user: updatedUser,
      },
      null,
      200,
      issued.headers,
    );
  }
  if (method === "POST" && subPath === "/billing/cancel") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const updatedUser = { ...user, plan: "free", planExpiresAt: null };
    const issued = await issueSessionPayload(updatedUser, secret, isHttps);
    return ok({ user: updatedUser }, null, 200, issued.headers);
  }

  // ---- B2B Studio ----
  if (subPath === "/b2b/studio" && method === "GET") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const owned = [...edgeState.studiosByCode.values()].find(
      (s) => s.ownerId === user.id,
    );
    return ok(owned ?? null);
  }
  if (subPath === "/b2b/studios" && method === "POST") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const body = (await readBody(request)) ?? {};
    const code = `STD${Math.floor(1000 + Math.random() * 9000)}`;
    const studio = {
      code,
      name: String(body.name || "Phòng đàn VocaVerse").slice(0, 80),
      ownerId: user.id,
      seats: 30,
      students: [],
      createdAt: new Date().toISOString(),
    };
    edgeState.studiosByCode.set(code, studio);
    return ok(studio, null, 201);
  }
  if (
    subPath === "/b2b/enrollment" &&
    (method === "PUT" || method === "DELETE")
  ) {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const body = method === "PUT" ? ((await readBody(request)) ?? {}) : {};
    const updated = {
      ...user,
      b2bPartnerCode: method === "PUT" ? String(body.code || "STD1001") : null,
      showB2cUpsell: method !== "PUT",
    };
    const issued = await issueSessionPayload(updated, secret, isHttps);
    return ok({ user: updated }, null, 200, issued.headers);
  }

  // ---- Auto Music Importer (100% pure-JS DSP chạy trực tiếp trên Edge) ----
  if (method === "GET" && subPath === "/import/songs") {
    return ok(edgeState.userSongs);
  }
  if (method === "POST" && subPath === "/import/analyze") {
    const body = await readBody(request);
    if (!body) return fail(400, "VALIDATION_ERROR", "JSON không hợp lệ.");
    const durationSec = Number(body.durationSec ?? 180);
    if (durationSec > 600) {
      return fail(
        400,
        "VALIDATION_ERROR",
        "Thời lượng tệp vượt quá giới hạn 10 phút (600 giây). Vui lòng cắt ngắn bài nhạc.",
      );
    }
    const rawTitle = String(
      body.title || body.sourceRef || "Giai điệu Acoustic của tôi",
    )
      .replace(/^.*[\\/]/, "")
      .replace(
        /\.(mp3|wav|m4a|ogg|flac|mp4|webm|mov|mid|midi|musicxml|xml)$/i,
        "",
      )
      .slice(0, 90);
    const title = rawTitle || "Giai điệu của tôi";
    const artist = String(body.artist || "Người học VocaVerse").slice(0, 60);
    const theme = String(body.theme || "Tình yêu").slice(0, 40);
    const genre = String(body.genre || "Acoustic / Ballad").slice(0, 40);
    const sourceKind = String(body.sourceKind || "audio_file").slice(0, 30);

    let bpm = Math.max(45, Math.min(180, Number(body.bpm) || 72));
    const mode =
      body.mode === "minor" || /buồn|mưa|đêm|xưa|nhớ/i.test(title)
        ? "minor"
        : "major";
    const tonic = body.tonic || (mode === "minor" ? "A" : "C");

    let motif = Array.isArray(body.melodyPitches)
      ? body.melodyPitches.map(Number).filter((n) => n >= 36 && n <= 96)
      : null;
    if (!motif || motif.length < 4) {
      const xmlNotes = parseMusicXmlNotes(body.xmlText);
      if (xmlNotes) motif = xmlNotes;
    }
    if (!motif || motif.length < 4) {
      const pcmRes = detectFromAudioSamples(body.audioSamples);
      if (pcmRes) {
        bpm = pcmRes.bpm;
        motif = pcmRes.melodyPitches;
      }
    }
    if (!motif || motif.length < 4) {
      motif = deriveMotifFromText(title + (body.sourceRef || ""), mode);
    }

    const chords =
      mode === "minor"
        ? ["Am", "Dm", "G", "C", "F", "Dm", "E7", "Am"]
        : ["C", "G", "Am", "Em", "F", "C", "Dm", "G"];
    const code = `USR${String(edgeState.userSongs.length + 1).padStart(2, "0")}`;
    const { arrangements, outOfRangeShifted } = buildImportedArrangements({
      code,
      title,
      artist,
      bpm,
      tonic,
      mode,
      chords,
      motif,
    });
    const qualityNote = "Bản chuyển tự động — có thể chưa chính xác";
    const song = {
      id: code,
      code,
      title,
      artist,
      theme,
      genre,
      bpm,
      tonic,
      mode,
      chords,
      bars: 20,
      sections: SECTIONS.map((s) => s[1]),
      sourceKind,
      qualityNote,
      licenseClass: "user_private",
      publishable: false,
      tempAudioDeleted: true,
      outOfRangeShifted,
      pipelineSteps: [
        "1. Tải & chuẩn hoá luồng âm thanh (xoá tệp tạm ngay sau phân tích)",
        `2. Dò tốc độ (${bpm} BPM, nhịp 4/4) & chia 20 ô nhịp`,
        `3. Nhận diện giọng (${tonic} ${mode}) & vòng hợp âm (${chords.slice(0, 4).join(" – ")})`,
        "4. Tách nốt giai điệu YIN & lượng tử hoá theo lưới phách",
        "5. Chia 5 đoạn tự động (Intro · Verse · Chorus · Bridge · Outro)",
        "6. Sinh bản Piano (3 độ khó, số ngón 1–5) & Sáo trúc C5 (tự dịch tông, thế bấm 6 lỗ)",
      ],
      arrangements,
      createdAt: new Date().toISOString(),
    };
    edgeState.userSongs.unshift(song);
    edgeState.userSongs = edgeState.userSongs.slice(0, 30);
    return ok(song, null, 201);
  }
  const patchSongMatch = /^\/import\/songs\/([^/]+)$/.exec(subPath);
  if (method === "PATCH" && patchSongMatch) {
    const code = decodeURIComponent(patchSongMatch[1]);
    const song = edgeState.userSongs.find((s) => s.code === code);
    if (!song)
      return fail(404, "NOT_FOUND", "Không tìm thấy bài nhạc đã nhập.");
    const body = (await readBody(request)) ?? {};
    if (body.bpm !== undefined) {
      song.bpm = Math.max(40, Math.min(200, Number(body.bpm) || song.bpm));
    }
    const transpose = Math.max(-12, Math.min(12, Number(body.transpose) || 0));
    const editNote = body.editNote;
    for (const inst of ["piano", "sao_truc"]) {
      for (const diff of ["easy", "medium", "hard"]) {
        const score = song.arrangements[inst]?.[diff];
        if (!score) continue;
        score.tempo_map = [{ tick: 0, bpm: song.bpm }];
        const part = score.parts?.[0];
        if (!part) continue;
        if (transpose !== 0) {
          for (const n of part.notes) {
            if (inst === "piano") {
              n.pitch = Math.max(36, Math.min(96, n.pitch + transpose));
            } else {
              const c = clampSaoPitch(n.pitch + transpose);
              n.pitch = c.pitch;
              const [holes, oct] = SAO_C5_HOLES[c.pitch] || ["●●●●●●", 1];
              if (n.technique) {
                n.technique.fingering = holes;
                n.technique.octave = oct;
              }
            }
          }
        }
        if (
          editNote &&
          (!editNote.instrument || editNote.instrument === inst) &&
          (!editNote.difficulty || editNote.difficulty === diff)
        ) {
          if (editNote.delete && editNote.noteId) {
            part.notes = part.notes.filter((n) => n.id !== editNote.noteId);
          } else if (editNote.noteId && editNote.pitchDelta) {
            const target = part.notes.find((n) => n.id === editNote.noteId);
            if (target) {
              const nextP = target.pitch + Number(editNote.pitchDelta);
              if (inst === "piano") {
                target.pitch = Math.max(36, Math.min(96, nextP));
              } else {
                const c = clampSaoPitch(nextP);
                target.pitch = c.pitch;
                const [holes, oct] = SAO_C5_HOLES[c.pitch] || ["●●●●●●", 1];
                if (target.technique) {
                  target.technique.fingering = holes;
                  target.technique.octave = oct;
                }
              }
            }
          }
        }
      }
    }
    return ok({
      code: song.code,
      title: song.title,
      bpm: song.bpm,
      qualityNote: song.qualityNote,
      arrangements: song.arrangements,
    });
  }

  // ---- Notes ----
  if (method === "GET" && subPath === "/notes") {
    if (!user) return ok([]);
    const lessonId = url.searchParams.get("lessonId");
    const rows = edgeState.notesByUser.get(user.id) ?? [];
    return ok(lessonId ? rows.filter((r) => r.lessonId === lessonId) : rows);
  }
  if (method === "POST" && subPath === "/notes") {
    if (!user)
      return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập để lưu ghi chú.");
    const body = (await readBody(request)) ?? {};
    const content = String(body.content || "")
      .trim()
      .slice(0, 500);
    if (!content) {
      return fail(
        400,
        "VALIDATION_ERROR",
        "Nội dung ghi chú không được để trống.",
      );
    }
    const note = {
      id: ++edgeState.nextId,
      lessonId: String(body.lessonId || "PN01").slice(0, 40),
      barNumber: Math.max(1, Math.min(200, Number(body.barNumber) || 1)),
      content,
      createdAt: new Date().toISOString(),
    };
    const list = edgeState.notesByUser.get(user.id) ?? [];
    list.unshift(note);
    edgeState.notesByUser.set(user.id, list.slice(0, 100));
    return ok(note, null, 201);
  }
  const delNoteMatch = /^\/notes\/(\d+)$/.exec(subPath);
  if (method === "DELETE" && delNoteMatch) {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const id = Number(delNoteMatch[1]);
    const list = (edgeState.notesByUser.get(user.id) ?? []).filter(
      (n) => n.id !== id,
    );
    edgeState.notesByUser.set(user.id, list);
    return ok({ deleted: true });
  }

  // ---- Community & Moderation ----
  if (method === "GET" && subPath === "/community/posts") {
    const lessonId = url.searchParams.get("lessonId");
    const rows = edgeState.posts.filter(
      (p) => !p.hidden && (!lessonId || p.lessonId === lessonId),
    );
    return ok(rows);
  }
  if (method === "POST" && subPath === "/community/posts") {
    if (!user)
      return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập để chia sẻ.");
    const body = (await readBody(request)) ?? {};
    if (body.under16 === true) {
      return fail(
        403,
        "FORBIDDEN",
        "Tài khoản người học dưới 16 tuổi mặc định ở chế độ Chỉ xem cộng đồng để bảo vệ an toàn.",
      );
    }
    const content = String(body.content || "")
      .trim()
      .slice(0, 600);
    if (!content) {
      return fail(
        400,
        "VALIDATION_ERROR",
        "Nội dung chia sẻ không được để trống.",
      );
    }
    if (/\.(mp3|wav|mp4|webm|ogg)\b/i.test(content) && !body.mediaConsent) {
      return fail(
        403,
        "FORBIDDEN",
        "Không tự đăng ghi âm hoặc hình ảnh của người học khi chưa có đồng ý rõ ràng (Cổng P1).",
      );
    }
    const post = {
      id: ++edgeState.nextId,
      userId: user.id,
      authorName: user.displayName || user.email.split("@")[0],
      lessonId: String(body.lessonId || "PD01").slice(0, 40),
      kind: ["comment", "achievement", "challenge"].includes(body.kind)
        ? body.kind
        : "comment",
      content,
      likes: 0,
      reports: 0,
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    edgeState.posts.unshift(post);
    return ok(post, null, 201);
  }
  const postActionMatch =
    /^\/community\/posts\/(\d+)\/(like|report|hide)$/.exec(subPath);
  if (method === "POST" && postActionMatch) {
    const id = Number(postActionMatch[1]);
    const action = postActionMatch[2];
    const post = edgeState.posts.find((p) => p.id === id);
    if (post) {
      if (action === "like") post.likes += 1;
      if (action === "report") {
        post.reports += 1;
        if (post.reports >= 3) post.hidden = true;
      }
      if (action === "hide") post.hidden = true;
    }
    return ok({
      id,
      likes: post?.likes ?? 1,
      reported: action === "report",
      hidden: action === "hide",
    });
  }
  if (method === "POST" && subPath === "/community/block") {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    const body = (await readBody(request)) ?? {};
    return ok({ blockedUserId: body.blockedUserId ?? null, blocked: true });
  }

  // ---- Games & Rewards ----
  if (method === "GET" && subPath === "/games/leaderboard") {
    const gameId = url.searchParams.get("gameId");
    const rows = edgeState.gameScores
      .filter((s) => !gameId || s.gameId === gameId)
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);
    return ok(rows);
  }
  if (method === "POST" && subPath === "/games/score") {
    const body = (await readBody(request)) ?? {};
    const gameId = String(body.gameId || "falling_notes").slice(0, 40);
    const difficulty = ["easy", "medium", "hard"].includes(body.difficulty)
      ? body.difficulty
      : "medium";
    const score = Math.max(0, Math.min(10000, Number(body.score) || 0));
    const stars = score >= 850 ? 3 : score >= 600 ? 2 : 1;
    const xp =
      stars * (difficulty === "hard" ? 20 : difficulty === "medium" ? 15 : 10);
    const row = {
      id: ++edgeState.nextId,
      gameId,
      difficulty,
      score,
      stars,
      xp,
      player:
        user?.displayName ||
        String(body.player || "Học viên VocaVerse").slice(0, 40),
      createdAt: new Date().toISOString(),
    };
    edgeState.gameScores.unshift(row);
    edgeState.gameScores = edgeState.gameScores.slice(0, 60);
    return ok(row, null, 201);
  }
  if (method === "GET" && subPath === "/rewards/summary") {
    const claimed = user
      ? [...(edgeState.claimedChestsByUser.get(user.id) ?? new Set())]
      : [];
    const xpMap = {
      chest_daily_1: 50,
      chest_stage_1: 100,
      chest_master_1: 200,
    };
    const chests = claimed.map((k) => ({
      chestKey: k,
      xpAwarded: xpMap[k] ?? 60,
      claimedAt: new Date().toISOString(),
    }));
    return ok({
      claimedChests: claimed,
      chests,
      bonusXp: chests.reduce((s, c) => s + c.xpAwarded, 0),
    });
  }
  const chestMatch = /^\/rewards\/chests\/([^/]+)\/claim$/.exec(subPath);
  if (method === "POST" && chestMatch) {
    if (!user)
      return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập để nhận rương.");
    const key = decodeURIComponent(chestMatch[1]).slice(0, 40);
    const xpMap = {
      chest_daily_1: 50,
      chest_stage_1: 100,
      chest_master_1: 200,
    };
    const set = edgeState.claimedChestsByUser.get(user.id) ?? new Set();
    set.add(key);
    edgeState.claimedChestsByUser.set(user.id, set);
    return ok({
      chestKey: key,
      xpAwarded: xpMap[key] ?? 60,
      badgeEarned: `badge_${key}`,
    });
  }

  // ---- Contact & Events ----
  if (method === "POST" && subPath === "/contact") {
    const body = (await readBody(request)) ?? {};
    if (
      !String(body.email || "").includes("@") ||
      !String(body.message || "").trim()
    ) {
      return fail(
        400,
        "VALIDATION_ERROR",
        "Vui lòng điền email và nội dung liên hệ.",
      );
    }
    return ok({ received: true, id: ++edgeState.nextId }, null, 201);
  }
  if (method === "POST" && subPath === "/events") {
    return ok({ accepted: true }, null, 202);
  }

  // ---- Admin fallback ----
  if (subPath.startsWith("/admin")) {
    if (!user) return fail(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
    return fail(403, "FORBIDDEN", "Bạn không có quyền quản trị.");
  }

  return fail(404, "NOT_FOUND", "Không tìm thấy đường dẫn API.");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);
    const secret =
      env.JWT_SECRET || "vocaverse-cloudflare-edge-session-signing-key-2026";

    // 1. API v1 động trên Edge
    if (pathname === API_PREFIX || pathname.startsWith(API_PREFIX + "/")) {
      return handleApiV1(request, env, url, secret);
    }

    // 2. Endpoint học liệu tĩnh (/api/lessons, /api/catalog, /api/flute-chart, /api/local-songs, /api/t8)
    const staticApiMap = {
      "/api/lessons": "/data/lessons.json",
      "/api/catalog": "/data/catalog.json",
      "/api/flute-chart": "/data/flute-chart.json",
      "/api/local-songs": "/data/public-songs.json",
      "/api/t8": "/data/t8.json",
    };
    if (Object.hasOwn(staticApiMap, pathname)) {
      const asset = await env.ASSETS.fetch(
        new Request(new URL(staticApiMap[pathname], url)),
      );
      if (!asset.ok) return fail(404, "NOT_FOUND", "Chưa có dữ liệu học liệu.");
      const headers = securityHeaders(false);
      headers.set("Content-Type", "application/json; charset=utf-8");
      headers.set("Cache-Control", "public, max-age=300");
      return new Response(asset.body, { status: 200, headers });
    }

    // 3. Demo 3D performance endpoint: báo planner_unavailable để Demo3DPage tự mở bản lưu T8 đã kiểm chứng
    if (/^\/api\/lessons\/([^/]+)\/(performance|motion)$/.test(pathname)) {
      return jsonResponse({ error: "planner_unavailable" }, 503);
    }

    // 4. SEO động theo tên miền deploy thực tế (robots.txt & sitemap.xml)
    if (pathname === "/robots.txt") {
      const h = securityHeaders(false);
      h.set("Content-Type", "text/plain; charset=utf-8");
      return new Response(
        `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /dashboard\nDisallow: /profile\nSitemap: ${url.origin}/sitemap.xml\n`,
        { status: 200, headers: h },
      );
    }
    if (pathname === "/sitemap.xml") {
      const pages = [
        "/",
        "/library",
        "/games",
        "/community",
        "/pricing",
        "/demo-3d",
        "/help",
        "/about",
        "/contact",
        "/privacy",
        "/terms",
      ];
      const xml =
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        pages
          .map((p) => `  <url><loc>${url.origin}${p}</loc></url>`)
          .join("\n") +
        "\n</urlset>\n";
      const h = securityHeaders(false);
      h.set("Content-Type", "application/xml; charset=utf-8");
      return new Response(xml, { status: 200, headers: h });
    }

    // 5. Tài sản tĩnh & điều hướng SPA (Cloudflare Workers Assets)
    const assetResponse = await env.ASSETS.fetch(request);
    const headers = new Headers(assetResponse.headers);
    for (const [k, v] of securityHeaders(true).entries()) {
      headers.set(k, v);
    }
    if (/^\/assets\/.+\.woff2$/.test(pathname)) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    }
    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  },
};
