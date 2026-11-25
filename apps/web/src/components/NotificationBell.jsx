// Chuông thông báo trong ứng dụng: tải khi mở, tự làm mới mỗi 60 giây, đánh dấu đã đọc.
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { api, request } from "../api/client.js";

const timeAgo = (iso) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.round(s / 60)} phút trước`;
  if (s < 86400) return `${Math.round(s / 3600)} giờ trước`;
  return `${Math.round(s / 86400)} ngày trước`;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(null);
  const ref = useRef(null);

  const load = useCallback(() => {
    request("GET", "/me/notifications?pageSize=10")
      .then(({ data, meta }) => {
        setItems(data);
        setUnread(meta.unread);
        setError(null);
      })
      .catch(setError);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const markAll = async () => {
    await api.post("/me/notifications/all/read").catch(() => {});
    load();
  };

  return (
    <div className="vv-bell" ref={ref}>
      <button
        type="button"
        className="vv-bell-button"
        aria-label={unread ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="vv-bell-dot">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
      {open && (
        <div className="vv-bell-panel" role="dialog" aria-label="Thông báo">
          <header>
            <strong>Thông báo</strong>
            {unread > 0 && (
              <button type="button" onClick={markAll}>
                Đánh dấu đã đọc
              </button>
            )}
          </header>
          {error && <p className="vv-bell-empty">Chưa tải được thông báo.</p>}
          {!error && items.length === 0 && (
            <p className="vv-bell-empty">Bạn chưa có thông báo nào.</p>
          )}
          <ul>
            {items.map((n) => (
              <li key={n.id} className={n.readAt ? "" : "unread"}>
                <strong>{n.title}</strong>
                {n.body && <span>{n.body}</span>}
                <small>{timeAgo(n.createdAt)}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
