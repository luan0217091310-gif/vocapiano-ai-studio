import { useState } from "react";
import { Mail, School, Send } from "lucide-react";
import { api } from "../../api/client.js";
import { readProductState } from "../../productStore.js";
import { toast } from "../../ui/index.jsx";
import { PageShell } from "../Shared.jsx";

const TOPICS = [
  ["support", "Hỗ trợ sử dụng"],
  ["school", "Trường học, phòng đàn (gói Studio)"],
  ["partnership", "Hợp tác nội dung"],
  ["other", "Khác"],
];

export function ContactPage() {
  const account = readProductState().account;
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    const next = {};
    if (!body.name.trim()) next.name = "Vui lòng nhập tên.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email.trim()))
      next.email = "Email chưa đúng định dạng.";
    if (body.message.trim().length < 10)
      next.message = "Nội dung cần ít nhất 10 ký tự.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await api.post("/contact", body);
      setSent(true);
      toast.success(
        "Đã gửi. Chúng tôi sẽ phản hồi qua email trong 1–2 ngày làm việc.",
      );
    } catch (err) {
      setErrors(err.details ?? {});
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <main
        className="info-page contact-page vv-page-enter"
        style={{ maxWidth: 1040 }}
      >
        <div className="vv-page-hero" style={{ marginBottom: 24 }}>
          <div>
            <span className="section-kicker">
              LIÊN HỆ &amp; TƯ VẤN PHÒNG ĐÀN
            </span>
            <h1>Chúng tôi luôn lắng nghe phản hồi của bạn.</h1>
            <p>
              Hỗ trợ kỹ thuật Micro/MIDI, góp ý giáo trình Đàn Piano &amp; Sáo
              trúc C5, hoặc tư vấn triển khai gói Phòng đàn B2B cho trường nhạc.
            </p>
          </div>
          <a className="button button-primary" href="/pricing">
            Xem Bảng giá &amp; Gói B2B
          </a>
        </div>
        <div className="contact-grid">
          <aside>
            <p>
              <Mail size={16} /> Phản hồi qua email trong 1–2 ngày làm việc.
            </p>
            <p>
              <School size={16} /> Gói Studio: báo giá theo số ghế giáo viên và
              học viên.
            </p>
          </aside>
          {sent ? (
            <section className="vv-state">
              <Send size={24} aria-hidden="true" />
              <strong>Đã nhận tin nhắn của bạn.</strong>
              <span>Cảm ơn bạn đã liên hệ VocaVerse.</span>
            </section>
          ) : (
            <form className="auth-form" onSubmit={submit} noValidate>
              <label>
                Họ tên
                <input
                  name="name"
                  maxLength={80}
                  defaultValue={account?.name?.replace(/^\[Mẫu\]\s*/, "") ?? ""}
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name && (
                  <span className="vv-field-error">{errors.name}</span>
                )}
              </label>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={account?.email ?? ""}
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email && (
                  <span className="vv-field-error">{errors.email}</span>
                )}
              </label>
              <label>
                Chủ đề
                <select name="topic" defaultValue="support">
                  {TOPICS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nội dung
                <textarea
                  name="message"
                  rows={5}
                  maxLength={2000}
                  aria-invalid={Boolean(errors.message)}
                />
                {errors.message && (
                  <span className="vv-field-error">{errors.message}</span>
                )}
              </label>
              <button
                className="button button-primary"
                type="submit"
                disabled={busy}
              >
                {busy ? "Đang gửi…" : "Gửi tin nhắn"}
              </button>
            </form>
          )}
        </div>
      </main>
    </PageShell>
  );
}
