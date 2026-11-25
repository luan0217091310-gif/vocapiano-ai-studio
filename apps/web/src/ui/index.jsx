// Component giao diện dùng chung. Toast dùng bus sự kiện để gọi được từ bất kỳ đâu: toast.success("…").
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Inbox, X } from "lucide-react";

import { subscribeToasts } from "./toast.js";

export { toast } from "./toast.js";

export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const add = (t) => {
      setItems((list) => [...list.slice(-3), t]);
      setTimeout(
        () => setItems((list) => list.filter((x) => x.id !== t.id)),
        4500,
      );
    };
    return subscribeToasts(add);
  }, []);
  return (
    <div className="vv-toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`vv-toast ${t.kind}`}>
          <span>{t.message}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Hộp xác nhận: đóng bằng Esc, bẫy focus vào nút đầu tiên. */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Xác nhận",
  danger,
  busy,
  onConfirm,
  onClose,
  children,
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector("input, button")?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="vv-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="vv-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vv-modal-title"
        ref={ref}
      >
        <h2 id="vv-modal-title">{title}</h2>
        {message && <p>{message}</p>}
        {children}
        <div className="vv-modal-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={onClose}
            disabled={busy}
          >
            Huỷ
          </button>
          <button
            type="button"
            className={`button button-primary ${danger ? "button-danger" : ""}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Đang xử lý…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export const Skeleton = ({ w = "100%", h = 16, style }) => (
  <span
    className="vv-skeleton"
    aria-hidden="true"
    style={{ width: w, height: h, ...style }}
  />
);

export function SkeletonRows({ rows = 4 }) {
  return (
    <div
      role="status"
      aria-label="Đang tải"
      style={{ display: "grid", gap: 10 }}
    >
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} h={18} w={`${90 - i * 8}%`} />
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="vv-state">
      <Inbox size={22} aria-hidden="true" />
      <strong>{title}</strong>
      {children && <span>{children}</span>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="vv-state error" role="alert">
      <AlertTriangle size={22} aria-hidden="true" />
      <strong>Chưa tải được dữ liệu</strong>
      <span>{error?.message ?? "Đã có lỗi xảy ra."}</span>
      {onRetry && (
        <button type="button" className="button button-quiet" onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  );
}

export const Badge = ({ tone = "", children }) => (
  <span className={`vv-badge ${tone}`}>{children}</span>
);

/** Hook tải dữ liệu: trả { data, meta, error, loading, reload } — đủ 4 trạng thái cho màn hình. */
export function useApi(loader, deps = []) {
  const [state, setState] = useState({
    loading: true,
    data: null,
    meta: null,
    error: null,
  });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader()
      .then(
        (r) =>
          alive &&
          setState({
            loading: false,
            data: r?.data ?? r,
            meta: r?.meta ?? null,
            error: null,
          }),
      )
      .catch(
        (error) =>
          alive && setState({ loading: false, data: null, meta: null, error }),
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function Pager({ meta, onPage }) {
  if (!meta) return null;
  const pages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  return (
    <nav className="vv-pager" aria-label="Phân trang">
      <span>
        Trang {meta.page}/{pages} · {meta.total} mục
      </span>
      <div>
        <button
          type="button"
          className="button button-quiet"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          Trước
        </button>
        <button
          type="button"
          className="button button-quiet"
          disabled={meta.page >= pages}
          onClick={() => onPage(meta.page + 1)}
        >
          Sau
        </button>
      </div>
    </nav>
  );
}
