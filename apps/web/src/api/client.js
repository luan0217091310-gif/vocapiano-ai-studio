// Tầng gọi API v1 cho front-end. Access token chỉ giữ trong bộ nhớ; refresh token là cookie HttpOnly
// (JavaScript không đọc được). Khi access token hết hạn, client tự gọi /auth/refresh một lần rồi thử lại.
import { readProductState, updateProductState } from "../productStore.js";

const BASE = "/api/v1";
let accessToken = null;
let refreshing = null;

export class ApiRequestError extends Error {
  constructor(status, error) {
    super(error?.message ?? "Không kết nối được máy chủ.");
    this.status = status;
    this.code = error?.code ?? "NETWORK_ERROR";
    this.details = error?.details ?? null;
  }
}

async function raw(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: "same-origin",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiRequestError(0, {
      code: "NETWORK_ERROR",
      message: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
    });
  }
  let json = null;
  try {
    json =
      res.ok && res.headers.get("content-type")?.startsWith("text/csv")
        ? { success: true, data: await res.text() }
        : await res.json();
  } catch {
    /* response không phải JSON */
  }
  return { status: res.status, json };
}

async function refresh() {
  refreshing ??= raw("POST", "/auth/refresh").finally(() => {
    refreshing = null;
  });
  const r = await refreshing;
  if (r.status === 200) {
    applySession(r.json.data);
    return true;
  }
  accessToken = null;
  return false;
}

export async function request(method, path, body) {
  let r = await raw(method, path, body);
  if (
    r.status === 401 &&
    path !== "/auth/refresh" &&
    path !== "/auth/login" &&
    (await refresh())
  )
    r = await raw(method, path, body);
  if (!r.json?.success) throw new ApiRequestError(r.status, r.json?.error);
  return { data: r.json.data, meta: r.json.meta };
}

export const api = {
  get: (p) => request("GET", p).then((r) => r.data),
  post: (p, b = {}) => request("POST", p, b).then((r) => r.data),
  put: (p, b = {}) => request("PUT", p, b).then((r) => r.data),
  patch: (p, b = {}) => request("PATCH", p, b).then((r) => r.data),
  del: (p, b = {}) => request("DELETE", p, b).then((r) => r.data),
  /** Trả cả meta (phân trang). */
  page: (p) => request("GET", p),
};

// ---- phiên đăng nhập, đồng bộ sang productStore để các trang đọc đồng bộ như trước
const listeners = new Set();
export const onSessionChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function applyUser(user) {
  const prev = readProductState();
  updateProductState({
    account: user
      ? {
          id: user.id,
          email: user.email,
          name: user.displayName,
          role: user.role,
          plan: user.plan,
          planExpiresAt: user.planExpiresAt,
          b2bPartnerCode: user.b2bPartnerCode,
          showB2cUpsell: user.showB2cUpsell,
          emailVerified: user.emailVerified,
          locale: user.locale,
          mode: "server",
        }
      : null,
    onboarding: user ? (user.onboarding ?? null) : prev.onboarding,
  });
  for (const fn of listeners) fn(user);
}

function applySession({ user, accessToken: token }) {
  accessToken = token;
  applyUser(user);
}

/** Gọi lúc khởi động: khôi phục phiên từ cookie refresh (chỉ khi trên máy có dấu hiệu đang đăng nhập). */
export async function bootSession() {
  if (!readProductState().account) return false;
  let ok;
  try {
    ok = await refresh();
  } catch {
    // Mất mạng (PWA ngoại tuyến): giữ bản sao cục bộ để Studio vẫn mở được.
    return false;
  }
  if (!ok && readProductState().account) applyUser(null);
  if (ok) await syncFavorites().catch(() => {});
  return ok;
}

export async function login(email, password) {
  applySession(await api.post("/auth/login", { email, password }));
  await syncFavorites().catch(() => {});
}

export async function register(email, password, displayName, isOver16) {
  applySession(
    await api.post("/auth/register", {
      email,
      password,
      displayName,
      isOver16,
    }),
  );
}

export async function logout() {
  await api.post("/auth/logout").catch(() => {});
  accessToken = null;
  updateProductState({ favorites: [] });
  applyUser(null);
}

export async function saveOnboarding(values) {
  const { user } = await api.put("/me/onboarding", values);
  applyUser(user);
}

async function syncFavorites() {
  const rows = await api.get("/me/favorites");
  updateProductState({ favorites: rows.map((r) => r.lessonId) });
}

export async function setFavorite(lessonId, on) {
  const rows = on
    ? await api.put(`/me/favorites/${encodeURIComponent(lessonId)}`)
    : await api.del(`/me/favorites/${encodeURIComponent(lessonId)}`);
  updateProductState({ favorites: rows.map((r) => r.lessonId) });
}

export const isLoggedIn = () => Boolean(accessToken);

/** Ghi sự kiện analytics (không chặn giao diện, bỏ qua lỗi). */
export function track(name, props = {}) {
  raw("POST", "/events", { name, ...props }).catch(() => {});
}

export const commerce = {
  plans: () => api.get("/plans"),
  checkout: (body) => api.post("/billing/checkout", body),
  order: (orderCode) =>
    api.get("/billing/orders/" + encodeURIComponent(orderCode)),
  payments: () => api.get("/billing/payments"),
  redeem: (code) => api.post("/billing/redeem", { code }),
  issueVouchers: (body) => api.post("/admin/vouchers", body),
  vouchers: (filters = {}) =>
    api.get("/admin/vouchers?" + new URLSearchParams(filters)),
  createStudio: (name) => api.post("/b2b/studios", { name }),
  enrollment: (code, sharePractice) =>
    api.put("/b2b/enrollment", { code, sharePractice }),
  leaveStudio: () => api.del("/b2b/enrollment"),
  studioBoard: () => api.get("/b2b/studio"),
  studioPractice: (code) =>
    api.get("/b2b/studios/" + encodeURIComponent(code) + "/practice"),
  weeklyGoal: () => api.get("/me/weekly-goal"),
  setWeeklyGoal: (minutes, days) =>
    api.put("/me/weekly-goal", { minutes, days }),
};
