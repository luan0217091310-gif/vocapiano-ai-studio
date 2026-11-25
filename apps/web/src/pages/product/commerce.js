// Bảng giá v2 + kết nối trực tiếp API thương mại WT-1 (VietQR, Voucher, Phòng đàn B2B).
import { api, ApiRequestError, commerce } from "../../api/client.js";

export const vnd = (n) => `${Number(n).toLocaleString("vi-VN")} đ`;
export const vndShort = (n) =>
  n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);

/** Danh mục gói v2 (nguồn: kế hoạch kinh doanh; giá có thể đổi trước khi ra mắt). */
export const PLANS_V2 = [
  {
    id: "free",
    cycles: { forever: 0 },
    lessons: "free",
    features: ["f.free1", "f.free2", "f.free3", "f.local"],
  },
  {
    id: "starter",
    cycles: { pass30: 49000 },
    features: ["f.all", "f.exam", "f.hand3d", "f.noRenew"],
  },
  {
    id: "plus",
    featured: false,
    cycles: { month: 99000, quarter: 199000, year: 699000 },
    features: ["f.all", "f.exam", "f.hand3d", "f.history", "f.goals"],
  },
  {
    id: "founder",
    badge: true,
    cycles: { year: 499000 },
    features: ["f.plusAll", "f.founderPrice", "f.founderVote", "f.founderName"],
  },
];

export const B2B_PLAN = {
  id: "studio",
  perSeatMonth: 39000,
  features: ["b.dash", "b.minutes", "b.codes", "b.invoice"],
};

/** Plus quý/năm so với trả tháng. */
export const savingPct = (cycle) =>
  ({
    quarter: Math.round((1 - 199000 / (99000 * 3)) * 100),
    year: Math.round((1 - 699000 / (99000 * 12)) * 100),
  })[cycle] ?? 0;

const missing = (err) =>
  err instanceof ApiRequestError &&
  (err.status === 404 || err.status === 405 || err.status === 501);

const apiCycleOf = (plan, cycle) =>
  plan === "starter" || cycle === "pass30" ? "month" : cycle;

const normalizeOrder = (raw) => ({
  id: raw.id ?? raw.orderCode,
  orderCode: raw.orderCode ?? raw.id,
  plan: raw.plan,
  cycle: raw.cycle,
  amountVnd: raw.amountVnd,
  transferNote: raw.transferNote ?? `VV${raw.orderCode ?? raw.id}`,
  qrImageUrl: raw.qrImageUrl ?? raw.qrUrl ?? null,
  provider: raw.provider ?? "sandbox",
  bank: raw.bank ?? {
    name:
      raw.provider === "payos"
        ? "PayOS VietQR"
        : raw.provider === "sepay"
          ? "SePay VietQR"
          : "Sandbox VietQR",
    account: "0000 0000 00",
    holder: "VOCAVERSE",
  },
  expiresAt: raw.expiresAt ?? new Date(Date.now() + 15 * 60_000).toISOString(),
  status: raw.status ?? "pending",
  user: raw.user,
});

/** Tạo đơn VietQR qua WT-1 (`POST /billing/orders`). Trả `{ order, sandbox }`. */
export async function createOrder(plan, cycle) {
  const raw = await api.post("/billing/orders", {
    plan,
    cycle: apiCycleOf(plan, cycle),
    method: "vietqr",
  });
  const order = normalizeOrder(raw);
  return { order, sandbox: order.provider === "sandbox" };
}

export const getOrder = (id) =>
  commerce.order(id).then((raw) => normalizeOrder(raw));

/** Chế độ sandbox (dev): xác nhận thanh toán đơn VietQR mô phỏng trên DB thật. */
export async function sandboxConfirm(order) {
  return api.post(
    `/billing/orders/${encodeURIComponent(order.id)}/sandbox-pay`,
  );
}

export const normalizeCode = (s) =>
  String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/(.{4})(?=.)/g, "$1-");

export async function redeemCode(code) {
  const res = await commerce.redeem(code.replace(/-/g, ""));
  // Lấy lại hồ sơ người dùng sau khi kích hoạt để UI cập nhật gói ngay lập tức.
  const user = await api.get("/me").catch(() => null);
  return { ...res, user };
}

/** Danh sách lô voucher cho Admin (gom theo đối tác + gói + chu kỳ từ `GET /admin/vouchers`). */
export async function listVoucherBatches() {
  try {
    const vouchers = await commerce.vouchers({ pageSize: "200" });
    const byBatch = new Map();
    for (const v of vouchers) {
      const key = `${v.partner}|${v.plan}|${v.cycle}|${v.expiresAt.slice(0, 10)}`;
      const days =
        v.plan === "starter"
          ? 30
          : ({ month: 30, quarter: 90, year: 365 }[v.cycle] ?? 30);
      const cur = byBatch.get(key) ?? {
        id: v.partner,
        kind: "combo",
        plan: v.plan,
        days,
        quantity: 0,
        redeemed: 0,
        createdAt: v.expiresAt,
      };
      cur.quantity += 1;
      cur.redeemed += v.uses > 0 ? 1 : 0;
      byBatch.set(key, cur);
    }
    return { rows: [...byBatch.values()], ready: true };
  } catch (err) {
    if (missing(err)) return { rows: [], ready: false };
    throw err;
  }
}

export async function createVoucherBatch(body) {
  const plan = body.plan ?? "plus";
  const cycle =
    plan === "starter"
      ? "month"
      : plan === "founder"
        ? "year"
        : body.days >= 300
          ? "year"
          : body.days >= 80
            ? "quarter"
            : "month";
  const partner = [body.prefix || "VOCA", body.kind || "combo"]
    .join("-")
    .toUpperCase();
  const expiresAt = new Date(
    Date.now() + Math.max(30, Number(body.days || 90)) * 86400_000,
  ).toISOString();
  const { codes } = await commerce.issueVouchers({
    partner,
    plan,
    cycle,
    quantity: Number(body.quantity || 10),
    expiresAt,
  });
  return { id: partner, codes };
}

export async function getStudio() {
  try {
    return { data: await commerce.studioBoard(), ready: true };
  } catch (err) {
    if (missing(err)) return { data: null, ready: false };
    throw err;
  }
}

/** Tải CSV có BOM UTF-8 để Excel mở tiếng Việt đúng dấu. */
export function downloadCsv(filename, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
