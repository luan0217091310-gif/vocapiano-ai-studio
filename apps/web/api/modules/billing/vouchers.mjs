import { randomBytes, createHash } from "node:crypto";
import { tx } from "../../db/index.mjs";
import { errors, pagination } from "../../core/http.mjs";
import { v, validate } from "../../core/validate.mjs";
import { offer, grant, checkPurchase } from "./billing.mjs";

const hash = (s) => createHash("sha256").update(s).digest("hex");
const csvCell = (value) =>
  '"' +
  String(value ?? "")
    .replace(/^([\s]*[=+@-]|[\r\n\t])/, "'$1")
    .replaceAll('"', '""') +
  '"';
export function voucherRoutes(router, db) {
  router.add({
    method: "POST",
    path: "/admin/vouchers",
    auth: "admin",
    doc: "Sinh lô mã in cho đối tác. Mã đầy đủ chỉ trả khi tạo.",
    handler: ({ body }) => {
      const { plan, cycle, instrument } = offer(body);
      const { partner, quantity, maxUses, expiresAt } = validate(
        {
          partner: v.string({ min: 1, max: 100 }),
          quantity: v.int({ min: 1, max: 1000 }),
          maxUses: v.int({ min: 1, max: 1000 }),
          expiresAt: v.string({ max: 35 }),
        },
        { maxUses: 1, ...body },
      );
      if (
        !Number.isFinite(Date.parse(expiresAt)) ||
        Date.parse(expiresAt) <= Date.now()
      )
        throw errors.badRequest("Hạn mã phải ở tương lai.");
      const insert = db.prepare(
        "INSERT INTO voucher_codes(digest,suffix,partner,plan,cycle,instrument,max_uses,expires_at) VALUES(?,?,?,?,?,?,?,?)",
      );
      const codes = tx(db, () =>
        Array.from({ length: quantity }, () => {
          const code = randomBytes(12).toString("hex").toUpperCase();
          insert.run(
            hash(code),
            code.slice(-6),
            partner,
            plan,
            cycle,
            instrument,
            maxUses,
            new Date(expiresAt).toISOString(),
          );
          return code;
        }),
      );
      return { data: { codes }, status: 201 };
    },
  });
  router.add({
    method: "GET",
    path: "/admin/vouchers",
    auth: "admin",
    doc: "Lọc partner, plan. Phân trang page/pageSize. format=csv xuất trang hiện tại.",
    handler: ({ query }) => {
      const { pageSize, offset } = pagination(query);
      const partner = query.get("partner"),
        plan = query.get("plan");
      const rows = db
        .prepare(
          "SELECT id,suffix,partner,plan,cycle,uses,max_uses AS maxUses,expires_at AS expiresAt FROM voucher_codes WHERE (? IS NULL OR partner=?) AND (? IS NULL OR plan=?) ORDER BY id LIMIT ? OFFSET ?",
        )
        .all(partner, partner, plan, plan, pageSize, offset);
      if (query.get("format") === "csv") {
        const keys = [
          "id",
          "suffix",
          "partner",
          "plan",
          "cycle",
          "uses",
          "maxUses",
          "expiresAt",
        ];
        return {
          csv: [
            keys.join(","),
            ...rows.map((row) => keys.map((k) => csvCell(row[k])).join(",")),
          ].join("\r\n"),
        };
      }
      return { data: rows };
    },
  });
  router.add({
    method: "POST",
    path: "/billing/redeem",
    auth: "user",
    rate: "redeem",
    doc: "Nhập mã combo để kích hoạt gói",
    handler: ({ user, body }) =>
      tx(db, () => {
        const { code } = validate(
          { code: v.string({ min: 1, max: 64 }) },
          body,
        );
        const voucher = db
          .prepare("SELECT * FROM voucher_codes WHERE digest=?")
          .get(hash(code.trim().toUpperCase()));
        if (
          !voucher ||
          voucher.expires_at <= new Date().toISOString() ||
          voucher.uses >= voucher.max_uses ||
          db
            .prepare(
              "SELECT 1 FROM voucher_redemptions WHERE voucher_id=? AND user_id=?",
            )
            .get(voucher.id, user.id)
        )
          throw errors.badRequest("Mã không còn khả dụng.");
        checkPurchase(user);
        db.prepare("INSERT INTO voucher_redemptions VALUES(?,?)").run(
          voucher.id,
          user.id,
        );
        db.prepare("UPDATE voucher_codes SET uses=uses+1 WHERE id=?").run(
          voucher.id,
        );
        return {
          data: {
            plan: voucher.plan,
            planExpiresAt: grant(db, user.id, voucher),
          },
        };
      }),
  });
}
