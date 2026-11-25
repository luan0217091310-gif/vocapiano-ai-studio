import { syncPlan } from "./periods.mjs";
import { randomInt } from "node:crypto";
import { errors } from "../../core/http.mjs";
import { tx } from "../../db/index.mjs";
import { v, validate } from "../../core/validate.mjs";
import { PLANS, publicPlans } from "./plans.mjs";
import { createQr, parseTransfer } from "./providers.mjs";

export const offerFields = {
  plan: v.oneOf(["starter", "plus", "founder"]),
  cycle: v.oneOf(["month", "quarter", "year"]),
  instrument: v.optional(v.oneOf(["piano", "sao_truc"])),
};
export function offer(body) {
  const result = validate(offerFields, body);
  if (!PLANS[result.plan].priceVnd[result.cycle])
    throw errors.badRequest("Chu kỳ không áp dụng cho gói.");
  return {
    ...result,
    instrument: result.plan === "starter" ? result.instrument || "piano" : null,
  };
}
export function grant(db, id, { plan, cycle, instrument }) {
  syncPlan(db, id);
  const user = db
    .prepare(
      "SELECT plan,plan_expires_at,starter_instrument FROM users WHERE id=?",
    )
    .get(id);
  const now = Date.now();
  const previousEnd = Date.parse(user.plan_expires_at) || 0;
  const continuing =
    user.plan === plan && user.starter_instrument === instrument;
  const start = continuing ? Math.max(now, previousEnd) : now;
  const expiry = new Date(start);
  if (plan === "starter") expiry.setUTCDate(expiry.getUTCDate() + 30);
  else {
    const day = expiry.getUTCDate();
    expiry.setUTCDate(1);
    expiry.setUTCMonth(
      expiry.getUTCMonth() + { month: 1, quarter: 3, year: 12 }[cycle],
    );
    const end = new Date(expiry);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    expiry.setUTCDate(Math.min(day, end.getUTCDate()));
  }
  // Preserve prepaid time when switching plans. Read the schedule even if the app
  // was offline when one or more periods expired.
  const duration = expiry.getTime() - start;
  const queued = db
    .prepare(
      "SELECT * FROM plan_periods WHERE user_id=? AND ends_at>? ORDER BY starts_at",
    )
    .all(id, now);
  db.prepare("DELETE FROM plan_periods WHERE user_id=?").run(id);
  const insert = db.prepare(
    "INSERT INTO plan_periods(user_id,plan,instrument,starts_at,ends_at) VALUES(?,?,?,?,?)",
  );
  insert.run(id, plan, instrument, now, expiry.getTime());
  if (!continuing && previousEnd > now)
    insert.run(
      id,
      user.plan,
      user.starter_instrument,
      expiry.getTime(),
      previousEnd + duration,
    );
  for (const period of queued) {
    if (period.starts_at > now)
      insert.run(
        id,
        period.plan,
        period.instrument,
        period.starts_at + duration,
        period.ends_at + duration,
      );
  }
  db.prepare(
    "UPDATE users SET plan=?,plan_expires_at=?,starter_instrument=? WHERE id=?",
  ).run(plan, expiry.toISOString(), instrument, id);
  return expiry.toISOString();
}
export function checkPurchase(user) {
  if (user.b2bPartnerCode || user.plan === "studio")
    throw errors.forbidden("Tài khoản phòng đàn không mua gói cá nhân.");
}
// Mã QR hiển thị trong 15 phút; tiền về sau hạn vẫn được đối soát qua webhook (đơn vẫn pending trong DB).
export const ORDER_TTL_MS = 15 * 60_000;
export function billingRoutes(router, { db, config, notify, enqueue, users }) {
  const settings = config.payment;
  router.add({
    method: "GET",
    path: "/plans",
    auth: "optional",
    doc: "Bảng giá theo chu kỳ. Ẩn chào bán cho học viên phòng đàn.",
    handler: ({ user }) => ({
      data: user?.b2bPartnerCode ? [] : publicPlans(),
    }),
  });
  const checkout = {
    auth: "user",
    rate: "auth",
    doc: "Tạo đơn VietQR trả trước, giá do máy chủ xác định.",
    async handler({ user, body }) {
      const selected = offer(body);
      checkPurchase(user);
      const { plan, cycle, instrument } = selected;
      const amountVnd = PLANS[plan].priceVnd[cycle];
      const orderCode = String(randomInt(100000000000000, 200000000000000));
      db.prepare(
        "INSERT INTO payments(user_id,plan,cycle,amount_vnd,provider,status,order_code,instrument) VALUES(?,?,?,?,?,'pending',?,?)",
      ).run(
        user.id,
        plan,
        cycle,
        amountVnd,
        settings.provider,
        orderCode,
        instrument,
      );
      // Keep ambiguous network failures pending so that a subsequent bank credit can reconcile.
      const qr = await createQr(settings, config.appUrl, orderCode, amountVnd);
      db.prepare("UPDATE payments SET qr_url=? WHERE order_code=?").run(
        qr.qrUrl,
        orderCode,
      );
      return {
        status: 201,
        data: {
          orderCode,
          plan,
          cycle,
          amountVnd,
          status: "pending",
          provider: settings.provider,
          transferNote: "VV" + orderCode,
          expiresAt: new Date(Date.now() + ORDER_TTL_MS).toISOString(),
          ...qr,
        },
      };
    },
  };
  router.add({ method: "POST", path: "/billing/checkout", ...checkout });
  // Bí danh cho giao diện WT-2 (Hợp đồng A): cùng xử lý với /billing/checkout.
  router.add({
    method: "POST",
    path: "/billing/orders",
    ...checkout,
    doc: "Bí danh của /billing/checkout",
  });
  router.add({
    method: "GET",
    path: "/billing/orders/:orderCode",
    auth: "user",
    doc: "Trạng thái một đơn của chính người dùng (để giao diện tự kiểm sau khi quét QR).",
    handler: ({ user, params }) => {
      const p = db
        .prepare(
          "SELECT order_code AS orderCode,plan,cycle,amount_vnd AS amountVnd,status,qr_url AS qrUrl,created_at AS createdAt FROM payments WHERE order_code=? AND user_id=?",
        )
        .get(params.orderCode, user.id);
      if (!p) throw errors.notFound("Không tìm thấy đơn.");
      const expired =
        p.status === "pending" &&
        Date.now() - Date.parse(p.createdAt) > ORDER_TTL_MS;
      return {
        data: {
          ...p,
          status: expired ? "expired" : p.status,
          transferNote: "VV" + p.orderCode,
          expiresAt: new Date(
            Date.parse(p.createdAt) + ORDER_TTL_MS,
          ).toISOString(),
          user:
            p.status === "paid" && users ? users.findById(user.id) : undefined,
        },
      };
    },
  });
  router.add({
    method: "POST",
    path: "/billing/orders/:orderCode/sandbox-pay",
    auth: "user",
    doc: "Chỉ bật ở môi trường dev sandbox: mô phỏng đối soát chuyển khoản VietQR thành công.",
    handler({ user, params }) {
      if (config.production || settings.provider !== "sandbox")
        throw errors.notFound("Không khả dụng ở môi trường production.");
      return tx(db, () => {
        const p = db
          .prepare(
            "SELECT * FROM payments WHERE order_code=? AND user_id=? AND provider='sandbox'",
          )
          .get(params.orderCode, user.id);
        if (!p) throw errors.notFound("Không tìm thấy đơn sandbox.");
        if (p.status !== "paid") {
          const txId = "SBX-" + p.order_code;
          db.prepare(
            "UPDATE payments SET status='paid',provider_tx_id=? WHERE id=?",
          ).run(txId, p.id);
          const expiry = grant(db, p.user_id, p);
          const receipt =
            "Đơn " +
            p.order_code +
            " · " +
            p.amount_vnd +
            " VND · " +
            p.plan +
            " · Hạn sử dụng " +
            expiry;
          notify(p.user_id, "billing", "Đã kích hoạt gói học", receipt);
          enqueue(
            user.email,
            "Biên nhận VocaVerse",
            receipt,
            "receipt:" + p.order_code,
          );
        }
        return {
          data: {
            paid: true,
            orderCode: p.order_code,
            amountVnd: p.amount_vnd,
            user: users ? users.findById(user.id) : user,
          },
        };
      });
    },
  });
  router.add({
    method: "POST",
    path: "/billing/webhook/vietqr",
    rawBody: true,
    doc: "Xác minh HMAC theo nhà cung cấp và đối soát khoản ghi có.",
    handler(ctx) {
      const transfer = parseTransfer(settings, ctx);
      if (!transfer) return { data: { ignored: true } };
      const { orderCode, amount, txId } = transfer;
      if (
        typeof orderCode !== "string" ||
        typeof txId !== "string" ||
        !txId.trim() ||
        txId.length > 150 ||
        !Number.isSafeInteger(amount)
      )
        throw errors.badRequest("Dữ liệu giao dịch thiếu hoặc không hợp lệ.");
      return tx(db, () => {
        const p = db
          .prepare("SELECT * FROM payments WHERE order_code=? AND provider=?")
          .get(orderCode, settings.provider);
        if (!p) return { data: { ignored: true } };
        if (p.amount_vnd !== amount) throw errors.conflict("Sai số tiền.");
        if (p.status === "paid" && p.provider_tx_id === txId)
          return { data: { duplicate: true } };
        if (
          p.status !== "pending" ||
          db
            .prepare(
              "SELECT 1 FROM payments WHERE provider=? AND provider_tx_id=?",
            )
            .get(settings.provider, txId)
        )
          throw errors.conflict("Mã giao dịch đã xử lý.");
        db.prepare(
          "UPDATE payments SET status='paid',provider_tx_id=? WHERE id=?",
        ).run(txId, p.id);
        const expiry = grant(db, p.user_id, p);
        const receipt =
          "Đơn " +
          orderCode +
          " · " +
          amount +
          " VND · " +
          p.plan +
          " · Hạn sử dụng " +
          expiry;
        notify(p.user_id, "billing", "Đã kích hoạt gói học", receipt);
        const { email } = db
          .prepare("SELECT email FROM users WHERE id=?")
          .get(p.user_id);
        enqueue(email, "Biên nhận VocaVerse", receipt, "receipt:" + orderCode);
        return { data: { paid: true } };
      });
    },
  });
  router.add({
    method: "GET",
    path: "/billing/payments",
    auth: "user",
    doc: "Lịch sử đơn và trạng thái thanh toán",
    handler: ({ user }) => ({
      data: db
        .prepare(
          "SELECT id,plan,cycle,amount_vnd AS amountVnd,provider,status,created_at AS createdAt,order_code AS orderCode,qr_url AS qrUrl FROM payments WHERE user_id=? ORDER BY id DESC",
        )
        .all(user.id),
    }),
  });
  router.add({
    method: "POST",
    path: "/billing/cancel",
    auth: "user",
    doc: "Xác nhận gói trả trước không tự gia hạn",
    handler: ({ user }) => ({ data: { user, autoRenew: false } }),
  });
}
