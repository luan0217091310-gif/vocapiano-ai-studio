import {
  AudioLines,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  Library,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Square,
  Unplug,
  Zap,
} from "lucide-react";
export function IconButton({ title, children, active, ...props }) {
  return (
    <button
      className={`icon-button ${active ? "is-active" : ""}`}
      title={title}
      aria-label={title}
      {...props}
    >
      {children}
    </button>
  );
}
export default function TransportBar({
  s,
  controller: c,
  drawer,
  setDrawer,
  creator,
  setCreator,
  openModal,
}) {
  const busy = !!c.run || s.status === "starting";
  const micOn = s.micStatus === "on" || s.micStatus === "sim";
  const toggleDemo = () =>
    s.status === "paused" ? c.resume() : c.run ? c.pause() : c.start("demo");
  return (
    <header className="transport-bar">
      <div className="brand-group">
        <IconButton
          title="Thư viện bài tập"
          active={drawer}
          onClick={() => setDrawer(!drawer)}
        >
          <Library size={19} />
        </IconButton>
        <a href="/" className="wordmark">
          <AudioLines size={25} />
          <span>
            voca<span className="font-normal text-slate-400">verse</span>
            <i />
          </span>
        </a>
        <div className="header-divider" />
        <div className="studio-label">
          <span>PHÒNG LUYỆN</span>
          <strong>
            Practice Studio <ChevronDown size={12} />
          </strong>
        </div>
      </div>
      <div className="playback-cluster">
        <IconButton title="Về đầu bài" onClick={() => c.cancel()}>
          <RotateCcw size={17} />
        </IconButton>
        <button
          className={`demo-play ${c.run?.kind === "demo" ? "is-active" : ""}`}
          onClick={toggleDemo}
          aria-label={
            s.status === "paused" ? "Tiếp tục" : c.run ? "Tạm dừng" : "Xem mẫu"
          }
        >
          {c.run && s.status !== "paused" ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" />
          )}
          <span>
            {s.status === "paused"
              ? "Tiếp tục"
              : c.run
                ? "Tạm dừng"
                : "Xem mẫu"}
          </span>
        </button>
        <IconButton
          title="Kết thúc lượt"
          disabled={!c.run}
          onClick={() => c.finish()}
        >
          <Square size={15} />
        </IconButton>
        <div className="header-divider" />
        <div className="segmented mode-switch">
          <button
            className={s.mode === "learn" ? "active" : ""}
            disabled={busy}
            onClick={() => c.configure({ mode: "learn" })}
          >
            Học
          </button>
          <button
            className={s.mode === "exam" ? "active" : ""}
            disabled={busy}
            onClick={() => c.configure({ mode: "exam" })}
          >
            Kiểm tra
          </button>
        </div>
      </div>
      <div className="header-right">
        <button
          className={`hardware-pill ${s.midiStatus === "connected" ? "connected" : ""}`}
          onClick={() => openModal("devices")}
        >
          <span className="signal-dot" />
          {s.midiStatus === "connected" ? (
            <Zap size={14} />
          ) : (
            <Unplug size={14} />
          )}
          <span>
            {s.midiStatus === "connected" ? "MIDI đã nối" : "Kết nối MIDI"}
          </span>
        </button>
        <button
          className={`hardware-pill mic-pill ${micOn ? "connected" : ""} ${s.micStatus === "sim" ? "simulated" : ""}`}
          disabled={busy || s.micStatus === "requesting"}
          onClick={() => (micOn ? c.disableMic() : c.enableMic())}
          title="Xử lý cục bộ trên máy · Không ghi âm lên máy chủ"
          aria-pressed={micOn}
        >
          <span className="signal-dot" />
          {micOn ? <Mic size={14} /> : <MicOff size={14} />}
          <span className="mic-full-label">
            {s.micStatus === "requesting"
              ? "Đang xin quyền…"
              : s.micStatus === "sim"
                ? "Micro giả lập"
                : micOn
                  ? "Micro đang chấm"
                  : "Bật Micro chấm điểm"}
          </span>
          <span className="mic-short-label" aria-hidden="true">
            {micOn ? "Micro: Bật" : "Micro"}
          </span>
        </button>
        {c.run && (
          <span
            key={s.beatPulse}
            className={`beat-pulse-pill ${s.beatAccent ? "accent" : ""} ${micOn && !s.headphones ? "visual-only" : ""}`}
            title={
              micOn && !s.headphones
                ? "Đang bật Micro không tai nghe: tự tắt tiếng click, dùng nhịp nháy sáng để không nhiễu micro"
                : "Nhịp Metronome theo đồng hồ AudioContext"
            }
            aria-label="Đèn nhịp Metronome"
          >
            <i className="beat-dot" />
            <span>{micOn && !s.headphones ? "Nhịp sáng" : "Nhịp"}</span>
          </span>
        )}
        <button className="creator-button" onClick={() => setCreator(!creator)}>
          <Clapperboard size={16} />
          <span>Studio View</span>
        </button>
        <IconButton
          title="Hướng dẫn & phím tắt"
          onClick={() => openModal("help")}
        >
          <CircleHelp size={18} />
        </IconButton>
        <span className="profile-avatar">B</span>
      </div>
    </header>
  );
}
