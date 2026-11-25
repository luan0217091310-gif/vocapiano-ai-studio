import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ApiError, errors } from "../../core/http.mjs";

export function paymentConfig(env) {
  const provider = env.PAYMENT_PROVIDER || "sandbox";
  const required = {
    payos: ["PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY"],
    sepay: ["SEPAY_BANK", "SEPAY_ACCOUNT", "SEPAY_WEBHOOK_SECRET"],
    sandbox: [],
  };
  if (
    !Object.hasOwn(required, provider) ||
    required[provider].some((k) => !env[k])
  )
    throw new Error("Invalid PAYMENT_PROVIDER configuration");
  if (
    env.NODE_ENV === "production" &&
    (provider === "sandbox" || !env.APP_URL?.startsWith("https://"))
  )
    throw new Error("Production requires live payments and HTTPS APP_URL");
  return {
    provider,
    clientId: env.PAYOS_CLIENT_ID,
    apiKey: env.PAYOS_API_KEY,
    secret:
      provider === "payos"
        ? env.PAYOS_CHECKSUM_KEY
        : provider === "sepay"
          ? env.SEPAY_WEBHOOK_SECRET
          : env.SANDBOX_WEBHOOK_SECRET || randomBytes(32).toString("hex"),
    bank: env.SEPAY_BANK,
    account: env.SEPAY_ACCOUNT,
  };
}
const digest = (key, value) =>
  createHmac("sha256", key).update(value).digest("hex");
const canonical = (data) =>
  Object.keys(data)
    .sort()
    .map((k) => k + "=" + (data[k] ?? ""))
    .join("&");
function verify(secret, value, signature) {
  if (
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    !timingSafeEqual(
      Buffer.from(digest(secret, value), "hex"),
      Buffer.from(signature, "hex"),
    )
  )
    throw errors.unauthorized("Chữ ký giao dịch không hợp lệ.");
}
export async function createQr(
  config,
  appUrl,
  orderCode,
  amount,
  send = fetch,
) {
  const description = "VV" + orderCode;
  if (config.provider === "sandbox")
    return { qrUrl: null, qrData: "SANDBOX:" + description + ":" + amount };
  if (config.provider === "sepay")
    return {
      qrUrl:
        "https://vietqr.app/img?" +
        new URLSearchParams({
          acc: config.account,
          bank: config.bank,
          amount,
          des: description,
        }),
    };
  const redirect = new URL("/billing", appUrl).href;
  const payload = {
    amount,
    description,
    orderCode: Number(orderCode),
    returnUrl: redirect,
    cancelUrl: redirect,
  };
  const response = await send(
    "https://api-merchant.payos.vn/v2/payment-requests",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-client-id": config.clientId,
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify({
        ...payload,
        signature: digest(config.secret, canonical(payload)),
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  const result = await response.json();
  if (
    !response.ok ||
    result.code !== "00" ||
    !result.data?.qrCode ||
    !result.data.checkoutUrl?.startsWith("https://")
  )
    throw new ApiError(502, "GATEWAY_ERROR", "payOS chưa cấp mã QR.");
  verify(config.secret, canonical(result.data), result.signature);
  if (
    result.data.orderCode !== Number(orderCode) ||
    result.data.amount !== amount
  )
    throw errors.conflict("Thông tin đơn payOS không khớp.");
  return { qrUrl: result.data.checkoutUrl, qrData: result.data.qrCode };
}
export function parseTransfer(config, { body, rawBody, req }) {
  const headers = req.headers;
  if (config.provider === "payos") {
    const data = body.data;
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw errors.badRequest("Thiếu dữ liệu payOS.");
    verify(config.secret, canonical(data), body.signature);
    if (data.code !== "00" || body.success !== true || data.currency !== "VND")
      return null;
    return {
      orderCode: String(data.orderCode),
      amount: data.amount,
      txId: data.reference,
    };
  }
  if (config.provider === "sepay") {
    const t = headers["x-sepay-timestamp"];
    if (!/^\d{10}$/.test(t) || Math.abs(Date.now() / 1000 - Number(t)) > 300)
      throw errors.unauthorized();
    const signature = headers["x-sepay-signature"];
    if (!signature?.startsWith("sha256=")) throw errors.unauthorized();
    verify(
      config.secret,
      Buffer.concat([Buffer.from(t + "."), rawBody]),
      signature.slice(7),
    );
    if (
      body.transferType !== "in" ||
      String(body.accountNumber) !== config.account
    )
      return null;
    const orderCode = /\bVV(\d{1,16})\b/i.exec(body.code || body.content)?.[1];
    return orderCode
      ? {
          orderCode,
          amount: body.transferAmount,
          txId: body.id == null ? null : String(body.id),
        }
      : null;
  }
  verify(config.secret, rawBody ?? "", headers["x-sandbox-signature"]);
  return { orderCode: body.orderCode, amount: body.amount, txId: body.txId };
}
