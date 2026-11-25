// Nút "Tay mẫu 3D" trong phòng luyện: chỉ hiện khi bài hiện tại có mô hình; mở hộp xem tay idol đúng ngón.
import { useEffect, useState } from "react";
import { Box, X } from "lucide-react";
import { api } from "../api/client.js";
import VerifiedHand3D from "./VerifiedHand3D.jsx";

let cache = null;

export default function StudioHand3D({ lessonId, onOpen }) {
  const [ids, setIds] = useState(cache);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (cache) return;
    api
      .get("/hand3d")
      .then((rows) => {
        cache = new Set(rows.map((r) => r.lessonId));
        setIds(cache);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  if (!ids?.has(lessonId)) return null;
  return (
    <>
      <button
        type="button"
        className="studio-hand3d-button"
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        <Box size={13} /> Tay mẫu 3D
      </button>
      {open && (
        <div
          className="vv-modal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <section
            className="vv-modal studio-hand3d-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Tay mẫu 3D bài ${lessonId}`}
          >
            <header>
              <strong>Tay mẫu 3D · {lessonId}</strong>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </header>
            <VerifiedHand3D lessonId={lessonId} autoOpen />
          </section>
        </div>
      )}
    </>
  );
}
