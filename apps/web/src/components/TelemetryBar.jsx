import { Activity, Bug, History, Settings2, ShieldCheck } from "lucide-react";
import { useRef } from "react";
import { useAnimation } from "../studio/useStudio.js";
import { noteName } from "../../model.mjs";
/** Tuner −50 ← 0 → +50 cent, mức âm phòng và hiệu chuẩn ồn (micro xử lý cục bộ). */
export function MicTuner({ s, controller: c }) {
  const p = s.micPitch,
    cents = p ? Math.max(-50, Math.min(50, p.cents)) : 0,
    inTune = p && Math.abs(p.cents) <= 10;
  return (
    <div className="mic-tuner" aria-label="Tuner micro">
      <span className="tuner-note mono">{p ? noteName(p.midi) : "—"}</span>
      <div
        className={`tuner-scale ${p ? (inTune ? "in-tune" : "off-tune") : "idle"}`}
        role="meter"
        aria-valuemin={-50}
        aria-valuemax={50}
        aria-valuenow={cents}
        aria-label="Độ lệch cao độ (cent)"
      >
        <span className="tick l">−50</span>
        <span className="tick c">0</span>
        <span className="tick r">+50</span>
        <i style={{ left: `${50 + cents}%` }} />
      </div>
      <span className="tuner-cents mono">
        {p ? `${p.cents > 0 ? "+" : ""}${p.cents}¢` : "··"}
      </span>
      <div className="mic-level" title="Mức âm lượng phòng">
        <i style={{ width: `${Math.round(s.micLevel * 100)}%` }} />
      </div>
      <button
        className="calibrate-button"
        disabled={s.calibrating || !!c.run || s.micStatus !== "on"}
        onClick={() => c.calibrateMic()}
      >
        {s.calibrating ? "Đang đo ồn…" : "Hiệu chuẩn ồn phòng (1 giây)"}
      </button>
      <span className="mic-privacy">
        <ShieldCheck size={12} />
        Xử lý cục bộ trên máy · Không ghi âm lên máy chủ
      </span>
    </div>
  );
}
export default function TelemetryBar({ s, controller: c, openModal }) {
  const micOn = s.micStatus === "on" || s.micStatus === "sim";
  const bar = useRef(),
    time = useRef();
  useAnimation(() => {
    if (bar.current)
      bar.current.textContent = `${String(Math.min(s.to, c.currentBar())).padStart(2, "0")} / ${String(s.to).padStart(2, "0")}`;
    if (time.current) {
      const sec = Math.floor(c.progress() / 1000);
      time.current.textContent = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
    }
  });
  return (
    <footer className="telemetry-bar">
      <div className="telemetry-left">
        <span className="status-label">
          <span
            className={`signal-dot ${s.status === "playing" ? "green" : ""}`}
          />
          {
            {
              ready: "Sẵn sàng",
              starting: "Chuẩn bị",
              countdown: "Đếm vào",
              playing: s.waiting ? "Chờ đúng nốt" : "Đang chơi",
              paused: "Tạm dừng",
              finished: "Đã xong lượt",
            }[s.status]
          }
        </span>
        <span className="mono" ref={time}>
          00:00
        </span>
        <span className="telemetry-bar-number">
          Ô{" "}
          <b ref={bar} className="mono">
            01 / 08
          </b>
        </span>
        <span className="audio-latency">
          <Activity size={12} />
          {c.audio
            ? `Audio ≈ ${Math.round((c.audio.baseLatency ?? 0) * 1000)} ms`
            : "Audio chờ bật"}
        </span>
      </div>
      {micOn ? (
        <MicTuner s={s} controller={c} />
      ) : (
        <div className="telemetry-middle">
          <ShieldCheck size={12} />
          <span>Riêng tư trên thiết bị · bản thử nghiệm</span>
        </div>
      )}
      <div className="telemetry-actions">
        <button onClick={() => openModal("demo")}>
          <Bug size={13} />
          <span>Mô phỏng</span>
        </button>
        <button onClick={() => openModal("history")}>
          <History size={13} />
          <span>Nhật ký</span>
        </button>
        <button
          onClick={() => openModal("settings")}
          aria-label="Cài đặt âm thanh"
        >
          <Settings2 size={14} />
        </button>
      </div>
    </footer>
  );
}
