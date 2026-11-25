// Xác minh email và đặt lại mật khẩu bằng token trong liên kết email.
import { useEffect, useState } from "react";
import { CheckCircle2, MailWarning } from "lucide-react";
import { api, applyUser } from "../api/client.js";
import { readProductState } from "../productStore.js";
import { PageShell } from "./Shared.jsx";

const tokenFromUrl = () =>
  new URLSearchParams(location.search).get("token") ?? "";

export function VerifyEmailPage() {
  const [state, setState] = useState({ status: "loading", message: "" });
  useEffect(() => {
    const token = tokenFromUrl();
    if (!token) {
      setState({ status: "error", message: "Liên kết thiếu mã xác minh." });
      return;
    }
    api
      .post("/auth/verify-email", { token })
      .then(({ user }) => {
        if (readProductState().account?.id === user.id) applyUser(user);
        setState({ status: "done", message: "" });
      })
      .catch((err) => setState({ status: "error", message: err.message }));
  }, []);
  return (
    <PageShell>
      <main
        className="info-page narrow-page"
        aria-busy={state.status === "loading"}
      >
        {state.status === "loading" && (
          <p role="status">Đang xác minh email…</p>
        )}
        {state.status === "done" && (
          <section className="vv-state">
            <CheckCircle2 size={28} color="#2b8a57" aria-hidden="true" />
            <strong>Email đã được xác minh.</strong>
            <span>Cảm ơn bạn! Giờ bạn có thể tiếp tục luyện tập.</span>
            <a className="button button-primary" href="/dashboard">
              Vào bảng điều khiển
            </a>
          </section>
        )}
        {state.status === "error" && (
          <section className="vv-state error" role="alert">
            <MailWarning size={28} aria-hidden="true" />
            <strong>Không xác minh được email.</strong>
            <span>
              {state.message} Bạn có thể gửi lại email xác minh ở trang Hồ sơ.
            </span>
            <a className="button button-quiet" href="/profile">
              Mở trang Hồ sơ
            </a>
          </section>
        )}
      </main>
    </PageShell>
  );
}

export function ResetPasswordPage() {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== data.get("confirm"))
      return setError("Hai mật khẩu chưa trùng nhau.");
    if (
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password)
    )
      return setError("Mật khẩu cần ít nhất 8 ký tự, có cả chữ và số.");
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/reset-password", {
        token: tokenFromUrl(),
        password,
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageShell>
      <main className="info-page narrow-page">
        <h1>Đặt mật khẩu mới</h1>
        {done ? (
          <section className="vv-state">
            <CheckCircle2 size={28} color="#2b8a57" aria-hidden="true" />
            <strong>Đã đổi mật khẩu.</strong>
            <span>
              Các phiên đăng nhập cũ đã được đăng xuất để bảo vệ tài khoản.
            </span>
            <a className="button button-primary" href="/login">
              Đăng nhập
            </a>
          </section>
        ) : (
          <form className="auth-form" onSubmit={submit} noValidate>
            <label>
              Mật khẩu mới
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <label>
              Nhập lại mật khẩu mới
              <input
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            {error && (
              <p className="form-message" role="alert">
                {error}
              </p>
            )}
            <button
              className="button button-primary"
              type="submit"
              disabled={busy}
            >
              {busy ? "Đang lưu…" : "Lưu mật khẩu mới"}
            </button>
          </form>
        )}
      </main>
    </PageShell>
  );
}
