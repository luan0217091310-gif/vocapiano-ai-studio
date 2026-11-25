// Modal thanh toán VietQR (ảnh QR, số tiền, nội dung CK, đếm ngược, tự kiểm trạng thái đơn) và ô nhập mã quà tặng.
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Gift, QrCode, TimerReset, X } from "lucide-react";
import { applyUser } from "../api/client.js";
import {
  createOrder,
  getOrder,
  normalizeCode,
  redeemCode,
  sandboxConfirm,
  vnd,
} from "../pages/product/commerce.js";
import { t } from "../i18n/index.js";
import { toast } from "./toast.js";

const POLL_MS = 4000;

/** QR giả lập (sandbox): vẽ lưới theo băm của nội dung CK, không gọi dịch vụ ngoài. */
function SandboxQr({ seed }) {
  const n = 25;
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const cells = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const finder =
        (x < 7 && y < 7) || (x > n - 8 && y < 7) || (x < 7 && y > n - 8);
      let on;
      if (finder) {
        const fx = x > n - 8 ? x - (n - 7) : x;
        const fy = y > n - 8 ? y - (n - 7) : y;
        on =
          fx === 0 ||
          fx === 6 ||
          fy === 0 ||
          fy === 6 ||
          (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
      } else {
        h = Math.imul(h ^ (x * 31 + y), 16777619);
        on = (h >>> 7) % 2 === 0;
      }
      if (on)
        cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
    }
  return (
    <svg
      viewBox={`-2 -2 ${n + 4} ${n + 4}`}
      className="gx-qr-svg"
      role="img"
      aria-label="Mã QR mô phỏng"
    >
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      <g fill="#172432">{cells}</g>
    </svg>
  );
}

const mmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

function CopyRow({ label, value }) {
  return (
    <div className="gx-qr-row">
      <small>{label}</small>
      <strong>{value}</strong>
      <button
        type="button"
        aria-label={`Sao chép ${label}`}
        onClick={() =>
          navigator.clipboard?.writeText(String(value)).then(
            () => toast.success(`Đã sao chép ${label.toLowerCase()}.`),
            () => {},
          )
        }
      >
        <Copy size={14} />
      </button>
    </div>
  );
}

/**
 * CheckoutModal: mở với {plan, cycle, title}. Tạo đơn VietQR, đếm ngược, tự kiểm trạng thái mỗi 4 giây.
 * Máy chủ chưa có cổng VietQR → chế độ sandbox dev với nút "Mô phỏng đã chuyển khoản".
 */
export function CheckoutModal({ open, plan, cycle, title, onClose, onPaid }) {
  const [state, setState] = useState({ phase: "idle" });
  const [now, setNow] = useState(Date.now());
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setState({ phase: "creating" });
    createOrder(plan, cycle)
      .then(
        (r) =>
          alive && (setNow(Date.now()), setState({ phase: "pending", ...r })),
      )
      .catch((error) => alive && setState({ phase: "error", error }));
    return () => {
      alive = false;
    };
  }, [open, plan, cycle]);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const onKey = (e) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => {
      clearInterval(tick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Tự kiểm trạng thái đơn (chỉ khi có cổng thật).
  useEffect(() => {
    if (state.phase !== "pending" || state.sandbox) return undefined;
    const id = setInterval(async () => {
      try {
        const o = await getOrder(state.order.id);
        if (o.status === "paid") {
          if (o.user) applyUser(o.user);
          setState((s) => ({ ...s, phase: "paid" }));
        } else if (o.status === "expired" || o.status === "cancelled") {
          setState((s) => ({ ...s, phase: "expired" }));
        }
      } catch {
        /* mất mạng tạm thời: thử lại ở nhịp sau */
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [state.phase, state.sandbox, state.order?.id]);

  const left = state.order
    ? new Date(state.order.expiresAt).getTime() - now
    : 0;
  useEffect(() => {
    if (state.phase === "pending" && state.order && left <= 0)
      setState((s) => ({ ...s, phase: "expired" }));
  }, [left, state.phase, state.order]);

  useEffect(() => {
    if (state.phase === "paid") {
      toast.success("Thanh toán thành công. Gói đã được kích hoạt.");
      onPaid?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  async function simulate() {
    setState((s) => ({ ...s, busy: true }));
    try {
      const r = await sandboxConfirm(state.order);
      applyUser(r.user);
      setState((s) => ({ ...s, busy: false, phase: "paid" }));
    } catch (err) {
      setState((s) => ({ ...s, busy: false }));
      toast.error(err.message);
    }
  }

  function retry() {
    setState({ phase: "creating" });
    createOrder(plan, cycle)
      .then((r) => (setNow(Date.now()), setState({ phase: "pending", ...r })))
      .catch((error) => setState({ phase: "error", error }));
  }

  if (!open) return null;
  const o = state.order;
  return (
    <div
      className="vv-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="vv-modal gx-checkout"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gx-checkout-title"
        tabIndex={-1}
        ref={ref}
      >
        <button
          type="button"
          className="gx-modal-x"
          aria-label="Đóng"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <h2 id="gx-checkout-title">
          <QrCode size={20} /> {title}
        </h2>
        {state.phase === "creating" && (
          <p role="status">Đang tạo mã thanh toán…</p>
        )}
        {state.phase === "error" && (
          <div role="alert" className="gx-checkout-msg error">
            <p>{state.error?.message ?? "Chưa tạo được đơn thanh toán."}</p>
            <button
              type="button"
              className="button button-quiet"
              onClick={retry}
            >
              Thử lại
            </button>
          </div>
        )}
        {o && state.phase === "pending" && (
          <div className="gx-qr">
            <div className="gx-qr-img">
              {o.qrImageUrl ? (
                <img
                  src={o.qrImageUrl}
                  alt={`Mã VietQR thanh toán ${vnd(o.amountVnd)}`}
                  width="220"
                  height="220"
                />
              ) : (
                <SandboxQr seed={o.transferNote} />
              )}
              <span className="gx-timer" aria-live="off">
                <TimerReset size={14} /> Hết hạn sau {mmss(left)}
              </span>
            </div>
            <div className="gx-qr-info">
              {state.sandbox && (
                <p className="gx-sandbox">
                  <strong>Chế độ sandbox (dev).</strong> Máy chủ chưa kết nối
                  cổng VietQR; mã QR chỉ để xem giao diện, không chuyển tiền
                  thật.
                </p>
              )}
              <CopyRow label="Số tiền" value={vnd(o.amountVnd)} />
              <CopyRow label="Nội dung CK" value={o.transferNote} />
              <CopyRow label="Ngân hàng" value={o.bank?.name} />
              <CopyRow label="Số tài khoản" value={o.bank?.account} />
              <CopyRow label="Chủ tài khoản" value={o.bank?.holder} />
              <ol className="gx-qr-steps">
                <li>Mở ứng dụng ngân hàng, chọn Quét QR.</li>
                <li>Giữ nguyên số tiền và nội dung chuyển khoản.</li>
                <li>Gói kích hoạt tự động khi hệ thống nhận được tiền.</li>
              </ol>
              <p className="gx-checkout-status" role="status">
                <span className="status-pip" /> Đang chờ thanh toán…
              </p>
              {state.sandbox && (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={simulate}
                  disabled={state.busy}
                >
                  {state.busy ? "Đang xử lý…" : "Mô phỏng đã chuyển khoản"}
                </button>
              )}
            </div>
          </div>
        )}
        {state.phase === "expired" && (
          <div className="gx-checkout-msg" role="alert">
            <p>
              Mã thanh toán đã hết hạn. Nếu bạn đã chuyển khoản, gói sẽ được
              kích hoạt khi tiền về.
            </p>
            <button
              type="button"
              className="button button-primary"
              onClick={retry}
            >
              Tạo mã mới
            </button>
          </div>
        )}
        {state.phase === "paid" && (
          <div className="gx-checkout-msg ok" role="status">
            <CheckCircle2 size={36} />
            <p>Thanh toán thành công. Cảm ơn bạn!</p>
            <a className="button button-primary" href="/dashboard">
              Vào học ngay
            </a>
          </div>
        )}
        <p className="gx-legal">
          {t("pr.refund1")} {t("pr.refund2")}
        </p>
      </div>
    </div>
  );
}

/** Ô "Có mã quà tặng / Combo hộp nhạc cụ?" dùng ở /pricing và /profile. */
export function RedeemBox({ loggedIn, compact = false, onRedeemed }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (!loggedIn) {
      location.href = `/login?next=${encodeURIComponent(location.pathname + "#redeem")}`;
      return;
    }
    const clean = code.replace(/-/g, "");
    if (clean.length < 8) {
      setErr("Mã gồm ít nhất 8 ký tự chữ và số.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await redeemCode(code);
      if (r?.user) applyUser(r.user);
      toast.success(t("pr.redeemOk"));
      setCode("");
      onRedeemed?.(r);
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className={`gx-redeem ${compact ? "compact" : ""}`}
      onSubmit={submit}
      id="redeem"
    >
      <span className="gx-redeem-icon" aria-hidden="true">
        <Gift size={20} />
      </span>
      <div className="gx-redeem-copy">
        <strong>{t("pr.redeemTitle")}</strong>
        <small>{t("pr.redeemDesc")}</small>
      </div>
      <label className="gx-redeem-field">
        <span className="sr-only">Mã kích hoạt</span>
        <input
          value={code}
          onChange={(e) => {
            setCode(normalizeCode(e.target.value).slice(0, 24));
            setErr("");
          }}
          placeholder={t("pr.redeemPh")}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(err)}
          aria-describedby={err ? "gx-redeem-err" : undefined}
        />
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? "…" : loggedIn ? t("pr.redeemBtn") : t("pr.redeemLogin")}
        </button>
      </label>
      {err && (
        <small id="gx-redeem-err" className="gx-redeem-err" role="alert">
          {err}
        </small>
      )}
    </form>
  );
}
