import { useEffect, useState } from "react";
import StudioHand3D from "./components/StudioHand3D.jsx";
import MusicImporterModal from "./components/MusicImporterModal.jsx";
import AiTutorChatPanel from "./components/AiTutorChatPanel.jsx";
import {
  Bot,
  Clapperboard,
  Circle,
  Expand,
  Headphones,
  HeartPulse,
  Music2,
  Play,
  Smartphone,
  Square,
  Upload,
  X,
} from "lucide-react";
import { StudioController } from "./studio/controller.js";
import { useStudio } from "./studio/useStudio.js";
import TransportBar from "./components/TransportBar.jsx";
import LessonDrawer from "./components/LessonDrawer.jsx";
import IdolStage from "./components/IdolStage.jsx";
import MusicVisualizer from "./components/MusicVisualizer.jsx";
import InstrumentDock from "./components/InstrumentDock.jsx";
import TelemetryBar from "./components/TelemetryBar.jsx";
import StudioDialogs, { FocusTrap } from "./components/StudioDialogs.jsx";
import { useCreatorRecorder } from "./studio/useCreatorRecorder.js";
import { PostureCard, RestScreen } from "./components/StudioDialogs.jsx";
import { AI_NOTICE } from "./studio/safety.js";

const controller = new StudioController();
export default function PracticeStudio() {
  const c = controller,
    s = useStudio(c);
  const [drawer, setDrawer] = useState(false),
    [modal, setModal] = useState(null),
    [view, setView] = useState("roll"),
    [camera, setCamera] = useState("full"),
    [creator, setCreator] = useState(false),
    [ratio, setRatio] = useState("landscape"),
    [online, setOnline] = useState(navigator.onLine),
    [importerOpen, setImporterOpen] = useState(false),
    [aiChatOpen, setAiChatOpen] = useState(false);
  const recorder = useCreatorRecorder(ratio, s.lesson?.id);
  useEffect(() => {
    c.init();
    const blur = () => c.pause(true),
      hidden = () => {
        if (document.hidden) c.pause(true);
      };
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hidden);
      c.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- controller/recorder ổn định suốt vòng đời; chỉ chạy lại theo các trạng thái liệt kê
  }, []);
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    const keys = "awsedftgyhujk";
    const keydown = (e) => {
      if (
        e.repeat ||
        e.ctrlKey ||
        e.altKey ||
        e.metaKey ||
        /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)
      )
        return;
      if (e.key === "Escape") {
        if (modal) setModal(null);
        else if (drawer) setDrawer(false);
        else if (creator) setCreator(false);
        return;
      }
      if (modal || drawer || s.rest || s.posture) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (s.status === "paused") c.resume();
        else if (c.run) c.pause();
        else c.start("practice");
        return;
      }
      const i = keys.indexOf(e.key.toLowerCase());
      if (i >= 0) {
        e.preventDefault();
        c.press(e.code, (s.lesson?.instrument === "sao_truc" ? 72 : 60) + i);
      }
    };
    const keyup = (e) => c.release(e.code);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- controller/recorder ổn định suốt vòng đời; chỉ chạy lại theo các trạng thái liệt kê
  }, [s.status, s.lesson, s.rest, s.posture, drawer, modal, creator]);
  useEffect(() => {
    if (s.status === "finished" && !s.loop && !creator) setModal("report");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- controller/recorder ổn định suốt vòng đời; chỉ chạy lại theo các trạng thái liệt kê
  }, [s.status]);
  useEffect(() => {
    if (!creator && recorder.recording) recorder.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- controller/recorder ổn định suốt vòng đời; chỉ chạy lại theo các trạng thái liệt kê
  }, [creator, recorder.recording]);
  function openModal(kind) {
    if (c.run && s.status !== "paused") c.pause();
    setModal(kind);
  }
  if (s.loading)
    return (
      <div className="loading-screen">
        <Music2 size={35} />
        <h1>Chuẩn bị phòng luyện của bạn…</h1>
        <p>Đang tải bản nhạc và gia sư trên thiết bị.</p>
      </div>
    );
  return (
    <div
      className={`studio-app ${creator ? `creator-mode ${ratio}` : ""}`}
      data-status={s.status}
      data-mode={s.mode}
    >
      <TransportBar
        s={s}
        controller={c}
        drawer={drawer}
        setDrawer={(value) => {
          if (value && c.run) c.pause();
          setDrawer(value);
        }}
        creator={creator}
        setCreator={setCreator}
        openModal={openModal}
      />
      <div className="workspace-shell">
        <div className="workspace-topline">
          <div className="breadcrumbs">
            Không gian học <span>/</span>{" "}
            {s.lesson?.instrument === "sao_truc" ? "Sáo trúc" : "Piano"}{" "}
            <span>/</span>
            <strong>
              {s.lesson?.id} ·{" "}
              {s.mode === "learn" ? "Học cùng gia sư" : "Kiểm tra lưu giữ"}
            </strong>
            {online && (
              <StudioHand3D
                lessonId={s.lesson?.id}
                onOpen={() => c.run && c.pause()}
              />
            )}
          </div>
          <p className="ai-notice" role="note">
            <span className="ai-chip">AI</span>
            {AI_NOTICE}
          </p>
          <button
            className="fatigue-button"
            onClick={() => {
              setModal(null);
              c.fatigue();
            }}
            title="Dừng ngay và nghỉ 10 phút"
          >
            <HeartPulse size={14} />
            Mỏi tay / Chóng mặt
          </button>
          <button
            type="button"
            className={`session-tip ${online ? "" : "offline"} ${s.headphones ? "is-headphones" : ""}`}
            onClick={() => c.set({ headphones: !s.headphones })}
            title="Bấm để xác nhận đang đeo tai nghe (cho phép bật tiếng click Metronome khi dùng Micro)"
          >
            {online ? <Headphones size={13} /> : <Smartphone size={13} />}
            {online
              ? s.headphones
                ? "Đã đeo tai nghe (bật tiếng nhịp)"
                : "Đeo tai nghe để tập trung hơn"
              : "Ngoại tuyến · đang dùng dữ liệu đã lưu"}
            {online && <span className="keycap">?</span>}
          </button>
        </div>
        {!c.run && (
          <div
            className="quick-guide-strip"
            role="region"
            aria-label="Hướng dẫn 3 bước bắt đầu trong 10 giây"
          >
            <span className="qg-title">Bắt đầu nhanh:</span>
            <button
              type="button"
              className="qg-step"
              onClick={() => c.start("demo")}
            >
              <b>1</b> Nghe mẫu
            </button>
            <span className="qg-arrow" aria-hidden="true">
              →
            </span>
            <button
              type="button"
              className={`qg-step ${s.micStatus === "on" || s.micStatus === "sim" ? "done" : ""}`}
              onClick={() =>
                s.micStatus === "on" || s.micStatus === "sim"
                  ? c.disableMic()
                  : c.enableMic()
              }
            >
              <b>2</b>{" "}
              {s.micStatus === "on" || s.micStatus === "sim"
                ? "Micro đã bật ✓"
                : "Bật Micro"}
            </button>
            <span className="qg-arrow" aria-hidden="true">
              →
            </span>
            <button
              type="button"
              className="qg-step primary"
              onClick={() => c.start("practice")}
            >
              <b>3</b>{" "}
              {s.lesson?.instrument === "sao_truc"
                ? "Bắt đầu thổi"
                : "Bắt đầu tập"}
            </button>
            <button
              type="button"
              className="qg-step"
              onClick={() => setImporterOpen(true)}
              title="Dán link hoặc tải file nhạc bất kỳ để tự ra bản Piano & Sáo C5"
            >
              <Upload size={13} /> Nhập nhạc
            </button>
            <button
              type="button"
              className="qg-step"
              onClick={() => setAiChatOpen(true)}
              title="Hỏi Gia sư AI (Bản Demo) & Ghi chú ô nhịp"
            >
              <Bot size={13} /> Hỏi Gia sư AI · Ghi chú
            </button>
          </div>
        )}
        <main className="creator-canvas">
          <div className="main-stage">
            <IdolStage
              s={s}
              controller={c}
              camera={camera}
              setCamera={setCamera}
            />
            <MusicVisualizer
              s={s}
              controller={c}
              view={view}
              setView={setView}
            />
          </div>
          <InstrumentDock s={s} controller={c} />
        </main>
      </div>
      <TelemetryBar s={s} controller={c} openModal={openModal} />
      {s.error && (
        <div className="error-toast" role="status">
          <span>{s.error}</span>
          <button
            aria-label="Đóng thông báo"
            onClick={() => c.set({ error: "" })}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {drawer && (
        <FocusTrap
          className="drawer-trap"
          label="Chọn bài học"
          onEscape={() => setDrawer(false)}
        >
          <LessonDrawer s={s} controller={c} close={() => setDrawer(false)} />
        </FocusTrap>
      )}
      {modal && (
        <StudioDialogs
          kind={modal}
          close={() => setModal(null)}
          s={s}
          controller={c}
        />
      )}
      {importerOpen && (
        <MusicImporterModal
          defaultInstrument={s.lesson?.instrument || "piano"}
          onClose={() => setImporterOpen(false)}
          onOpenInStudio={(song, inst, diff) => {
            c.registerImportedSong(song, inst, diff);
            setImporterOpen(false);
          }}
        />
      )}
      {aiChatOpen && (
        <AiTutorChatPanel
          lessonId={s.lesson?.id}
          lessonTitle={s.lesson?.title}
          instrument={s.lesson?.instrument}
          currentBar={s.from}
          maxBar={c.full?.bars?.[1] || 20}
          onClose={() => setAiChatOpen(false)}
        />
      )}
      {s.posture && (
        <PostureCard
          instrument={s.lesson?.instrument}
          onSkip={() => c.skipPosture()}
        />
      )}
      {s.rest && <RestScreen s={s} controller={c} />}
      {s.status === "countdown" && (
        <div className="countdown-overlay" aria-live="assertive">
          <div key={s.countdown} className="countdown-number">
            {s.countdown}
          </div>
          <p>Cảm nhận nhịp. Sẵn sàng nhé.</p>
          <button onClick={() => c.cancel()}>Hủy đếm vào</button>
        </div>
      )}
      {s.status === "paused" && !drawer && !modal && (
        <div className="pause-backdrop">
          <FocusTrap
            className="pause-card"
            label="Lượt luyện đang tạm dừng"
            onEscape={() => {}}
          >
            <div className="pause-icon">
              <Headphones size={28} />
            </div>
            <span className="eyebrow">PHÒNG TẬP VẪN ĐỢI BẠN</span>
            <h2>
              {s.focusGuard
                ? "Mình nghỉ một nhịp nhé."
                : "Chậm lại một chút cũng tốt."}
            </h2>
            <p>
              {s.focusGuard
                ? "Bạn vừa rời khỏi phòng tập. Vị trí bài đã được giữ lại — nhấn Space để tiếp tục nhé."
                : "Mọi thứ vẫn ở đúng chỗ. Khi sẵn sàng, mình cùng tiếp tục."}
            </p>
            <button className="primary-button" onClick={() => c.resume()}>
              <Play size={16} fill="currentColor" />
              Tiếp tục lượt <kbd>Space</kbd>
            </button>
            <button className="text-button" onClick={() => c.cancel()}>
              Kết thúc và bỏ lượt này
            </button>
          </FocusTrap>
        </div>
      )}
      {creator && (
        <div className="creator-controls">
          <span>
            <Clapperboard size={15} />
            CREATOR MODE
          </span>
          <div className="segmented">
            <button
              className={ratio === "landscape" ? "active" : ""}
              disabled={recorder.recording || recorder.preparing}
              onClick={() => setRatio("landscape")}
            >
              16:9
            </button>
            <button
              className={ratio === "portrait" ? "active" : ""}
              disabled={recorder.recording || recorder.preparing}
              onClick={() => setRatio("portrait")}
            >
              9:16
            </button>
          </div>
          <button
            className={`record-button ${recorder.recording ? "recording" : ""}`}
            onClick={recorder.recording ? recorder.stop : recorder.start}
            disabled={recorder.preparing && !recorder.recording}
            aria-label={
              recorder.recording ? "Dừng ghi và tải video" : "Bắt đầu ghi video"
            }
            title={
              recorder.supported
                ? "Chia sẻ tab này; bật âm thanh tab nếu muốn thu tiếng đàn"
                : "Cần trình duyệt hỗ trợ ghi hình màn hình"
            }
          >
            {recorder.recording ? (
              <Square size={13} fill="currentColor" />
            ) : (
              <Circle size={13} fill="currentColor" />
            )}
            {recorder.recording
              ? `Dừng · ${recorder.seconds}`
              : recorder.preparing
                ? "Đang mở tab…"
                : "Ghi video"}
          </button>
          <button
            title="Toàn màn hình"
            aria-label="Toàn màn hình"
            onClick={() =>
              document.fullscreenElement
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen().catch(() =>
                    c.set({
                      error: "Trình duyệt chưa cho mở toàn màn hình.",
                    }),
                  )
            }
          >
            <Expand size={16} />
          </button>
          <button onClick={() => setCreator(false)}>
            <X size={16} />
            Thoát <kbd>Esc</kbd>
          </button>
        </div>
      )}
      {creator && recorder.error && (
        <div className="creator-recorder-error" role="alert">
          {recorder.error}
        </div>
      )}
    </div>
  );
}
