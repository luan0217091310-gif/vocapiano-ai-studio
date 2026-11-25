// Băm mật khẩu (scrypt), ký/kiểm JWT HS256, sinh token ngẫu nhiên. Chỉ dùng node:crypto.
import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password, stored) {
  const [alg, salt, hash] = String(stored ?? "").split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(
    password,
    Buffer.from(salt, "base64url"),
    expected.length,
    SCRYPT,
  );
  return timingSafeEqual(key, expected);
}

export const randomToken = (bytes = 32) =>
  randomBytes(bytes).toString("base64url");
export const sha256 = (s) => createHash("sha256").update(s).digest("hex");

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

export function signJwt(payload, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ ...payload, iat: now, exp: now + ttlSeconds })}`;
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyJwt(token, secret) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest();
  const got = Buffer.from(s, "base64url");
  if (got.length !== expected.length || !timingSafeEqual(got, expected))
    return null;
  try {
    const header = JSON.parse(Buffer.from(h, "base64url"));
    if (header.alg !== "HS256") return null;
    const payload = JSON.parse(Buffer.from(p, "base64url"));
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000)
      return null;
    return payload;
  } catch {
    return null;
  }
}

/** Giới hạn tần suất theo cửa sổ trượt cố định, lưu trong bộ nhớ (đủ cho 1 tiến trình). */
export function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      if (hits.size > 10_000)
        for (const [k, e] of hits) if (e.reset <= now) hits.delete(k);
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
}
