// Tiện ích HTTP dùng chung cho API v1: lỗi có mã, response chuẩn { success, data, error, meta }.

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  badRequest: (message, details) =>
    new ApiError(400, "VALIDATION_ERROR", message, details),
  unauthorized: (message = "Bạn cần đăng nhập.") =>
    new ApiError(401, "UNAUTHORIZED", message),
  forbidden: (message = "Bạn không có quyền thực hiện thao tác này.") =>
    new ApiError(403, "FORBIDDEN", message),
  notFound: (message = "Không tìm thấy.") =>
    new ApiError(404, "NOT_FOUND", message),
  conflict: (message) => new ApiError(409, "CONFLICT", message),
  planRequired: (message = "Tính năng này cần gói Pro trở lên.") =>
    new ApiError(402, "PLAN_REQUIRED", message),
  tooMany: () =>
    new ApiError(
      429,
      "RATE_LIMITED",
      "Bạn thao tác quá nhanh, thử lại sau ít phút.",
    ),
};

export function send(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

export const ok = (res, data, meta, status = 200) =>
  send(res, status, { success: true, data, error: null, meta: meta ?? null });

export function fail(res, err) {
  send(res, err.status, {
    success: false,
    data: null,
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
    meta: null,
  });
}

const MAX_BODY = 64 * 1024;

export async function readJson(req, capture) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY)
      throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Dữ liệu gửi lên quá lớn.");
    chunks.push(chunk);
  }
  if (!size) return {};
  if (!/^application\/json\b/.test(req.headers["content-type"] ?? ""))
    throw errors.badRequest("Dữ liệu phải là JSON.");
  try {
    const raw = Buffer.concat(chunks);
    capture?.(raw);
    const value = JSON.parse(raw.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw errors.badRequest("JSON không hợp lệ.");
  }
}

export function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0)
      out[part.slice(0, i).trim()] = decodeURIComponent(
        part.slice(i + 1).trim(),
      );
  }
  return out;
}

export function cookie(
  name,
  value,
  { maxAge, path = "/api/v1/auth", secure } = {},
) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    "HttpOnly",
    "SameSite=Strict",
    maxAge != null ? `Max-Age=${maxAge}` : "",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/** Phân trang chuẩn từ query: page ≥ 1, pageSize 1..100. */
export function pagination(query, defaults = { pageSize: 20 }) {
  const page = Math.max(1, Number.parseInt(query.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      Number.parseInt(query.get("pageSize") ?? "", 10) || defaults.pageSize,
    ),
  );
  return { page, pageSize, offset: (page - 1) * pageSize };
}
