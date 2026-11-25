// Tính mới A: tay mẫu 3D đã kiểm chứng ngay trong bài học. Đủ 4 trạng thái: tải, khoá theo gói, lỗi, sẵn sàng.
import { lazy, Suspense, useEffect, useState } from "react";
import { BadgeCheck, Box, Lock } from "lucide-react";
import { api } from "../api/client.js";
import { Badge, ErrorState, Skeleton } from "../ui/index.jsx";

// three.js nặng: chỉ tải khi người dùng mở tay mẫu 3D.
const Hand3DViewer = lazy(() => import("./Hand3DViewer.jsx"));

export default function VerifiedHand3D({ lessonId, autoOpen = false }) {
  const [state, setState] = useState({ status: "idle" });
  const open = async () => {
    setState({ status: "loading" });
    try {
      setState({
        status: "ready",
        data: await api.get(`/lessons/${encodeURIComponent(lessonId)}/hand3d`),
      });
    } catch (error) {
      setState({
        status: error.code === "PLAN_REQUIRED" ? "locked" : "error",
        error,
      });
    }
  };
  useEffect(() => {
    if (autoOpen) open();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ tự mở một lần khi gắn vào
  }, []);
  if (state.status === "idle")
    return (
      <button
        type="button"
        className="button button-quiet hand3d-open"
        onClick={open}
      >
        <Box size={16} /> Xem tay mẫu 3D đúng ngón
      </button>
    );
  if (state.status === "loading") return <Skeleton h={220} />;
  if (state.status === "locked")
    return (
      <div className="vv-state">
        <Lock size={22} aria-hidden="true" />
        <strong>Tay mẫu 3D của bài này dành cho gói Plus</strong>
        <span>Bài PN01 xem miễn phí tại trang Demo 3D.</span>
        <a className="button button-primary" href="/pricing">
          Xem gói Plus
        </a>
      </div>
    );
  if (state.status === "error")
    return <ErrorState error={state.error} onRetry={open} />;
  const { data } = state;
  const ver = data.verification;
  return (
    <div className="verified-hand">
      <div className="verified-hand-head">
        {ver?.t1Passed ? (
          <Badge>
            <BadgeCheck size={13} /> Kiểm chứng T1: {ver.t1Events} nốt đúng
            phím, đúng ngón
          </Badge>
        ) : (
          <Badge tone="gray">Chưa có báo cáo kiểm chứng</Badge>
        )}
        {ver?.pfs != null && <Badge tone="orange">PFS {ver.pfs}/100</Badge>}
        {ver?.decision === "human_review" && (
          <Badge tone="gray">Chờ giáo viên duyệt</Badge>
        )}
      </div>
      <Suspense fallback={<Skeleton h={300} />}>
        <Hand3DViewer modelSrc={data.model} audioSrc={data.audio} />
      </Suspense>
    </div>
  );
}
