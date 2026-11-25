// CLI quản trị DB: node apps/web/api/cli.mjs migrate | seed
import { loadConfig } from "./config.mjs";
import { openDatabase } from "./db/index.mjs";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, seed } from "./db/seed.mjs";

const cmd = process.argv[2];
const config = loadConfig();
const db = openDatabase(config.dbPath); // mở DB = chạy migration
if (cmd === "migrate") {
  process.stdout.write(`Đã migrate: ${config.dbPath}\n`);
} else if (cmd === "seed") {
  if (config.production)
    throw new Error("Tài khoản demo chỉ dành cho phát triển.");
  const created = await seed(db);
  process.stdout.write(
    `Seed dữ liệu mẫu: ${created.length ? created.join(", ") : "đã có sẵn, bỏ qua"}\n` +
      `Tài khoản demo (mật khẩu chung ${DEMO_PASSWORD}):\n` +
      DEMO_ACCOUNTS.map(
        (a) => `  - ${a.email} · ${a.role} · gói ${a.plan}`,
      ).join("\n") +
      "\n",
  );
} else {
  process.stderr.write("Dùng: node apps/web/api/cli.mjs migrate|seed\n");
  process.exitCode = 2;
}
db.close();
