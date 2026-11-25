// Ứng dụng API v1: ghép module, xác thực, phân quyền, rate limit, CSRF/CORS, xử lý lỗi tập trung.
import {
  ApiError,
  errors,
  fail,
  ok,
  parseCookies,
  readJson,
} from "./core/http.mjs";
import { createLogger } from "./core/logger.mjs";
import { createRouter } from "./core/router.mjs";
import { createRateLimiter, verifyJwt } from "./core/security.mjs";
import { openDatabase } from "./db/index.mjs";
import {
  adminController,
  adminRepository,
  adminRoutes,
} from "./modules/admin/admin.mjs";
import { authController, authRoutes } from "./modules/auth/auth.controller.mjs";
import { authRepository } from "./modules/auth/auth.repository.mjs";
import { authService } from "./modules/auth/auth.service.mjs";
import { billingRoutes } from "./modules/billing/billing.mjs";
import { voucherRoutes } from "./modules/billing/vouchers.mjs";
import { studioRoutes, goalRoutes } from "./modules/b2b/studios.mjs";
import { importerRoutes } from "./modules/importer/importer.mjs";
import { communityRoutes } from "./modules/community/community.mjs";
import { startMailer, createMailQueue } from "./core/mailer.mjs";
import { hand3dRoutes, hand3dService } from "./modules/lessons/hand3d.mjs";
import {
  engagementController,
  engagementRepository,
  engagementRoutes,
} from "./modules/engagement/engagement.mjs";
import {
  progressController,
  progressRoutes,
} from "./modules/progress/progress.controller.mjs";
import { progressRepository } from "./modules/progress/progress.repository.mjs";
import { progressService } from "./modules/progress/progress.service.mjs";
import {
  usersController,
  usersRoutes,
} from "./modules/users/users.controller.mjs";
import { usersRepository } from "./modules/users/users.repository.mjs";
import { buildOpenApi } from "./openapi.mjs";

export const API_PREFIX = "/api/v1";

export function createApi({
  config,
  lessons,
  db = openDatabase(config.dbPath),
  logger = createLogger(),
  resolveHand3d = async () => null,
}) {
  const startedAt = Date.now();
  const users = usersRepository(db);
  const authRepo = authRepository(db);
  const engagement = engagementRepository(db);
  const notify = (...a) => engagement.notify(...a);
  const track = (...a) => engagement.track(...a);

  // Dọn token hết hạn lúc khởi động và mỗi ngày (timer không giữ tiến trình sống).
  const purge = () => {
    try {
      const n = authRepo.purgeExpired();
      if (n) logger.info("auth.purge", { removed: n });
    } catch (err) {
      logger.warn("auth.purge_failed", { err: String(err) });
    }
  };
  purge();
  const purgeTimer = setInterval(purge, 24 * 3600 * 1000);
  purgeTimer.unref?.();

  const router = createRouter();
  const enqueue = createMailQueue(db, config.mail.transport);
  const auth = authService({
    db,
    config,
    users,
    auth: authRepo,
    enqueue,
    notify,
    track,
  });
  authRoutes(router, authController({ authService: auth, config }), config);
  usersRoutes(router, usersController({ db, users, authRepo, track }));
  const progress = progressService({
    db,
    progress: progressRepository(db),
    lessons,
    notify,
    track,
  });
  progressRoutes(router, progressController({ progressService: progress }));
  billingRoutes(router, { db, config, notify, enqueue, users });
  voucherRoutes(router, db);
  studioRoutes(router, db);
  goalRoutes(router, db);
  importerRoutes(router, db);
  communityRoutes(router, db);
  const stopMailer = startMailer(db, config.mail, logger);
  engagementRoutes(router, engagementController({ repo: engagement }));
  hand3dRoutes(router, hand3dService({ lessons, resolveHand3d, track }));
  adminRoutes(
    router,
    adminController({
      repo: adminRepository(db),
      users,
      authRepo,
      notify,
      track,
    }),
  );
  router.add({
    method: "GET",
    path: "/health",
    doc: "Tình trạng dịch vụ",
    handler: () => {
      db.prepare("SELECT 1").get();
      return {
        data: {
          status: "ok",
          uptimeS: Math.round((Date.now() - startedAt) / 1000),
          db: "ok",
        },
      };
    },
  });
  const openapi = buildOpenApi(router.routes, API_PREFIX);
  router.add({
    method: "GET",
    path: "/openapi.json",
    doc: "Đặc tả OpenAPI",
    handler: () => ({ raw: openapi }),
  });

  const limiters = {
    default: createRateLimiter({
      windowMs: 60_000,
      max: config.rateLimit.default,
    }),
    auth: createRateLimiter({
      windowMs: 15 * 60_000,
      max: config.rateLimit.auth,
    }),
    redeem: createRateLimiter({ windowMs: 900000, max: 10 }),
    events: createRateLimiter({
      windowMs: 60_000,
      max: config.rateLimit.events,
    }),
  };

  const allowedOrigins = new Set([
    new URL(config.appUrl).origin,
    ...(config.corsOrigins ?? []),
  ]);

  const currentUser = (req) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? "");
    if (!m) return null;
    const claims = verifyJwt(m[1], config.jwtSecret);
    // Đọc lại từ DB để vai trò/gói/khoá tài khoản có hiệu lực ngay, không đợi token hết hạn.
    return claims ? users.findById(claims.sub) : null;
  };

  return {
    db,
    close: () => {
      stopMailer();
      clearInterval(purgeTimer);
      db.close();
    },
    async handle(req, res, url) {
      const t0 = performance.now();
      const ip = req.socket.remoteAddress ?? "?";
      const origin = req.headers.origin;
      const headers = {};
      if (origin && allowedOrigins.has(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Access-Control-Allow-Credentials"] = "true";
        headers.Vary = "Origin";
      }
      const setCookies = [];
      const reply = (fn) => {
        for (const [k, val] of Object.entries(headers)) res.setHeader(k, val);
        if (setCookies.length) res.setHeader("Set-Cookie", setCookies);
        fn();
      };
      let status = 500;
      try {
        if (req.method === "OPTIONS") {
          if (!headers["Access-Control-Allow-Origin"])
            throw errors.forbidden("Nguồn gọi API không được phép.");
          headers["Access-Control-Allow-Methods"] =
            "GET, POST, PUT, PATCH, DELETE";
          headers["Access-Control-Allow-Headers"] =
            "Content-Type, Authorization";
          status = 204;
          reply(() => {
            res.writeHead(204);
            res.end();
          });
          return;
        }
        // CSRF: thao tác ghi từ trình duyệt phải đến từ nguồn được phép (cookie refresh còn SameSite=Strict).
        // Cùng nguồn = Origin trùng Host của chính yêu cầu (VD mở bằng 127.0.0.1 hay localhost đều hợp lệ).
        const sameOrigin = (() => {
          try {
            return Boolean(origin) && new URL(origin).host === req.headers.host;
          } catch {
            return false; // Origin "null" hoặc hỏng
          }
        })();
        if (
          req.method !== "GET" &&
          req.method !== "HEAD" &&
          origin &&
          !sameOrigin &&
          !allowedOrigins.has(origin)
        )
          throw errors.forbidden("Nguồn gọi API không được phép.");
        const { route, params } = router.match(
          req.method === "HEAD" ? "GET" : req.method,
          url.pathname.slice(API_PREFIX.length) || "/",
        );
        const limiter = limiters[route.rate ?? "default"];
        if (!limiter(`${route.rate ?? "default"}:${ip}`))
          throw errors.tooMany();
        const user = currentUser(req);
        if ((route.auth === "user" || route.auth === "admin") && !user)
          throw errors.unauthorized();
        if (route.auth === "admin" && user.role !== "admin")
          throw errors.forbidden();
        let rawBody;
        const ctx = {
          req,
          params,
          query: url.searchParams,
          user,
          ip,
          cookies: parseCookies(req.headers.cookie),
          body: ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
            ? await readJson(
                req,
                route.rawBody
                  ? (bytes) => {
                      rawBody = bytes;
                    }
                  : undefined,
              )
            : {},
          rawBody,
          setCookie: (c) => setCookies.push(c),
        };
        const out = await route.handler(ctx);
        status = out.status ?? 200;
        reply(() => {
          res.setHeader("Cache-Control", "no-store");
          if (out.csv !== undefined) {
            res.writeHead(200, {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": 'attachment; filename="vouchers.csv"',
            });
            res.end(out.csv);
          } else if (out.raw) {
            res.writeHead(200, {
              "Content-Type": "application/json; charset=utf-8",
            });
            res.end(JSON.stringify(out.raw));
          } else ok(res, out.data, out.meta, status);
        });
      } catch (err) {
        const apiErr =
          err instanceof ApiError
            ? err
            : new ApiError(
                500,
                "INTERNAL_ERROR",
                "Hệ thống gặp sự cố, vui lòng thử lại sau.",
              );
        status = apiErr.status;
        // Không trả stack trace ra ngoài; chỉ ghi log phía máy chủ.
        if (status >= 500)
          logger.error("api.error", {
            path: url.pathname,
            err: err?.stack ?? String(err),
          });
        reply(() => fail(res, apiErr));
      } finally {
        logger.info("api", {
          method: req.method,
          path: url.pathname,
          status,
          ms: Math.round(performance.now() - t0),
        });
      }
    },
  };
}
