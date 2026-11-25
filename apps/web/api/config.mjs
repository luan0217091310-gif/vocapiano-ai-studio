// Cấu hình đọc từ biến môi trường (xem .env.example). Không bao giờ in secret ra log.
import { randomBytes } from "node:crypto";
import { paymentConfig } from "./modules/billing/providers.mjs";
import { mailConfig } from "./core/mailer.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));

const list = (s) =>
  String(s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  if (production && (env.JWT_SECRET?.length ?? 0) < 32)
    throw new Error("Thiếu JWT_SECRET khi chạy production.");
  return {
    production,
    payment: paymentConfig(env),
    mail: mailConfig(env),
    root,
    dbPath: env.DATABASE_PATH || path.join(root, "data/runtime/vocaverse.db"),
    // Không có JWT_SECRET (máy dev): sinh ngẫu nhiên mỗi lần chạy → phiên cũ hết hạn khi khởi động lại.
    jwtSecret: env.JWT_SECRET || randomBytes(32).toString("hex"),
    accessTtl: Number(env.ACCESS_TOKEN_TTL ?? 900),
    refreshTtl: Number(env.REFRESH_TOKEN_TTL ?? 30 * 24 * 3600),
    // Cho phép dùng lại refresh token vừa bị xoay vòng trong N giây (chống đăng xuất nhầm khi chuyển trang nhanh).
    refreshReuseGraceS: Number(env.REFRESH_REUSE_GRACE_S ?? 60),
    appUrl: env.APP_URL ?? "http://localhost:4173",
    devMailbox:
      !production &&
      (env.MAIL_TRANSPORT || "outbox") === "outbox" &&
      env.DEV_MAILBOX === "1",
    // Tên miền được phép trong header Host (ngoài localhost), VD "vocaverse.vn,www.vocaverse.vn".
    allowedHosts: list(env.ALLOWED_HOSTS),
    // Nguồn khác APP_URL được gọi API kèm cookie (VD app di động/web phụ).
    corsOrigins: list(env.CORS_ORIGINS),
    // Số yêu cầu tối đa: auth (đăng nhập, đăng ký…) mỗi 15 phút; còn lại mỗi phút, theo IP.
    rateLimit: {
      auth: Number(env.RATE_LIMIT_AUTH ?? 30),
      default: Number(env.RATE_LIMIT_DEFAULT ?? 240),
      events: Number(env.RATE_LIMIT_EVENTS ?? 120),
    },
    secureCookies: production,
  };
}
