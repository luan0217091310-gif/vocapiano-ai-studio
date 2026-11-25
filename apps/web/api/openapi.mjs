// Sinh đặc tả OpenAPI 3.1 từ bảng route (mỗi route có `doc`), để tài liệu luôn khớp mã.
const SECURITY = {
  user: [{ bearer: [] }],
  admin: [{ bearer: [] }],
  optional: [{}, { bearer: [] }],
};

const str = { type: "string" },
  integer = { type: "integer" },
  bool = { type: "boolean" };
const offer = {
  plan: { enum: ["starter", "plus", "founder"] },
  cycle: { enum: ["month", "quarter", "year"] },
  instrument: { enum: ["piano", "sao_truc"] },
};
const goal = {
  minutes: { type: "integer", minimum: 1, maximum: 10080 },
  days: { type: "integer", minimum: 1, maximum: 7 },
};
const object = (properties, required = Object.keys(properties)) => ({
  type: "object",
  properties,
  required,
});
const bodies = {
  "/auth/register": object({
    email: { type: "string", format: "email" },
    password: str,
    displayName: str,
    isOver16: { const: true },
  }),
  "/billing/checkout": object(offer, ["plan", "cycle"]),
  "/billing/redeem": object({ code: str }),
  "/admin/vouchers": object(
    {
      ...offer,
      partner: str,
      quantity: { type: "integer", minimum: 1, maximum: 1000 },
      maxUses: { type: "integer", minimum: 1, maximum: 1000, default: 1 },
      expiresAt: { type: "string", format: "date-time" },
    },
    ["partner", "plan", "cycle", "quantity", "expiresAt"],
  ),
  "/me/weekly-goal": object(goal),
  "/b2b/studios": object({ name: str }),
  "/b2b/enrollment": object({ code: str, sharePractice: bool }),
  "/billing/webhook/vietqr": {
    oneOf: [
      object({ orderCode: str, amount: integer, txId: str }),
      object({
        code: str,
        success: bool,
        data: { type: "object" },
        signature: str,
      }),
      object({
        id: integer,
        accountNumber: str,
        transferType: str,
        transferAmount: integer,
        content: str,
      }),
    ],
  },
};
const replySchemas = {
  "POST /billing/checkout": object(
    {
      orderCode: str,
      status: { const: "pending" },
      amountVnd: integer,
      provider: str,
      qrUrl: { type: ["string", "null"] },
      qrData: str,
    },
    ["orderCode", "status", "amountVnd", "provider", "qrUrl"],
  ),
  "POST /billing/redeem": object({ plan: str, planExpiresAt: str }),
  "POST /admin/vouchers": object({ codes: { type: "array", items: str } }),
  "GET /admin/vouchers": {
    type: "array",
    items: object({
      id: integer,
      suffix: str,
      partner: str,
      plan: str,
      cycle: str,
      uses: integer,
      maxUses: integer,
      expiresAt: str,
    }),
  },
  "GET /me/weekly-goal": object(goal),
  "PUT /me/weekly-goal": object(goal),
  "POST /b2b/studios": object({ code: str, name: str }),
  "PUT /b2b/enrollment": object({
    code: str,
    name: str,
    sharePractice: bool,
    showB2cUpsell: { const: false },
  }),
  "DELETE /b2b/enrollment": object({ left: bool }),
  "GET /b2b/studios/:code/practice": {
    type: "array",
    items: object({ lessonId: str, durationS: integer }),
  },
  "POST /billing/webhook/vietqr": {
    oneOf: ["paid", "duplicate", "ignored"].map((key) =>
      object({ [key]: { const: true } }),
    ),
  },
};
export function buildOpenApi(routes, prefix) {
  const paths = {};
  for (const r of routes) {
    const p = prefix + r.path.replace(/:([a-zA-Z]+)/g, "{$1}");
    const params = r.keys.map((k) => ({
      name: k,
      in: "path",
      required: true,
      schema: { type: "string" },
    }));
    paths[p] ??= {};
    paths[p][r.method.toLowerCase()] = {
      summary: r.doc ?? "",
      tags: [r.path.split("/")[1]],
      ...(params.length ? { parameters: params } : {}),
      ...(SECURITY[r.auth] ? { security: SECURITY[r.auth] } : {}),
      ...(["POST", "PUT", "PATCH", "DELETE"].includes(r.method)
        ? {
            requestBody: {
              required: false,
              content: { "application/json": { schema: { type: "object" } } },
            },
          }
        : {}),
      responses: {
        200: {
          description: "Thành công",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Envelope" },
            },
          },
        },
        400: { description: "Dữ liệu không hợp lệ (VALIDATION_ERROR)" },
        ...(r.auth === "user" || r.auth === "admin"
          ? { 401: { description: "Chưa đăng nhập" } }
          : {}),
        ...(r.auth === "admin"
          ? { 403: { description: "Không đủ quyền" } }
          : {}),
        429: { description: "Vượt giới hạn tần suất" },
      },
      "x-role": r.auth,
    };
    const op = paths[p][r.method.toLowerCase()];
    if (["POST", "PUT"].includes(r.method) && bodies[r.path])
      op.requestBody = {
        required: true,
        content: { "application/json": { schema: bodies[r.path] } },
      };
    const result = replySchemas[r.method + " " + r.path];
    if (result)
      op.responses[200].content["application/json"].schema = {
        allOf: [
          { $ref: "#/components/schemas/Envelope" },
          object({ data: result }),
        ],
      };
    if (
      r.method === "POST" &&
      [
        "/billing/checkout",
        "/admin/vouchers",
        "/b2b/studios",
        "/auth/register",
      ].includes(r.path)
    ) {
      op.responses[201] = op.responses[200];
      delete op.responses[200];
    }
    if (r.path === "/auth/register")
      op.responses[400].description = "AGE_RESTRICTION hoặc VALIDATION_ERROR";
    if (r.path === "/admin/vouchers" && r.method === "GET") {
      op.parameters = ["partner", "plan", "format", "page", "pageSize"].map(
        (name) => ({
          in: "query",
          name,
          schema: name === "format" ? { enum: ["csv"] } : str,
        }),
      );
      op.responses[200].content["text/csv"] = { schema: str };
    }
    if (r.path === "/billing/webhook/vietqr") {
      op.description =
        "payOS ký data bằng checksum key. SePay ký timestamp.rawBody và sandbox ký rawBody. Chỉ dùng secret phía máy chủ.";
      op.parameters = [
        "X-SePay-Signature",
        "X-SePay-Timestamp",
        "X-Sandbox-Signature",
      ].map((name) => ({ in: "header", name, schema: str }));
      op.responses[401] = { description: "Chữ ký sai hoặc timestamp hết hạn" };
      op.responses[409] = {
        description: "Sai số tiền hoặc giao dịch trùng không khớp",
      };
    }
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "VocaVerse API",
      version: "1.0.0",
      description:
        "API v1 của VocaVerse. Mọi response có dạng { success, data, error, meta }. Đăng nhập trả accessToken (Bearer, 15 phút) và đặt cookie HttpOnly `vv_refresh` để lấy token mới qua POST /auth/refresh.",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Envelope: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {},
            error: {
              type: ["object", "null"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: { type: "object" },
              },
            },
            meta: { type: ["object", "null"] },
          },
        },
      },
    },
    paths,
  };
}
