import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  KeyRound,
  LogOut,
  MailWarning,
  Settings2,
  Trash2,
  UserRound,
} from "lucide-react";
import { api, applyUser, logout } from "../../api/client.js";
import { readProductState } from "../../productStore.js";
import {
  Badge,
  ConfirmModal,
  ErrorState,
  SkeletonRows,
  toast,
  useApi,
} from "../../ui/index.jsx";
import { ProductNav } from "./ProductNav.jsx";
import { RedeemBox } from "../../ui/commerce.jsx";

const PLAN_LABEL = {
  free: "Miễn phí",
  starter: "Khởi động",
  plus: "Plus",
  founder: "Sáng lập",
  studio: "Studio",
};
const CYCLE = {
  month: "tháng",
  quarter: "quý",
  year: "năm",
  pass30: "30 ngày",
};
const vnd = (n) => n.toLocaleString("vi-VN") + " đ";

export function ProfilePage() {
  const data = readProductState();
  const [account, setAccount] = useState(data.account);
  const progressQ = useApi(() => api.get("/me/progress"));
  const paymentsQ = useApi(() => api.get("/billing/payments"));
  const [busy, setBusy] = useState("");
  const [pwErrors, setPwErrors] = useState({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);

  async function saveName(event) {
    event.preventDefault();
    const displayName = String(
      new FormData(event.currentTarget).get("displayName"),
    ).trim();
    if (!displayName) return toast.error("Tên hiển thị không được để trống.");
    setBusy("name");
    try {
      const { user } = await api.patch("/me", { displayName });
      applyUser(user);
      setAccount(readProductState().account);
      toast.success("Đã lưu tên hiển thị.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    const errs = {};
    if (
      f.newPassword.length < 8 ||
      !/[A-Za-z]/.test(f.newPassword) ||
      !/\d/.test(f.newPassword)
    )
      errs.newPassword = "Mật khẩu mới cần ít nhất 8 ký tự, có cả chữ và số.";
    if (f.newPassword !== f.confirm)
      errs.confirm = "Hai mật khẩu chưa trùng nhau.";
    setPwErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy("pw");
    try {
      await api.post("/auth/change-password", {
        currentPassword: f.currentPassword,
        newPassword: f.newPassword,
      });
      form.reset();
      toast.success("Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.");
    } catch (err) {
      setPwErrors(
        err.details?.currentPassword
          ? { currentPassword: "Mật khẩu hiện tại không đúng." }
          : {},
      );
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  async function resendVerify() {
    setBusy("verify");
    try {
      await api.post("/auth/resend-verification");
      toast.success("Đã gửi lại email xác minh.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  async function cancelPlan() {
    setBusy("cancel");
    try {
      const { user } = await api.post("/billing/cancel");
      applyUser(user);
      setAccount(readProductState().account);
      setCancelOpen(false);
      toast.success("Đã chuyển về gói Free.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  }

  async function deleteAccount() {
    setBusy("delete");
    try {
      await api.del("/me", { password: deletePw });
      await logout();
      window.location.href = "/?deleted=1";
    } catch (err) {
      toast.error(err.message);
      setBusy("");
    }
  }

  const progress = progressQ.data;
  return (
    <div className="product-shell">
      <ProductNav />
      <main className="profile-main vv-page-enter">
        <nav className="vv-breadcrumb" aria-label="Breadcrumb">
          <a href="/dashboard">Tổng quan</a> / <span>Hồ sơ và cài đặt</span>
        </nav>
        <span className="section-kicker">HỒ SƠ CỦA BẠN</span>
        <h1>Không gian của bạn.</h1>
        <section className="profile-card">
          <div className="profile-avatar-large">
            {(account?.name || account?.email || "V")
              .replace(/^\[Mẫu\]\s*/, "")[0]
              ?.toUpperCase()}
          </div>
          <div>
            <Badge tone={account?.plan === "free" ? "gray" : "orange"}>
              Gói {PLAN_LABEL[account?.plan] ?? "Free"}
            </Badge>{" "}
            {account?.role === "admin" && <Badge>Quản trị viên</Badge>}
            <h2>{account?.name}</h2>
            <p>
              {account?.email}{" "}
              {account?.emailVerified ? (
                <Badge>
                  <BadgeCheck size={12} /> Đã xác minh
                </Badge>
              ) : (
                <Badge tone="red">Chưa xác minh</Badge>
              )}
            </p>
          </div>
          <a className="button button-quiet" href="/pricing">
            {account?.plan === "free" ? "Nâng cấp Plus" : "Xem gói học"}{" "}
            <ArrowRight size={15} />
          </a>
        </section>

        {!account?.emailVerified && (
          <p className="vv-state error profile-verify" role="status">
            <MailWarning size={18} aria-hidden="true" />
            <span>
              Xác minh email để khôi phục tài khoản khi quên mật khẩu.
            </span>
            <button
              className="button button-quiet"
              onClick={resendVerify}
              disabled={busy === "verify"}
            >
              {busy === "verify" ? "Đang gửi…" : "Gửi lại email xác minh"}
            </button>
          </p>
        )}

        <div className="profile-stats">
          {progressQ.loading && <SkeletonRows rows={2} />}
          {progressQ.error && (
            <ErrorState error={progressQ.error} onRetry={progressQ.reload} />
          )}
          {progress && (
            <>
              <article>
                <small>Lượt luyện</small>
                <strong>{progress.totals.sessions}</strong>
              </article>
              <article>
                <small>XP · cấp độ</small>
                <strong>
                  {progress.totals.xp} · cấp {progress.level}
                </strong>
              </article>
              <article>
                <small>Huy hiệu</small>
                <strong>{progress.badges.length}</strong>
              </article>
            </>
          )}
        </div>

        <section className="settings-grid">
          <form className="gm-card" onSubmit={saveName}>
            <h3>
              <UserRound size={17} /> Thông tin cá nhân
            </h3>
            <label className="vv-label">
              Tên hiển thị
              <input
                name="displayName"
                defaultValue={account?.name}
                maxLength={60}
                required
              />
            </label>
            <button
              className="button button-primary"
              disabled={busy === "name"}
            >
              {busy === "name" ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </form>

          <form className="gm-card" onSubmit={changePassword} noValidate>
            <h3>
              <KeyRound size={17} /> Đổi mật khẩu
            </h3>
            <label className="vv-label">
              Mật khẩu hiện tại
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
              {pwErrors.currentPassword && (
                <span className="vv-field-error">
                  {pwErrors.currentPassword}
                </span>
              )}
            </label>
            <label className="vv-label">
              Mật khẩu mới
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
              />
              {pwErrors.newPassword && (
                <span className="vv-field-error">{pwErrors.newPassword}</span>
              )}
            </label>
            <label className="vv-label">
              Nhập lại mật khẩu mới
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
              />
              {pwErrors.confirm && (
                <span className="vv-field-error">{pwErrors.confirm}</span>
              )}
            </label>
            <button className="button button-primary" disabled={busy === "pw"}>
              {busy === "pw" ? "Đang lưu…" : "Đổi mật khẩu"}
            </button>
          </form>

          <article className="gm-card">
            <h3>
              <CreditCard size={17} /> Gói và thanh toán
            </h3>
            <p className="gm-muted">
              Gói hiện tại:{" "}
              <strong>{PLAN_LABEL[account?.plan] ?? "Miễn phí"}</strong>. Chúng
              tôi báo trước ít nhất 7 ngày làm việc trước mỗi kỳ gia hạn; hoàn
              tiền trong 7 ngày đầu nếu bạn chưa hài lòng.
            </p>
            {paymentsQ.data?.length > 0 && (
              <ul className="settings-list">
                {paymentsQ.data.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    {new Date(p.createdAt).toLocaleDateString("vi-VN")} ·{" "}
                    {PLAN_LABEL[p.plan] ?? p.plan} {CYCLE[p.cycle] ?? p.cycle} ·{" "}
                    {vnd(p.amountVnd)}{" "}
                    <Badge tone={p.status === "paid" ? "" : "red"}>
                      {p.status === "paid" ? "Thành công" : "Thất bại"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <RedeemBox
              loggedIn
              compact
              onRedeemed={() => setAccount(readProductState().account)}
            />
            {account?.plan && account.plan !== "free" ? (
              <button
                className="button button-quiet"
                onClick={() => setCancelOpen(true)}
              >
                Huỷ gói {PLAN_LABEL[account.plan] ?? account.plan}
              </button>
            ) : (
              <a className="button button-quiet" href="/pricing">
                Xem các gói
              </a>
            )}
          </article>

          <article className="gm-card">
            <h3>
              <BadgeCheck size={17} /> Quyền riêng tư, Phụ huynh & Dữ liệu (D-21
              · D-30)
            </h3>
            <p className="gm-muted">
              Âm thanh từ micro được xử lý 100% trên thiết bị và không gửi lên
              máy chủ. Bạn có thể ghi nhận đồng ý của phụ huynh hoặc tải toàn bộ
              dữ liệu cá nhân về máy.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                className="button button-quiet"
                onClick={() =>
                  api
                    .put("/me/consents", {
                      consentType: "parent_guardian",
                      granted: true,
                      note: "Phụ huynh đồng ý cho học viên luyện tập có giám sát",
                    })
                    .then(() =>
                      toast.success("Đã lưu xác nhận đồng ý của phụ huynh."),
                    )
                    .catch((e) => toast.error(e.message))
                }
              >
                Xác nhận đồng ý phụ huynh
              </button>
              <button
                type="button"
                className="button button-quiet"
                onClick={async () => {
                  try {
                    const dump = await api.get("/me/export");
                    const blob = new Blob([JSON.stringify(dump, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `vocaverse-data-${account?.id ?? "me"}.json`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    toast.success("Đã tải xuống tệp dữ liệu cá nhân (.json).");
                  } catch (e) {
                    toast.error(e.message);
                  }
                }}
              >
                Tải dữ liệu cá nhân (.json)
              </button>
            </div>
          </article>

          <article className="gm-card">
            <h3>
              <Settings2 size={17} /> Lựa chọn học
            </h3>
            <p className="gm-muted">
              {data.onboarding?.instrument === "sao_truc"
                ? "Sáo trúc"
                : "Piano"}{" "}
              · mục tiêu {data.onboarding?.time ?? 15} phút/ngày
            </p>
            <a className="button button-quiet" href="/onboarding">
              Làm lại khảo sát
            </a>
            <button
              className="button button-quiet"
              onClick={async () => {
                await logout();
                window.location.href = "/";
              }}
            >
              <LogOut size={15} /> Đăng xuất
            </button>
          </article>

          <article className="gm-card danger-zone">
            <h3>
              <Trash2 size={17} /> Xoá tài khoản
            </h3>
            <p className="gm-muted">
              Tài khoản bị khoá ngay và không đăng nhập lại được. Liên hệ hỗ trợ
              trong 30 ngày nếu muốn khôi phục.
            </p>
            <button
              className="button button-danger"
              onClick={() => setDeleteOpen(true)}
            >
              Xoá tài khoản
            </button>
          </article>
        </section>
      </main>

      <ConfirmModal
        open={cancelOpen}
        title="Huỷ gói Plus?"
        message="Bạn sẽ về gói Free: chỉ mở 4 bài đầu mỗi nhạc cụ và không dùng được chế độ Kiểm tra."
        confirmLabel="Huỷ gói"
        danger
        busy={busy === "cancel"}
        onConfirm={cancelPlan}
        onClose={() => setCancelOpen(false)}
      />
      <ConfirmModal
        open={deleteOpen}
        title="Xoá tài khoản VocaVerse?"
        message="Nhập mật khẩu để xác nhận. Bạn sẽ bị đăng xuất khỏi mọi thiết bị."
        confirmLabel="Xoá vĩnh viễn"
        danger
        busy={busy === "delete"}
        onConfirm={deleteAccount}
        onClose={() => setDeleteOpen(false)}
      >
        <label className="vv-label">
          Mật khẩu
          <input
            type="password"
            value={deletePw}
            onChange={(e) => setDeletePw(e.target.value)}
            autoComplete="current-password"
          />
        </label>
      </ConfirmModal>
    </div>
  );
}
