import {
  CirclePause,
  Keyboard,
  Piano,
  Play,
  Volume2,
  VolumeX,
  Wind,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { noteName } from "../../model.mjs";
import { useAnimation } from "../studio/useStudio.js";
const shortcuts = "awsedftgyhujk";
export function DynamicsPicker({ s, controller: c }) {
  return (
    <div
      className="dynamics-picker segmented"
      aria-label="Sắc thái bàn phím ảo"
    >
      {[
        [54, "p", "nhẹ"],
        [80, "mf", "vừa"],
        [104, "f", "mạnh"],
      ].map(([value, label, title]) => (
        <button
          key={value}
          aria-label={`Lực nhấn ${title} ${label}`}
          className={s.velocity === value ? "active" : ""}
          onClick={() => c.set({ velocity: value })}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
function PianoKeyboard({ s, controller: c }) {
  const current = useRef(),
    keyboard = useRef();
  useAnimation(() => {
    if (current.current) {
      const note = c.activeNote();
      current.current.textContent = note
        ? `${noteName(note.note.pitch)} · ${s.mode === "exam" ? "Tự đọc nốt" : `ngón ${note.note.technique?.finger ?? "—"}`}`
        : "Đô4";
    }
  });
  let white = 0;
  const positions = [];
  for (let pitch = 48; pitch <= 84; pitch++) {
    const black = [1, 3, 6, 8, 10].includes(pitch % 12);
    positions.push({ pitch, black, x: black ? white - 0.31 : white });
    if (!black) white++;
  }
  useEffect(() => {
    const keys = keyboard.current,
      viewport = keys.parentElement;
    const position = () => {
      if (keys.clientWidth <= viewport.clientWidth) {
        viewport.scrollLeft = 0;
        return;
      }
      const target = positions.find(
        (p) => p.pitch === (c.clip?.notes[0]?.pitch ?? 60),
      );
      viewport.scrollLeft = Math.max(
        0,
        (((target?.x ?? 7) + 0.5) / white) * keys.clientWidth -
          viewport.clientWidth / 2,
      );
    };
    const observer = new ResizeObserver(position);
    observer.observe(viewport);
    position();
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đo lại vị trí phím khi đổi bài
  }, [s.lesson]);
  const next = c.activeNote(),
    fingers = {};
  if (s.mode !== "exam")
    for (const e of c.index?.expected ?? [])
      if (next && e.onMs === next.onMs && e.note.technique?.finger)
        fingers[e.note.pitch] = e.note.technique.finger;
  return (
    <>
      <div className="keyboard-wrapper">
        <div className="piano-keys" ref={keyboard}>
          {positions.map((pos) => {
            const velocity = s.active[pos.pitch],
              hand = c.clip?.notes.find((n) => n.pitch === pos.pitch)?.technique
                ?.hand;
            return (
              <button
                key={pos.pitch}
                data-pitch={pos.pitch}
                aria-label={noteName(pos.pitch)}
                className={`piano-key ${pos.black ? "black" : "white"} ${velocity ? "pressed" : ""} ${hand === "L" ? "left-hand" : ""}`}
                style={{
                  left: `${(pos.x / white) * 100}%`,
                  width: `${((pos.black ? 0.62 : 1) / white) * 100}%`,
                  "--velocity": (velocity ?? 0) / 127,
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  c.press(`pointer${e.pointerId}`, pos.pitch);
                }}
                onPointerUp={(e) => c.release(`pointer${e.pointerId}`)}
                onPointerCancel={(e) => c.release(`pointer${e.pointerId}`)}
                onLostPointerCapture={(e) => c.release(`pointer${e.pointerId}`)}
              >
                {fingers[pos.pitch] && (
                  <span className="finger-label">{fingers[pos.pitch]}</span>
                )}
                <span className="key-label">
                  {!pos.black && noteName(pos.pitch)}
                  <kbd>{shortcuts[pos.pitch - 60]?.toUpperCase() ?? ""}</kbd>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="instrument-caption">
        <span>
          <Keyboard size={12} />A W S E D F T G Y H U J K · Đô4–Đô5
        </span>
        <span ref={current} className="mono text-cyan" />
        <span>Phím sáng = cao độ · số trên phím = ngón gợi ý</span>
      </div>
    </>
  );
}
// Thang âm cơ bản sáo trúc C5 (nhãn tiếng Việt) và hướng dẫn luồng hơi theo quãng.
const FLUTE_SCALE = [72, 74, 76, 77, 79, 81, 83, 84, 86, 88];
const breathOf = (pitch, octave) =>
  (octave ?? (pitch >= 84 ? 2 : 1)) >= 2
    ? {
        level: "octave",
        label: "Quãng 8",
        tip: "Hơi nhanh hơn, khe môi hẹp lại, không thổi mạnh hơn quá mức",
      }
    : pitch <= 76
      ? {
          level: "soft",
          label: "Hơi nhẹ",
          tip: "Thổi nhẹ và chậm, âm trầm cần hơi ấm",
        }
      : { level: "medium", label: "Hơi vừa", tip: "Hơi đều, giữ luồng thẳng" };
function FluteInstrument({ s, controller: c }) {
  const circles = useRef([]),
    note = useRef(),
    breath = useRef(),
    breathTip = useRef(),
    chips = useRef({});
  useAnimation(() => {
    const current = c.activeNote(),
      pitch = current?.note.pitch;
    const entry = c.chart?.entries?.[String(pitch)]?.fingerings?.[0];
    const pattern = current?.note.technique?.fingering ?? entry?.holes;
    if (note.current)
      note.current.textContent = pitch === undefined ? "—" : noteName(pitch);
    if (breath.current && pitch !== undefined) {
      const b = breathOf(pitch, entry?.octave);
      breath.current.dataset.level = b.level;
      breath.current.textContent = b.label;
      if (breathTip.current) breathTip.current.textContent = b.tip;
    }
    for (const [p, el] of Object.entries(chips.current))
      if (el) el.dataset.current = String(Number(p) === pitch);
    circles.current.forEach((el, i) => {
      if (el) {
        el.dataset.state =
          pattern?.[i] === "●"
            ? "closed"
            : pattern?.[i] === "◐"
              ? "half"
              : "open";
        el.setAttribute(
          "aria-label",
          `Lỗ ${i + 1}: ${pattern?.[i] === "●" ? "bịt" : pattern?.[i] === "◐" ? "nửa lỗ" : "mở"}`,
        );
      }
    });
  });
  const used = new Set(c.clip?.notes.map((n) => n.pitch) ?? []);
  const hint = s.pitchHint;
  return (
    <div className="flute-instrument">
      <div className="flute-main">
        <div className="flute-body">
          <span className="flute-binding" />
          <div className="blow-hole" title="Lỗ thổi" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flute-hole-wrap">
              <div
                className="flute-hole"
                ref={(el) => (circles.current[i] = el)}
              />
              <span>{i + 1}</span>
            </div>
          ))}
          <span className="flute-binding end" />
        </div>
        <div className="flute-now">
          <span ref={note} className="flute-now-note" />
          <span ref={breath} className="breath-badge" data-level="soft">
            Hơi nhẹ
          </span>
          <small ref={breathTip} />
        </div>
      </div>
      <div className="flute-scale" aria-label="Thang âm sáo C5">
        {FLUTE_SCALE.map((p) => (
          <button
            key={p}
            ref={(el) => (chips.current[p] = el)}
            className={`flute-chip ${used.has(p) ? "used" : ""} ${s.active[p] ? "pressed" : ""} ${hint && hint.pitch === p && hint.diff ? "wrong" : ""}`}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              c.press(`pointer${e.pointerId}`, p);
            }}
            onPointerUp={(e) => c.release(`pointer${e.pointerId}`)}
            onPointerCancel={(e) => c.release(`pointer${e.pointerId}`)}
            onLostPointerCapture={(e) => c.release(`pointer${e.pointerId}`)}
            title={c.chart?.entries?.[String(p)]?.fingerings?.[0]?.holes}
          >
            {noteName(p)}
          </button>
        ))}
      </div>
      <div className="flute-caption">
        <span>● Bịt &nbsp; ○ Mở &nbsp; ◐ Nửa lỗ · lỗ 1 gần miệng thổi</span>
        <span>
          {s.micStatus === "on" || s.micStatus === "sim"
            ? "Micro đang nghe · chấm cao độ theo bản nhạc"
            : "Bật micro để chấm điểm · hoặc chạm nốt / phím A–K"}
        </span>
        <span>Bảng C5 v0 · chờ chuyên gia duyệt</span>
      </div>
    </div>
  );
}
export default function InstrumentDock({ s, controller: c }) {
  const flute = s.lesson?.instrument === "sao_truc";
  const active = !!c.run;
  return (
    <section className="instrument-dock panel" aria-label="Nhạc cụ ảo">
      <div className="dock-toolbar">
        <div className="flex items-center gap-3">
          <span className="instrument-icon">
            {flute ? <Wind size={17} /> : <Piano size={17} />}
          </span>
          <div className="dock-title">
            <h2>{flute ? "Sáo trúc C5" : "Bàn phím tương tác"}</h2>
            <span>{flute ? "6 lỗ · thế bấm theo bản nhạc" : "Đô3 — Đô6"}</span>
          </div>
          <span className="subtle-badge input-type">
            {s.micStatus === "on"
              ? "MICRO"
              : s.micStatus === "sim"
                ? "MICRO GIẢ LẬP"
                : c.port
                  ? "USB MIDI"
                  : "BÀN PHÍM MÀN HÌNH"}
          </span>
        </div>
        <div className="dock-actions">
          <DynamicsPicker s={s} controller={c} />
          <label className="practice-mode">
            <select
              aria-label="Chế độ luyện"
              disabled={active}
              value={s.practice}
              onChange={(e) => c.configure({ practice: e.target.value })}
            >
              <option value="realtime">Theo nhịp · Real-time</option>
              <option value="wait">Chờ đúng nốt · Wait</option>
            </select>
          </label>
          <button
            className="icon-button sound-toggle"
            title="Bật hoặc tắt âm"
            aria-label="Bật hoặc tắt âm"
            onClick={() => {
              c.set({ volume: !s.volume });
              if (s.volume) c.silence();
            }}
          >
            {s.volume ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button
            className="practice-cta"
            disabled={s.loading || s.status === "starting"}
            onClick={() =>
              active
                ? s.status === "paused"
                  ? c.resume()
                  : c.pause()
                : c.start("practice")
            }
          >
            {active && s.status !== "paused" ? (
              <CirclePause size={17} />
            ) : (
              <Play size={15} fill="currentColor" />
            )}
            <span>
              {active
                ? s.status === "paused"
                  ? "Tiếp tục lượt"
                  : "Tạm dừng"
                : flute
                  ? "Bắt đầu thổi"
                  : "Bắt đầu luyện tập"}
            </span>
            {!active && <kbd>Space</kbd>}
          </button>
        </div>
      </div>
      {flute ? (
        <FluteInstrument s={s} controller={c} />
      ) : (
        <PianoKeyboard s={s} controller={c} />
      )}
    </section>
  );
}
