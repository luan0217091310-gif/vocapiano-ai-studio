// Trang chủ chuyển đổi: hero giá trị cốt lõi + cửa sổ Phòng luyện tương tác trực tiếp
// → 4 chỉ số KPI → Chuỗi hành trình 4 chặng liên kết → Bento 2×2 cho Người học & Người mua
// → nhạc cụ → cách học → bảng so sánh → lộ trình 12 bài mở đầu → quyền riêng tư P1 → FAQ → CTA.
// Lời văn tuân D-01 (không từ tuyệt đối hoá) và D-30 (không bảng xếp hạng trên trang chủ).
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Bot,
  Building2,
  Check,
  CirclePlay,
  Gamepad2,
  Layers,
  Lock,
  Mic,
  Minus,
  Music2,
  Piano,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  Volume2,
  Wind,
  X,
} from "lucide-react";
import { t } from "../i18n/index.js";
import { useScrollReveal } from "../ui/motion.js";
import MusicSkillTree from "../components/MusicSkillTree.jsx";
import { PageShell } from "./Shared.jsx";

const TRY = "/studio?try=1&lesson=PN01";
const FREE_IN_PATH = 4;

const SONG_SECTIONS = [
  { id: "intro", label: "Intro (1–4)", barHint: "Mở đầu nhịp 4/4 nhẹ nhàng" },
  { id: "verse", label: "Verse (5–8)", barHint: "Câu hát chính tay phải" },
  {
    id: "chorus",
    label: "Chorus (9–12)",
    barHint: "Điệp khúc cao trào, giữ phách chắc",
  },
  { id: "bridge", label: "Bridge (13–16)", barHint: "Chuyển đoạn đảo nhịp" },
  {
    id: "outro",
    label: "Outro (17–20)",
    barHint: "Kết bài chậm dần gọn tiếng",
  },
];

const HERO_PREVIEW_NOTES = {
  piano: [
    {
      id: "C4",
      label: "Đô4",
      short: "Đô",
      midi: 60,
      finger: "Ngón 1",
      top: 66,
      h: 40,
      color: "linear-gradient(180deg, #06b6d4, #0284c7)",
    },
    {
      id: "D4",
      label: "Rê4",
      short: "Rê",
      midi: 62,
      finger: "Ngón 2",
      top: 46,
      h: 38,
      color: "linear-gradient(180deg, #14b8a6, #0d9488)",
    },
    {
      id: "E4",
      label: "Mi4",
      short: "Mi",
      midi: 64,
      finger: "Ngón 3",
      top: 26,
      h: 44,
      color: "linear-gradient(180deg, #10b981, #059669)",
    },
    {
      id: "F4",
      label: "Fa4",
      short: "Fa",
      midi: 65,
      finger: "Ngón 4",
      top: 56,
      h: 36,
      color: "linear-gradient(180deg, #38bdf8, #0284c7)",
    },
    {
      id: "G4",
      label: "Sol4",
      short: "Sol",
      midi: 67,
      finger: "Ngón 5",
      top: 18,
      h: 46,
      color: "linear-gradient(180deg, #f59e0b, #d97706)",
    },
    {
      id: "A4",
      label: "La4",
      short: "La",
      midi: 69,
      finger: "Ngón 4",
      top: 42,
      h: 38,
      color: "linear-gradient(180deg, #a78bfa, #7c3aed)",
    },
    {
      id: "B4",
      label: "Si4",
      short: "Si",
      midi: 71,
      finger: "Ngón 5",
      top: 30,
      h: 40,
      color: "linear-gradient(180deg, #34d399, #059669)",
    },
  ],
  sao_truc: [
    {
      id: "C5",
      label: "Đô5",
      short: "Đô5",
      midi: 72,
      finger: "●●●●●●",
      top: 66,
      h: 40,
      color: "linear-gradient(180deg, #10b981, #047857)",
    },
    {
      id: "D5",
      label: "Rê5",
      short: "Rê5",
      midi: 74,
      finger: "●●●●●○",
      top: 48,
      h: 38,
      color: "linear-gradient(180deg, #14b8a6, #0f766e)",
    },
    {
      id: "E5",
      label: "Mi5",
      short: "Mi5",
      midi: 76,
      finger: "●●●●○○",
      top: 26,
      h: 44,
      color: "linear-gradient(180deg, #06b6d4, #0369a1)",
    },
    {
      id: "F5",
      label: "Fa5",
      short: "Fa5",
      midi: 77,
      finger: "●●●○○○",
      top: 56,
      h: 36,
      color: "linear-gradient(180deg, #38bdf8, #0284c7)",
    },
    {
      id: "G5",
      label: "Sol5",
      short: "Sol5",
      midi: 79,
      finger: "●●○○○○",
      top: 18,
      h: 46,
      color: "linear-gradient(180deg, #f59e0b, #b45309)",
    },
    {
      id: "A5",
      label: "La5",
      short: "La5",
      midi: 81,
      finger: "●○○○○○",
      top: 42,
      h: 38,
      color: "linear-gradient(180deg, #34d399, #059669)",
    },
    {
      id: "B5",
      label: "Si5",
      short: "Si5",
      midi: 83,
      finger: "○○○○○○",
      top: 28,
      h: 40,
      color: "linear-gradient(180deg, #a78bfa, #6d28d9)",
    },
  ],
};

function playPreviewNote(ctxRef, midi, inst = "piano", dur = 0.36) {
  try {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctxRef.current = new AC();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    osc.type = inst === "sao_truc" ? "sine" : "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  } catch {
    /* headless safe */
  }
}

/** Ô bảng so sánh: "yes" / "no" / "mid" vẽ biểu tượng kèm chữ. */
function Cell({ tone, children }) {
  const Icon = tone === "yes" ? Check : tone === "no" ? X : Minus;
  return (
    <td className={`gx-cmp-${tone}`}>
      <Icon size={15} aria-hidden="true" /> {children}
    </td>
  );
}

export default function LandingPage() {
  useScrollReveal();
  const [previewInst, setPreviewInst] = useState("piano");
  const [activeNoteIdx, setActiveNoteIdx] = useState(2);
  const [activeSectionId, setActiveSectionId] = useState("chorus");
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const audioRef = useRef(null);
  const timersRef = useRef([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const notes = HERO_PREVIEW_NOTES[previewInst];
  const activeNote = notes[activeNoteIdx] || notes[0];
  const activeSection =
    SONG_SECTIONS.find((s) => s.id === activeSectionId) || SONG_SECTIONS[2];
  const isFlute = previewInst === "sao_truc";

  function clearDemoTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  function triggerDemoPhrase(inst = previewInst) {
    clearDemoTimers();
    const list = HERO_PREVIEW_NOTES[inst];
    const seq = [0, 2, 4, 5, 4, 2, 0];
    setIsPlayingDemo(true);
    seq.forEach((idx, step) => {
      const id = setTimeout(() => {
        setActiveNoteIdx(idx);
        playPreviewNote(audioRef, list[idx].midi, inst, 0.28);
        if (step === seq.length - 1) setIsPlayingDemo(false);
      }, step * 220);
      timersRef.current.push(id);
    });
  }

  const rows = [1, 2, 3, 4, 5];
  const tones = {
    yt: ["no", "yes", "yes", "no", "no"],
    vv: ["yes", "yes", "yes", "yes", "mid"],
    tu: ["yes", "mid", "no", "yes", "yes"],
  };
  return (
    <PageShell>
      <main className="landing-page gx-landing vv-page-enter">
        <section className="gx-hero hero-section">
          <div className="gx-hero-copy">
            <span className="gx-kicker">
              <span className="status-pip" /> {t("lp.kicker")}
            </span>
            <h1>
              {t("lp.h1a")}
              <br />
              <em>{t("lp.h1b")}</em>
            </h1>
            <p className="gx-lede">{t("lp.lede")}</p>
            <div className="gx-hero-actions">
              <a className="button button-primary gx-cta-big" href={TRY}>
                {t("lp.ctaTry")} <ArrowRight size={18} />
              </a>
              <a
                className="button button-quiet"
                href="/studio?try=1&lesson=TS01&inst=piano&diff=medium"
              >
                <CirclePlay size={17} /> Chơi thử trọn bài 20 ô
              </a>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 18px",
                alignItems: "center",
                marginTop: 14,
              }}
            >
              <a className="text-link text-link-accent" href="/library">
                Kho 284+ bài &amp; Nhập nhạc AI <ArrowRight size={14} />
              </a>
              <a className="text-link" href="/pricing">
                Xem Bảng giá Cá nhân &amp; B2B <ArrowRight size={14} />
              </a>
            </div>
            <small className="gx-cta-note">{t("lp.ctaTryNote")}</small>
            <ul className="gx-trust">
              <li>
                <Music2 size={15} /> 22 bài nhập môn &amp; 36 bài hát 20 ô
              </li>
              <li>
                <ShieldCheck size={15} /> {t("lp.trust2")}
              </li>
              <li>
                <RotateCcw size={15} /> {t("lp.trust3")}
              </li>
            </ul>
          </div>

          <div className="gx-hero-visual">
            <div
              className="vv-hero-studio-card"
              aria-label="Mô phỏng trực quan Phòng luyện VocaVerse"
            >
              <div className="vv-hero-studio-topbar">
                <div className="vv-hero-window-dots" aria-hidden="true">
                  <span className="dot-r" />
                  <span className="dot-y" />
                  <span className="dot-g" />
                  <strong
                    style={{
                      marginLeft: 6,
                      fontSize: 11.5,
                      color: "#e2e8f0",
                      letterSpacing: "0.05em",
                    }}
                  >
                    PRACTICE STUDIO · XEM THỬ TRỰC QUAN
                  </strong>
                </div>
                <div
                  className="vv-hero-inst-switch"
                  role="group"
                  aria-label="Chọn nhạc cụ xem thử"
                >
                  <button
                    type="button"
                    className={!isFlute ? "active" : ""}
                    onClick={() => {
                      clearDemoTimers();
                      setIsPlayingDemo(false);
                      setPreviewInst("piano");
                      setActiveNoteIdx(2);
                      playPreviewNote(audioRef, 64, "piano", 0.35);
                    }}
                  >
                    🎹 Piano (Minh An)
                  </button>
                  <button
                    type="button"
                    className={isFlute ? "active" : ""}
                    onClick={() => {
                      clearDemoTimers();
                      setIsPlayingDemo(false);
                      setPreviewInst("sao_truc");
                      setActiveNoteIdx(4);
                      playPreviewNote(audioRef, 79, "sao_truc", 0.35);
                    }}
                  >
                    🪈 Sáo C5 (Gia Phong)
                  </button>
                </div>
              </div>

              <div className="vv-hero-studio-body">
                <div className="vv-hero-tutor-row">
                  <div className="vv-hero-tutor-avatar">
                    {isFlute ? "GP" : "MA"}
                  </div>
                  <div className="vv-hero-tutor-text">
                    <strong>
                      {isFlute
                        ? "Gia Phong (Sáo C5) · TS26 Để Mị Nói Cho Mà Nghe (92 BPM)"
                        : "Minh An (Piano) · TS01 Nơi Này Có Anh (74 BPM · Acoustic)"}
                    </strong>
                    <small>
                      {activeSection.label}: {activeSection.barHint} ·{" "}
                      {isFlute
                        ? `Thế bấm ${activeNote.label}: ${activeNote.finger}`
                        : `Phím ${activeNote.label} (${activeNote.finger})`}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="button button-primary"
                    style={{
                      flexShrink: 0,
                      padding: "7px 12px",
                      fontSize: 12,
                      minHeight: 36,
                    }}
                    onClick={() => triggerDemoPhrase(previewInst)}
                  >
                    <Volume2 size={14} />{" "}
                    {isPlayingDemo ? "Đang phát…" : "Nghe câu mẫu"}
                  </button>
                </div>

                {/* 5 đoạn cấu trúc tương tác */}
                <div className="vv-hero-sec-row">
                  <div
                    className="vv-hero-sec-pills"
                    role="group"
                    aria-label="5 đoạn cấu trúc bài hát"
                  >
                    {SONG_SECTIONS.map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        className={`vv-hero-sec-pill ${activeSectionId === sec.id ? "active" : ""}`}
                        onClick={() => setActiveSectionId(sec.id)}
                      >
                        {sec.label}
                      </button>
                    ))}
                  </div>
                  <span style={{ color: "#6ee7b7", fontWeight: 700 }}>
                    ⚡ 25%–150% · 3 Độ khó
                  </span>
                </div>

                {/* Sân khấu Thác nốt rơi (Waterfall) 7 làn */}
                <div className="vv-hero-waterfall-mock">
                  {notes.map((n, idx) => {
                    const selected = idx === activeNoteIdx;
                    return (
                      <div key={n.id} className="vv-hero-wf-lane">
                        <div
                          className={`vv-hero-wf-bar ${selected ? "is-lit" : ""}`}
                          style={{
                            top: selected ? n.top + 8 : n.top,
                            height: n.h,
                            background: n.color,
                          }}
                          onClick={() => {
                            setActiveNoteIdx(idx);
                            playPreviewNote(audioRef, n.midi, previewInst, 0.4);
                          }}
                        >
                          <span>{n.short}</span>
                          <small>{n.finger}</small>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Hàng phím đàn Piano (phím đen 3D) / Ống Sáo trúc 6 lỗ trực quan + Nút bấm thử nghe trực tiếp */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 12,
                      color: "#cbd5e1",
                      marginBottom: 8,
                      gap: 8,
                    }}
                  >
                    <span>
                      👆 Chạm vào{" "}
                      <strong>
                        {isFlute ? "nốt Sáo trúc C5" : "phím đàn"}
                      </strong>{" "}
                      để nghe tiếng &amp; xem ngón:
                    </span>
                    <span style={{ color: "#38bdf8", fontWeight: 750 }}>
                      {activeNote.label} · {activeNote.finger}
                    </span>
                  </div>
                  {isFlute ? (
                    <div
                      className="vv-hero-flute-tube"
                      aria-label={`Minh hoạ 6 lỗ sáo cho nốt ${activeNote.label}`}
                    >
                      <span className="vv-flute-tube-label">
                        Sáo C5 · {activeNote.label}
                      </span>
                      <div className="vv-flute-tube-holes">
                        <span className="vv-flute-embouchure" title="Lỗ thổi" />
                        {[...activeNote.finger].map((ch, hIdx) => {
                          const closed = ch === "●";
                          return (
                            <span
                              key={hIdx}
                              className={`vv-flute-hole-dot ${closed ? "closed" : "open"}`}
                              title={`Lỗ ${hIdx + 1}: ${closed ? "Bịt" : "Mở"}`}
                            >
                              {hIdx + 1}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="vv-hero-black-keys" aria-hidden="true">
                      <span className="bk bk-1" />
                      <span className="bk bk-2" />
                      <span className="bk bk-3" />
                      <span className="bk bk-4" />
                      <span className="bk bk-5" />
                    </div>
                  )}
                  <div className="vv-hero-keys-row">
                    {notes.map((n, idx) => (
                      <button
                        key={n.id}
                        type="button"
                        className={`vv-hero-key-pill ${isFlute ? "is-flute" : ""} ${idx === activeNoteIdx ? "is-lit" : ""}`}
                        onClick={() => {
                          clearDemoTimers();
                          setIsPlayingDemo(false);
                          setActiveNoteIdx(idx);
                          playPreviewNote(audioRef, n.midi, previewInst, 0.42);
                        }}
                      >
                        <span>{n.short}</span>
                        <small>{n.finger}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                    paddingTop: 10,
                    borderTop: "1px solid rgba(148, 163, 184, 0.2)",
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ color: "#6ee7b7", fontWeight: 700 }}>
                    ✓ Chấm cao độ Micro YIN &amp; MIDI tại máy (&lt; 15ms)
                  </span>
                  <a
                    href={
                      isFlute
                        ? "/studio?try=1&lesson=TS26&inst=sao_truc&diff=medium"
                        : "/studio?try=1&lesson=TS01&inst=piano&diff=medium"
                    }
                    style={{
                      color: "#67e8f9",
                      fontWeight: 800,
                      textDecoration: "none",
                    }}
                  >
                    Mở {isFlute ? "TS26 (Sáo C5)" : "TS01 (Piano)"} trong Phòng
                    luyện →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Dải 4 chỉ số KPI rõ ràng, tách bạch cấu trúc bài học */}
        <section
          className="vv-hero-kpi-strip"
          data-reveal=""
          aria-label="Chỉ số tổng quan hệ thống VocaVerse"
        >
          <article className="vv-hero-kpi-card">
            <span className="vv-kpi-tag">KHO HỌC LIỆU PHÂN TẦNG</span>
            <strong>284+ Bài học &amp; Bản phối</strong>
            <p>
              22 bài cốt lõi có Tay mẫu 3D, 36 ca khúc trọn bài 20 ô (3 độ khó),
              16 tác phẩm PD và 210 bài tập kỹ thuật.
            </p>
          </article>
          <article className="vv-hero-kpi-card">
            <span className="vv-kpi-tag">CHẤM ĐIỂM TẠI THIẾT BỊ</span>
            <strong>&lt; 15 ms Độ trễ DSP</strong>
            <p>
              Nhận diện cao độ YIN &amp; đối chiếu nhịp DTW qua Micro hoặc
              USB-MIDI. Âm thanh xử lý cục bộ, bảo mật P1.
            </p>
          </article>
          <article className="vv-hero-kpi-card">
            <span className="vv-kpi-tag">CHUYỂN NHẠC AI TỰ ĐỘNG</span>
            <strong>±0.21 BPM Sai số nhịp</strong>
            <p>
              Nhập Link hoặc tệp MP3/WAV/MIDI/MusicXML để tự động tách nhịp, hợp
              âm và gán thế ngón Đàn &amp; Sáo.
            </p>
          </article>
          <article className="vv-hero-kpi-card">
            <span className="vv-kpi-tag">CHI PHÍ &amp; BẢO ĐẢM</span>
            <strong>49k – 149k · Hoàn tiền 7 ngày</strong>
            <p>
              Học thử miễn phí 8 bài đầu không cần thẻ. Có gói cá nhân linh hoạt
              và gói Phòng đàn B2B cho trường nhạc.
            </p>
          </article>
        </section>

        {/* Chuỗi hành trình 4 chặng liên kết toàn web */}
        <section
          className="gx-section"
          data-reveal=""
          aria-label="Chuỗi hành trình học tập 4 chặng liên kết"
        >
          <header className="gx-head">
            <span className="gx-kicker">
              QUY TRÌNH HỌC LIÊN KẾT 4 CHẶNG · TỪ BẢN NHẠC ĐẾN THỰC HÀNH
            </span>
            <h2>Bốn khu vực liên kết chặt chẽ thành một vòng lặp tiến bộ</h2>
          </header>
          <div className="vv-flow-strip">
            <a className="vv-flow-step" href="/library">
              <div className="vv-flow-step-top">
                <span className="vv-flow-num">CHẶNG 01</span>
                <Upload size={18} color="#1f6f68" />
              </div>
              <div>
                <strong>
                  Chọn bài trong Thư viện 284+ hoặc Nhập Link/File
                </strong>
                <p>
                  Lọc bài cốt lõi, chọn 1 trong 36 ca khúc 20 ô nhịp theo chủ đề
                  hoặc tự nhập MP3/MIDI thành bản nhạc riêng.
                </p>
              </div>
              <span className="vv-flow-link">
                Mở Thư viện &amp; Nhập nhạc AI <ArrowRight size={14} />
              </span>
            </a>

            <a
              className="vv-flow-step"
              href="/studio?try=1&lesson=TS01&inst=piano&diff=medium"
            >
              <div className="vv-flow-step-top">
                <span className="vv-flow-num">CHẶNG 02</span>
                <Piano size={18} color="#1f6f68" />
              </div>
              <div>
                <strong>Luyện trong Practice Studio &amp; Tay mẫu 3D</strong>
                <p>
                  Tập theo Thác nốt rơi hoặc Khuông nhạc đôi, tua 25%–150%, lặp
                  từng đoạn Intro → Outro và chấm qua Micro/MIDI.
                </p>
              </div>
              <span className="vv-flow-link">
                Vào Phòng luyện ngay <ArrowRight size={14} />
              </span>
            </a>

            <a className="vv-flow-step" href="/games">
              <div className="vv-flow-step-top">
                <span className="vv-flow-num">CHẶNG 03</span>
                <Gamepad2 size={18} color="#1f6f68" />
              </div>
              <div>
                <strong>Củng cố phản xạ qua 6 Trò chơi Học thuật</strong>
                <p>
                  Rèn tai nghe Solfège, đọc nhanh khoá Sol, gõ nhịp 4/4, thế bấm
                  Sáo 6 lỗ và mở Rương XP tích luỹ kỹ năng.
                </p>
              </div>
              <span className="vv-flow-link">
                Chơi 6 Trò chơi Nhạc lý <ArrowRight size={14} />
              </span>
            </a>

            <a className="vv-flow-step" href="/community">
              <div className="vv-flow-step-top">
                <span className="vv-flow-num">CHẶNG 04</span>
                <Bot size={18} color="#1f6f68" />
              </div>
              <div>
                <strong>Ghi chú Ô nhịp, Hỏi Gia sư AI &amp; Cộng đồng</strong>
                <p>
                  Gắn ghi chú kỹ thuật ngay trên từng ô nhịp khó, hỏi đáp 24 thẻ
                  sư phạm (<code>kb://</code>) và tham gia chuyên đề tuần.
                </p>
              </div>
              <span className="vv-flow-link">
                Mở Sổ tay &amp; Cộng đồng <ArrowRight size={14} />
              </span>
            </a>
          </div>
        </section>

        <section
          className="gx-instruments"
          style={{ marginTop: 48 }}
          data-reveal=""
          aria-label={t("lp.instruments")}
        >
          <a href="/library" className="gx-inst">
            <Piano size={22} />
            <div>
              <strong>{t("lp.piano")}</strong>
              <small>{t("lp.pianoSub")}</small>
            </div>
          </a>
          <a href="/library" className="gx-inst">
            <Wind size={22} />
            <div>
              <strong>{t("lp.flute")}</strong>
              <small>{t("lp.fluteSub")}</small>
            </div>
          </a>
          <div className="gx-inst soon">
            <Music2 size={22} />
            <div>
              <strong>{t("lp.guitar")}</strong>
              <small>{t("lp.soon")}</small>
            </div>
          </div>
          <div className="gx-inst soon">
            <AudioLines size={22} />
            <div>
              <strong>{t("lp.voice")}</strong>
              <small>{t("lp.soon")}</small>
            </div>
          </div>
        </section>

        {/* Bento 2×2 sạch sẽ, cân xứng cho Người học & Người mua dịch vụ */}
        <section
          className="gx-section"
          data-reveal=""
          aria-label="Tổng quan giải pháp cho người học và người mua dịch vụ"
        >
          <header className="gx-head">
            <span className="gx-kicker">
              BỨC TRANH TỔNG QUAN · DÀNH CHO NGƯỜI HỌC, PHỤ HUYNH &amp; TRƯỜNG
              NHẠC
            </span>
            <h2>
              Đầy đủ tính năng cốt lõi trong một hệ sinh thái rõ ràng, dễ dùng
            </h2>
          </header>

          <div className="vv-bento-grid">
            <article className="vv-bento-card">
              <div className="vv-bento-head teal">
                <span className="vv-bento-icon">
                  <Layers size={22} />
                </span>
                <div>
                  <span className="vv-bento-badge">
                    TRỤ CỘT 1 · PRACTICE STUDIO
                  </span>
                  <h3>
                    Phòng luyện Thác nốt (Waterfall), Khuông nhạc Đôi &amp; Tay
                    mẫu 3D
                  </h3>
                </div>
              </div>
              <div className="vv-bento-body">
                <p>
                  Chuyển đổi mượt giữa Thác nốt rơi trực quan và Khuông nhạc
                  chuẩn nhạc viện. Tua tốc độ chậm <strong>25%–150%</strong>,
                  lặp đoạn A–B và xoay góc camera Tay mẫu 3D đã kiểm chứng.
                </p>
                <ul className="vv-bento-list">
                  <li>
                    <Check size={15} />
                    <span>
                      Chơi trọn bài 20 ô nhịp với 5 nút nhảy đoạn:{" "}
                      <strong>Intro · Verse · Chorus · Bridge · Outro</strong>
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      Đổi tức thì 3 độ khó (Dễ · Vừa · Khó) và chuyển giữa Đàn
                      Piano ↔ Sáo trúc C5
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      Phản hồi sư phạm 3 phần từ Gia sư Minh An và Gia Phong kèm
                      xem <a href="/demo-3d">Demo 3D T8</a>
                    </span>
                  </li>
                </ul>
                <div className="vv-bento-actions">
                  <a
                    className="button button-primary"
                    href="/studio?try=1&lesson=TS01&inst=piano&diff=medium"
                  >
                    Trải nghiệm Phòng luyện <ArrowRight size={15} />
                  </a>
                  <a className="button button-quiet" href="/demo-3d">
                    Xem Kiểm chứng 3D
                  </a>
                </div>
              </div>
            </article>

            <article className="vv-bento-card">
              <div className="vv-bento-head gold">
                <span className="vv-bento-icon amber">
                  <Upload size={22} />
                </span>
                <div>
                  <span className="vv-bento-badge">
                    TRỤ CỘT 2 · KHO 284+ BÀI &amp; AI IMPORTER
                  </span>
                  <h3>36 Ca Khúc Trọn Bài &amp; Công cụ Chuyển Nhạc Tự Động</h3>
                </div>
              </div>
              <div className="vv-bento-body">
                <p>
                  Kho nhạc phong phú từ Ballad, Acoustic, Pop Việt, Nhạc Trịnh,
                  Quê hương đến Nhạc Tết. Kèm công cụ <strong>AI DSP</strong>{" "}
                  biến Link hoặc tệp MP3/WAV/MIDI/MusicXML thành bài tập riêng.
                </p>
                <ul className="vv-bento-list">
                  <li>
                    <Check size={15} />
                    <span>
                      Tự động tách nhịp (Tempo BPM), giọng, hợp âm đệm và dòng
                      giai điệu chính
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      Trình sửa nhanh trên trình duyệt: dịch tông ±12 bán âm,
                      lượng tử hoá nhịp 1/8 – 1/16
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      Tự động sinh số ngón Piano 1–5 và bảng thế bấm Sáo 6 lỗ (
                      <code>●○◐</code>) từ bản nhạc <code>VocaScore</code>
                    </span>
                  </li>
                </ul>
                <div className="vv-bento-actions">
                  <a className="button button-primary" href="/library">
                    Mở Thư viện &amp; Nhập nhạc <ArrowRight size={15} />
                  </a>
                </div>
              </div>
            </article>

            <article className="vv-bento-card">
              <div className="vv-bento-head">
                <span className="vv-bento-icon mint">
                  <Gamepad2 size={22} />
                </span>
                <div>
                  <span className="vv-bento-badge">
                    TRỤ CỘT 3 · TRÒ CHƠI &amp; GIA SƯ AI
                  </span>
                  <h3>
                    6 Trò Chơi Học Thuật, Rương XP &amp; Diễn Đàn Sổ Tay Ô Nhịp
                  </h3>
                </div>
              </div>
              <div className="vv-bento-body">
                <p>
                  Kết hợp thực hành nhạc lý tương tác (phím tắt <code>1–7</code>{" "}
                  hoặc chạm cảm ứng) với Sổ tay ghi chú gắn vào từng ô nhịp và
                  trợ lý hỏi đáp Gia sư AI trên thiết bị.
                </p>
                <ul className="vv-bento-list">
                  <li>
                    <Check size={15} />
                    <span>
                      6 trò chơi: Nốt rơi, Tai nghe Solfège, Đọc khoá Sol, Nhịp
                      4/4, Motif Quiz &amp; Thế bấm Sáo 6 lỗ
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      3 Rương thưởng XP (Đồng +50 · Bạc +100 · Vàng +200 XP) gắn
                      với mục tiêu luyện tập thật
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      Hỏi đáp sư phạm căn cứ 24 thẻ tri thức <code>kb://</code>{" "}
                      và cộng đồng học tập kiểm duyệt 4 lớp
                    </span>
                  </li>
                </ul>
                <div className="vv-bento-actions">
                  <a className="button button-primary" href="/games">
                    Chơi thử 6 Trò chơi <ArrowRight size={15} />
                  </a>
                  <a className="button button-quiet" href="/community">
                    Vào Cộng đồng &amp; Sổ tay
                  </a>
                </div>
              </div>
            </article>

            <article className="vv-bento-card">
              <div className="vv-bento-head indigo">
                <span className="vv-bento-icon purple">
                  <Building2 size={22} />
                </span>
                <div>
                  <span className="vv-bento-badge">
                    TRỤ CỘT 4 · DÀNH CHO NGƯỜI MUA DỊCH VỤ &amp; B2B
                  </span>
                  <h3>
                    Gói Cá Nhân Minh Bạch &amp; Quản Trị Phòng Đàn Trường Nhạc
                  </h3>
                </div>
              </div>
              <div className="vv-bento-body">
                <p>
                  Dễ theo dõi tiến độ cho người tự học tại nhà, phụ huynh quản
                  lý thói quen luyện của con và trung tâm âm nhạc vận hành lớp
                  học chuyên nghiệp.
                </p>
                <ul className="vv-bento-list">
                  <li>
                    <Check size={15} />
                    <span>
                      Bảng Tổng quan đo lường rõ lượt tập, độ chính xác trung
                      bình, mục tiêu tuần &amp; chuỗi ngày
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      Thanh toán VietQR kích hoạt tự động, báo trước gia hạn 7
                      ngày, cam kết hoàn tiền 7 ngày đầu
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      Cổng Phòng đàn B2B (<strong>39.000đ/ghế/tháng</strong>):
                      tạo lớp, xem thời lượng tuần &amp; xuất CSV
                    </span>
                  </li>
                </ul>
                <div className="vv-bento-actions">
                  <a className="button button-primary" href="/pricing">
                    Xem Bảng giá &amp; Mua dịch vụ <ArrowRight size={15} />
                  </a>
                  <a className="button button-quiet" href="/register">
                    Tạo tài khoản miễn phí
                  </a>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="gx-section" id="cach-hoat-dong" data-reveal="">
          <header className="gx-head">
            <span className="gx-kicker">{t("lp.howKicker")}</span>
            <h2>{t("lp.howTitle")}</h2>
          </header>
          <div className="gx-steps">
            {[
              [CirclePlay, 1],
              [Mic, 2],
              [Sparkles, 3],
            ].map(([Icon, n]) => (
              <article key={n} className="gx-step">
                <span className="gx-step-n">0{n}</span>
                <Icon size={22} />
                <h3>{t(`lp.how${n}t`)}</h3>
                <p>{t(`lp.how${n}d`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="gx-section" aria-labelledby="gx-cmp" data-reveal="">
          <header className="gx-head">
            <span className="gx-kicker">{t("lp.cmpKicker")}</span>
            <h2 id="gx-cmp">{t("lp.cmpTitle")}</h2>
          </header>
          <div className="gx-cmp-wrap">
            <table className="gx-cmp">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Tiêu chí so sánh</span>
                  </th>
                  <th scope="col">{t("lp.cmpYt")}</th>
                  <th scope="col" className="gx-cmp-hl">
                    {t("lp.cmpVv")}
                  </th>
                  <th scope="col">{t("lp.cmpTutor")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r}>
                    <th scope="row">{t(`lp.cmpRow${r}`)}</th>
                    <Cell tone={tones.yt[i]}>{t(`lp.cmpYt${r}`)}</Cell>
                    <Cell tone={tones.vv[i]}>{t(`lp.cmpVv${r}`)}</Cell>
                    <Cell tone={tones.tu[i]}>{t(`lp.cmpTu${r}`)}</Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="gx-note">{t("lp.cmpNote")}</p>
        </section>

        <section
          className="gx-section"
          aria-labelledby="gx-path"
          data-reveal=""
        >
          <header className="gx-head">
            <span className="gx-kicker">{t("lp.pathKicker")}</span>
            <h2 id="gx-path">{t("lp.pathTitle")}</h2>
          </header>
          <ol className="gx-path">
            {Array.from({ length: 12 }, (_, i) => {
              const free = i < FREE_IN_PATH;
              const code = `PN${String(i + 1).padStart(2, "0")}`;
              const href = free
                ? `/studio?try=1&lesson=${code}`
                : `/library?unlock=${code}`;
              return (
                <li
                  key={i}
                  className={free ? "free" : ""}
                  style={{ padding: 0, overflow: "hidden" }}
                >
                  <a
                    href={href}
                    style={{
                      display: "grid",
                      gap: 4,
                      height: "100%",
                      padding: 14,
                      color: "inherit",
                      textDecoration: "none",
                    }}
                  >
                    <span className="gx-path-n">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <strong>{t(`lp.p${i + 1}`)}</strong>
                    <small>
                      {free ? (
                        <>{t("lp.pathFree")} · Tập ngay →</>
                      ) : (
                        <>
                          <Lock size={11} /> {t("lp.pathPlus")}
                        </>
                      )}
                    </small>
                  </a>
                </li>
              );
            })}
          </ol>
          <a className="text-link text-link-accent" href="/library">
            Xem trọn bộ 22 giáo trình, 36 ca khúc 20 ô &amp; 210 bài tập kỹ
            thuật <ArrowRight size={16} />
          </a>
        </section>

        <div className="gx-section" data-reveal="">
          <MusicSkillTree compactDefault />
        </div>

        <section
          className="gx-section gx-privacy"
          aria-labelledby="gx-priv"
          data-reveal=""
        >
          <header className="gx-head">
            <span className="gx-kicker">{t("lp.privKicker")}</span>
            <h2 id="gx-priv">{t("lp.privTitle")}</h2>
          </header>
          <div className="gx-steps">
            {[
              [ShieldCheck, 1],
              [Bot, 2],
              [Check, 3],
            ].map(([Icon, n]) => (
              <article key={n} className="gx-step">
                <Icon size={22} />
                <h3>{t(`lp.priv${n}t`)}</h3>
                <p>{t(`lp.priv${n}d`)}</p>
              </article>
            ))}
          </div>
          <a className="text-link" href="/privacy">
            {t("footer.privacy")} <ArrowRight size={15} />
          </a>
        </section>

        <section
          className="gx-section gx-faq"
          aria-labelledby="gx-faq"
          data-reveal=""
        >
          <h2 id="gx-faq">{t("lp.faqTitle")}</h2>
          {[1, 2, 3, 4, 5].map((n) => (
            <details key={n}>
              <summary>{t(`lp.q${n}`)}</summary>
              <p>{t(`lp.a${n}`)}</p>
            </details>
          ))}
        </section>

        <section className="gx-final" data-reveal="">
          <span className="gx-kicker">{t("lp.ctaKicker")}</span>
          <h2>{t("lp.ctaTitle")}</h2>
          <p>{t("lp.ctaDesc")}</p>
          <div className="gx-hero-actions">
            <a className="button button-primary gx-cta-big" href={TRY}>
              {t("lp.ctaTry")} <ArrowRight size={18} />
            </a>
            <a className="button button-quiet gx-on-dark" href="/register">
              {t("lp.ctaAccount")}
            </a>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
