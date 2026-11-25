import tls from "node:tls";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { tx } from "../db/index.mjs";

const address = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
export function mailConfig(env) {
  const transport = env.MAIL_TRANSPORT || "outbox";
  if (
    !["smtp", "outbox"].includes(transport) ||
    (env.NODE_ENV === "production" && transport !== "smtp")
  )
    throw new Error("Invalid MAIL_TRANSPORT");
  const smtp = {
    transport,
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 465),
    from: env.SMTP_FROM,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    holidays: (env.MAIL_HOLIDAYS || "").split(","),
  };
  if (
    transport === "smtp" &&
    (!smtp.host ||
      !smtp.from ||
      !address.test(smtp.from) ||
      Boolean(smtp.user) !== Boolean(smtp.password))
  )
    throw new Error("Invalid SMTP configuration");
  return smtp;
}
// SMTP submission over implicit TLS, with certificate verification and bounded response time.
export async function deliver(mail, row) {
  if (!address.test(row.to_email)) throw new Error("Invalid recipient");
  const socket = tls.connect({
    host: mail.host,
    port: mail.port,
    servername: mail.host,
    minVersion: "TLSv1.2",
  });
  socket.setTimeout(15000, () => socket.destroy(new Error("SMTP timeout")));
  const lines = createInterface({ input: socket, crlfDelay: Infinity });
  const replies = lines[Symbol.asyncIterator]();
  async function expect(code) {
    for (;;) {
      const { value, done } = await replies.next();
      if (done || !value.startsWith(String(code)))
        throw new Error("SMTP rejected command");
      if (value[3] === " ") return;
    }
  }
  async function command(text, code) {
    socket.write(text + "\r\n");
    await expect(code);
  }
  try {
    await once(socket, "secureConnect");
    await expect(220);
    await command("EHLO " + mail.from.split("@")[1], 250);
    if (mail.user)
      await command(
        "AUTH PLAIN " +
          Buffer.from("\0" + mail.user + "\0" + mail.password).toString(
            "base64",
          ),
        235,
      );
    await command("MAIL FROM:<" + mail.from + ">", 250);
    await command("RCPT TO:<" + row.to_email + ">", 250);
    await command("DATA", 354);
    const subject =
      "=?UTF-8?B?" + Buffer.from(row.subject).toString("base64") + "?=";
    const body =
      Buffer.from(row.body)
        .toString("base64")
        .match(/.{1,76}/g)
        ?.join("\r\n") || "";
    await command(
      [
        "From: " + mail.from,
        "To: " + row.to_email,
        "Subject: " + subject,
        "Date: " + new Date().toUTCString(),
        "Message-ID: <vv-" + row.id + "@" + mail.from.split("@")[1] + ">",
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        body,
        ".",
      ].join("\r\n"),
      250,
    );
    socket.end("QUIT\r\n");
  } finally {
    lines.close();
    socket.destroy();
  }
}

export function noticeDate(expiry, holidays = [], days = 7) {
  const local = new Date(Date.parse(expiry) + 7 * 3600000);
  while (days) {
    local.setUTCDate(local.getUTCDate() - 1);
    if (
      ![0, 6].includes(local.getUTCDay()) &&
      !holidays.includes(local.toISOString().slice(0, 10))
    )
      days--;
  }
  return local.toISOString().slice(0, 10);
}
export function createMailQueue(db, transport) {
  const insert = db.prepare(
    "INSERT INTO outbox(to_email,subject,body,mail_key,transport) VALUES(?,?,?,?,?) ON CONFLICT(mail_key) DO NOTHING",
  );
  return (email, subject, body, key = null) =>
    insert.run(email, subject, body, key, transport);
}
export function startMailer(db, mail, logger) {
  let busy = false,
    stopped = false;
  const enqueue = createMailQueue(db, mail.transport);
  async function tick() {
    if (busy || stopped) return;
    busy = true;
    try {
      const today = new Date(Date.now() + 7 * 3600000)
        .toISOString()
        .slice(0, 10);
      for (const user of db
        .prepare(
          "SELECT id,email,plan_expires_at AS expiry FROM users WHERE deleted_at IS NULL AND plan!='free' AND plan_expires_at>? AND plan_expires_at<datetime('now','+90 days')",
        )
        .all(new Date().toISOString())) {
        // Start ten working days ahead to leave delivery/retry margin.
        if (
          today >= noticeDate(user.expiry, mail.holidays, 10) &&
          today <= noticeDate(user.expiry, mail.holidays, 7)
        )
          enqueue(
            user.email,
            "Gói học sắp hết hạn",
            "Gói học hết hạn " +
              user.expiry +
              ". Bạn có thể chủ động gia hạn. VocaVerse không tự trừ tiền.",
            "renew:" + user.id + ":" + user.expiry,
          );
      }
      if (mail.transport !== "smtp") return;
      for (let n = 0; n < 20 && !stopped; n++) {
        const row = tx(db, () =>
          db
            .prepare(
              "UPDATE outbox SET retry_at=? WHERE id=(SELECT id FROM outbox WHERE transport='smtp' AND sent_at IS NULL AND (retry_at IS NULL OR retry_at<=?) ORDER BY id LIMIT 1) RETURNING *",
            )
            .get(
              new Date(Date.now() + 300000).toISOString(),
              new Date().toISOString(),
            ),
        );
        if (!row) break;
        try {
          await deliver(mail, row);
          if (!stopped)
            db.prepare("UPDATE outbox SET sent_at=?, body='' WHERE id=?").run(
              new Date().toISOString(),
              row.id,
            );
        } catch {
          logger.warn("mail.delivery_failed", { id: row.id });
        }
      }
    } catch (err) {
      logger.warn("mail.worker_failed", { message: err.message });
    } finally {
      busy = false;
    }
  }
  void tick();
  const timer = setInterval(tick, 30000);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
