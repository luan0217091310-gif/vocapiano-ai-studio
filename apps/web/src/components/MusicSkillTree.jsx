// Cây Kỹ Năng Học Thuật VocaVerse (24 thẻ kb://) lấy cảm hứng tương tác từ andreasbm/web-skills:
// nhánh cây trực quan nối bằng mũi tên, trạng thái xám -> rực màu khi thành thạo, âm thanh Web Audio phản hồi,
// chế độ Thu gọn/Chi tiết, lưu tiến độ localStorage và nút mở thẳng bài luyện tương ứng trong Practice Studio.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Compass,
  Layers,
  Minimize2,
  Maximize2,
  Piano,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Wind,
} from "lucide-react";

const STORAGE_KEY = "vocaverse.skilltree.v1";

const SKILL_BRANCHES = [
  {
    id: "piano_foundations",
    title: "Piano · Nền tảng Tay phải",
    subtitle: "Cấp 1 · Nhập môn (6 kỹ năng)",
    accent: "teal",
    instrument: "piano",
    icon: Piano,
    tiers: [
      [
        {
          id: "kb://pno.posture.d40",
          short: "Tư thế & D-40",
          title: "Tư thế ngồi, cổ tay thả lỏng & nghỉ an toàn D-40",
          lessonId: "PN01",
          desc: "Giữ khuỷu tay ngang mặt phím, ngón cong tự nhiên như cầm quả bóng nhỏ và nghỉ 10 phút khi mỏi cổ tay.",
          criteria: "Thực hiện trơn tru kiểm tra tư thế đầu buổi ở bài PN01.",
        },
        {
          id: "kb://pno.rh.c_pos",
          short: "Neo Đô giữa",
          title: "Định vị Đô giữa (C4) và cụm 5 nốt Đô–Sol",
          lessonId: "PN01",
          desc: "Đặt ngón 1 (ngón cái) vào phím Đô4 (bên trái cụm 2 phím đen), lần lượt 5 ngón lên Đô–Rê–Mi–Fa–Sol.",
          criteria:
            "Chơi đúng 5 nốt Đô–Sol ≥ 85% độ chính xác qua Micro hoặc MIDI.",
        },
      ],
      [
        {
          id: "kb://pno.rh.finger_1_5",
          short: "Độc lập ngón 1–5",
          title: "Kiểm soát lực đều 5 ngón tay phải (nhất là ngón 4–5)",
          lessonId: "PN02",
          desc: "Không nhấc vổng ngón chưa dùng, giữ âm lượng đồng đều giữa ngón cái khỏe và ngón áp út / út.",
          criteria: "Hoàn thành PN02 không dính lỗi nốt thừa hoặc bỏ nốt.",
        },
        {
          id: "kb://pno.rhythm.quarter_half",
          short: "Nốt đen & trắng",
          title: "Đếm phách 4/4 với nốt đen, trắng, tròn và dấu lặng",
          lessonId: "PN03",
          desc: "Giữ nhịp ổn định theo đèn Metronome, nhấc phím đúng trường độ ở dấu lặng.",
          criteria: "Sai lệch nhịp trung bình ≤ 65 ms trong chế độ Theo nhịp.",
        },
      ],
      [
        {
          id: "kb://pno.rh.legato",
          short: "Kỹ thuật Legato",
          title: "Nối câu hát liền tiếng (Legato) & ngắt câu (Phrase)",
          lessonId: "PN04",
          desc: "Chuyển trọng lượng từ đầu ngón này sang ngón kế tiếp để giai điệu mềm mượt như giọng hát.",
          criteria: "Đạt 3 sao ở PN04 tốc độ 100%.",
        },
        {
          id: "kb://pno.rh.shift_thumb",
          short: "Luồn ngón cái",
          title: "Luồn ngón cái (Thumb-under) mở rộng quãng tám Đô4–Đô5",
          lessonId: "PN05",
          desc: "Luồn ngón 1 êm dưới ngón 3 khi đi từ Mi4 sang Fa4 mà không giật cổ tay.",
          criteria: "Chạy âm giai Đô trưởng lên xuống đều phách ở PN05.",
        },
      ],
    ],
  },
  {
    id: "piano_two_hands",
    title: "Piano · Độc lập 2 tay & Đệm hát",
    subtitle: "Cấp 2 · Cơ bản (6 kỹ năng)",
    accent: "indigo",
    instrument: "piano",
    icon: Layers,
    tiers: [
      [
        {
          id: "kb://pno.lh.c_pos",
          short: "Tay trái Đô3–Sol3",
          title: "Khóa Fa (Bass Clef) & vị trí 5 nốt tay trái",
          lessonId: "PN06",
          desc: "Đặt ngón 5 tay trái tại Đô3, đọc ký hiệu khóa Fa và giữ âm nền ấm, nhỏ hơn giai điệu tay phải.",
          criteria: "Chơi riêng tay trái chuẩn nhịp ở PN06.",
        },
        {
          id: "kb://pno.hands.together",
          short: "Ghép hai tay",
          title: "Phối hợp hai tay đồng bộ trên khuông nhạc đôi",
          lessonId: "PN08",
          desc: "Kết hợp giai điệu tay phải với nốt gốc tay trái qua Chế độ Chờ đúng nốt (Wait Mode) rồi tăng dần lên 100%.",
          criteria: "Ghép 2 tay trọn 8 ô nhịp đạt ≥ 85% ở PN08.",
        },
      ],
      [
        {
          id: "kb://pno.chord.triad_145",
          short: "Hợp âm C–G–Am–F",
          title: "Bấm chuyển nhanh vòng hợp âm pop/ballad I–V–vi–IV",
          lessonId: "PN09",
          desc: "Dùng thể đảo (inversion) gần nhau để tay trái di chuyển tối thiểu khi chuyển giữa C, G, Am, F.",
          criteria: "Chuyển vòng 4 hợp âm không khựng phách ở 75 BPM.",
        },
        {
          id: "kb://pno.chord.arpeggio",
          short: "Rải hợp âm Ballad",
          title: "Rải ngón 5–3–1–3 (Broken Chords) tạo nền Acoustic",
          lessonId: "PN10",
          desc: "Rải đều từng nốt hợp âm tay trái theo tiết tấu Ballad 4/4 trong khi tay phải hát giai điệu.",
          criteria: "Giữ đều phách rải hợp âm ở PN10 độ khó Vừa/Khó.",
        },
      ],
      [
        {
          id: "kb://pno.pedal.sustain",
          short: "Pedal vang sạch",
          title: "Nhấn – nhả Pedal ngân đúng vạch đổi hợp âm",
          lessonId: "PN11",
          desc: "Thay pedal ngay sau phách 1 của hợp âm mới để tiếng đàn ngân vang mà không bị ù đục.",
          criteria: "Áp dụng đổi pedal sạch ở 4 chuyển hợp âm liên tiếp.",
        },
        {
          id: "kb://pno.dynamics.pmf",
          short: "Sắc thái p–mf–f",
          title: "Kiểm soát độ mạnh nhẹ (Dynamics) cho cao trào điệp khúc",
          lessonId: "PN12",
          desc: "Tạo tương phản giữa Verse nhẹ nhàng (p/mp) và Chorus mở rộng (mf/f) theo ký hiệu bản nhạc.",
          criteria: "Hoàn thành PN12 phân biệt rõ độ mạnh ở điệp khúc.",
        },
      ],
    ],
  },
  {
    id: "sao_truc_c5",
    title: "Sáo trúc C5 · Hơi & 6 lỗ bấm",
    subtitle: "Gia Phong · Sáo Đô C5 (6 kỹ năng)",
    accent: "amber",
    instrument: "sao_truc",
    icon: Wind,
    tiers: [
      [
        {
          id: "kb://sao.embouchure.c5",
          short: "Khẩu hình môi",
          title: "Đặt lỗ thổi sáo C5 & tạo âm Đô5 trong rõ",
          lessonId: "SA03",
          desc: "Khép nhẹ khóe môi hướng luồng hơi góc ~45° vào cạnh lỗ thổi, giữ cằm thoải mái không gồng cổ.",
          criteria:
            "Micro YIN nhận đúng cao độ Đô5/Sol5 ổn định liên tiếp 2 giây.",
        },
        {
          id: "kb://sao.breath.diaphragm",
          short: "Hơi bụng & lấy hơi",
          title: "Hít hơi bụng sâu & tuân dấu lấy hơi an toàn L7",
          lessonId: "SA04",
          desc: "Lấy hơi nhanh bằng khoang bụng tại đúng dấu phẩy cuối câu 4 ô nhịp, không nín hơi quá sức.",
          criteria: "Thổi trọn câu dài không hụt hơi hay tụt cao độ cuối nốt.",
        },
      ],
      [
        {
          id: "kb://sao.holes.c5_g5",
          short: "3 lỗ tay trái",
          title: "Bịt kín đệm thịt ngón tay trái (Sol5 · La5 · Si5)",
          lessonId: "SA05",
          desc: "Dùng phần thịt đầu ngón (không dùng đầu móng) bịt kín hoàn toàn lỗ 1–2–3 để âm không bị xì hơi.",
          criteria: "Đạt ≥ 85% nhận diện cao độ Micro ở SA05.",
        },
        {
          id: "kb://sao.holes.full_scale",
          short: "Trọn 6 lỗ Đô5–Si5",
          title:
            "Thang âm Đô trưởng hoàn chỉnh trên 6 lỗ bấm (●●●●●● → ○○○○○○)",
          lessonId: "SA06",
          desc: "Chuyển mượt giữa tay phải (Đô5–Rê5–Mi5–Fa5) và tay trái (Sol5–La5–Si5) đúng bảng FluteChart C5.",
          criteria: "Đạt 3 sao trong trò chơi Thế bấm Sáo 6 lỗ & bài SA06.",
        },
      ],
      [
        {
          id: "kb://sao.octave2.overblow",
          short: "Quãng 2 Đô6–Mi6",
          title: "Nén tốc độ hơi lên quãng hai trong trẻo (Đô6 · Rê6 · Mi6)",
          lessonId: "SA08",
          desc: "Thu hẹp khe môi và tăng tốc luồng hơi (không thổi phồng má) để bật lên quãng 2 êm ái.",
          criteria: "Giữ cao độ Đô6–Rê6 lệch dưới ±25 cents qua Micro.",
        },
        {
          id: "kb://sao.ornament.slur_vib",
          short: "Đánh lưỡi & Luyến",
          title: "Đánh lưỡi đơn (Tư-Tư), luyến mềm và rung hơi cuối câu",
          lessonId: "SA10-backup",
          desc: "Phân tách nốt rõ nét bằng đầu lưỡi nhẹ và kết hợp luyến nốt mang màu sắc dân gian Việt Nam.",
          criteria: "Hoàn thành SA10-backup đạt ≥ 85% tốc độ 100%.",
        },
      ],
    ],
  },
  {
    id: "full_song_theory",
    title: "Trọn bài 20 ô nhịp & Nhạc lý",
    subtitle: "Cấp 3 · Tự tin biểu diễn (6 kỹ năng)",
    accent: "emerald",
    instrument: "piano",
    icon: Compass,
    tiers: [
      [
        {
          id: "kb://theory.solfege.ear",
          short: "Tai nghe Solfège",
          title: "Phân biệt cao độ Đô–Rê–Mi–Fa–Sol–La–Si theo chuẩn A4 = 440Hz",
          lessonId: "PN04",
          desc: "Rèn thính giác tương đối để tự phát hiện nốt sai và bắt giai điệu nhanh qua trò chơi Solfège.",
          criteria: "Đạt ≥ 800 điểm trong trò chơi Đoán nốt bằng tai (/games).",
        },
        {
          id: "kb://theory.staff.treble",
          short: "Đọc khuông nhanh",
          title: "Thị tấu trực tiếp 5 dòng kẻ khóa Sol & khóa Fa",
          lessonId: "PN06",
          desc: "Chuyển từ Thác nốt rơi sang Chế độ Song song và Khuông nhạc chuẩn nhạc viện.",
          criteria: "Đạt 3 sao ở trò chơi Đọc nốt nhanh trên khuông.",
        },
      ],
      [
        {
          id: "kb://theory.meter.4_4",
          short: "Đồng hồ nhịp 4/4",
          title: "Giữ nhịp nội tâm vững ở 72 · 90 · 120 BPM",
          lessonId: "PN08",
          desc: "Không bị kéo nhanh ở đoạn dễ hay chùng nhịp khi gặp đoạn chuyển hợp âm khó.",
          criteria: "Hoàn thành bài kiểm tra Giữ nhịp nội tâm (Rhythm Tap).",
        },
        {
          id: "kb://song.structure.5sec",
          short: "Cấu trúc 5 đoạn",
          title:
            "Chia nhỏ luyện từng đoạn Intro · Verse · Chorus · Bridge · Outro",
          lessonId: "TS01",
          desc: "Dùng thanh nhảy đoạn & lặp A–B khoanh vùng đúng 4 ô nhịp khó nhất thay vì tập dàn trải từ đầu.",
          criteria: "Tập chắc từng đoạn 4 ô nhịp và gắn ghi chú ô nhịp yếu.",
        },
      ],
      [
        {
          id: "kb://song.tempo.ramp",
          short: "Tăng tốc 50% → 100%",
          title: "Chiến thuật tăng dần tốc độ từ 50% → 75% → 100%",
          lessonId: "TS01",
          desc: "Tập chậm đủ sạch 3 lượt liên tiếp rồi mới nâng tốc độ thêm 10–15% để não ghi nhớ cơ bắp chính xác.",
          criteria: "Vượt qua đoạn Chorus ở 75% và 100% không sai quá 2 nốt.",
        },
        {
          id: "kb://song.performance.full",
          short: "Biểu diễn trọn bài",
          title:
            "Chơi liền mạch trọn bài 20 ô nhịp (Chế độ Kiểm tra / Quay clip)",
          lessonId: "TS01",
          desc: "Trình diễn hoàn chỉnh từ Intro tới Outro không dừng, lưu thành tích và chia sẻ vào cộng đồng.",
          criteria: "Hoàn tất 1 bài trọn vẹn 20 ô nhịp đạt ≥ 85% độ chính xác.",
        },
      ],
    ],
  },
];

const ALL_SKILLS = SKILL_BRANCHES.flatMap((b) =>
  b.tiers.flat().map((s) => ({
    ...s,
    branchId: b.id,
    branchTitle: b.title,
    accent: b.accent,
    instrument: b.instrument,
  })),
);

function loadCompleted() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function saveCompleted(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore storage quota */
  }
}

export default function MusicSkillTree({ compactDefault = false }) {
  const [completed, setCompleted] = useState(() => loadCompleted());
  const [selectedId, setSelectedId] = useState(ALL_SKILLS[0].id);
  const [filter, setFilter] = useState("all");
  const [compact, setCompact] = useState(compactDefault);
  const [soundOn, setSoundOn] = useState(true);
  const [burstId, setBurstId] = useState("");
  const audioCtxRef = useRef(null);
  const burstTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const playChime = (celebrate = false) => {
    if (!soundOn || typeof window === "undefined") return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = audioCtxRef.current || new AC();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const freqs = celebrate
        ? [523.25, 659.25, 783.99, 1046.5]
        : [440, 523.25];
      freqs.forEach((hz, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t0 = ctx.currentTime + idx * 0.055;
        osc.type = celebrate ? "triangle" : "sine";
        osc.frequency.setValueAtTime(hz, t0);
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.exponentialRampToValueAtTime(
          celebrate ? 0.14 : 0.08,
          t0 + 0.015,
        );
        gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.34);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.36);
      });
    } catch {
      /* ignore Web Audio restrictions */
    }
  };

  const toggleMastery = (skillId) => {
    const next = new Set(completed);
    const becomingDone = !next.has(skillId);
    if (becomingDone) {
      next.add(skillId);
      playChime(true);
      setBurstId(skillId);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      burstTimerRef.current = setTimeout(() => setBurstId(""), 900);
    } else {
      next.delete(skillId);
      playChime(false);
    }
    setCompleted(next);
    saveCompleted(next);
  };

  const resetProgress = () => {
    const empty = new Set();
    setCompleted(empty);
    saveCompleted(empty);
  };

  const visibleBranches = useMemo(
    () =>
      filter === "all"
        ? SKILL_BRANCHES
        : SKILL_BRANCHES.filter((b) =>
            filter === "piano"
              ? b.id.startsWith("piano_")
              : filter === "sao"
                ? b.id === "sao_truc_c5"
                : b.id === "full_song_theory",
          ),
    [filter],
  );

  const selected = ALL_SKILLS.find((s) => s.id === selectedId) ?? ALL_SKILLS[0];
  const pct = Math.round((completed.size / ALL_SKILLS.length) * 100);
  const studioHref = `/studio?try=1&lesson=${encodeURIComponent(selected.lessonId)}${
    selected.lessonId.startsWith("TS")
      ? `&inst=${selected.instrument}&diff=medium`
      : ""
  }`;

  return (
    <section
      className={`vv-skilltree ${compact ? "is-compact" : ""}`}
      aria-label="Cây Kỹ Năng Học Thuật VocaVerse 24 thẻ tri thức"
    >
      <div className="vv-st-toolbar">
        <div className="vv-st-heading">
          <span className="vv-st-kicker">
            <Sparkles size={13} /> BẢN ĐỒ CÂY KỸ NĂNG HỌC THUẬT · 24 THẺ KB://
          </span>
          <h3>
            Theo dõi lộ trình thành thạo Piano &amp; Sáo trúc C5 trực quan
          </h3>
          <p>
            Chạm vào từng nút kỹ năng để xem tiêu chí đạt chuẩn, mở bài thực
            hành tương ứng trong Phòng luyện và đánh dấu tiến độ của bạn.
          </p>
        </div>

        <div className="vv-st-controls">
          <div className="vv-st-progress-card" role="status" aria-live="polite">
            <div className="vv-st-progress-top">
              <span>
                <Award size={15} /> Đã chinh phục
              </span>
              <strong>
                {completed.size} / {ALL_SKILLS.length} ({pct}%)
              </strong>
            </div>
            <div className="vv-st-progress-track">
              <div
                className="vv-st-progress-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="vv-st-actions">
            <button
              type="button"
              className="vv-st-icon-btn"
              onClick={() => setCompact((v) => !v)}
              aria-pressed={compact}
              title={compact ? "Chế độ chi tiết" : "Chế độ thu gọn"}
            >
              {compact ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              {compact ? "Chi tiết" : "Thu gọn"}
            </button>
            <button
              type="button"
              className="vv-st-icon-btn"
              onClick={() => setSoundOn((v) => !v)}
              aria-pressed={soundOn}
              title="Bật/tắt âm phản hồi khi đánh dấu kỹ năng"
            >
              {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {soundOn ? "Âm báo: Bật" : "Âm báo: Tắt"}
            </button>
            {completed.size > 0 && (
              <button
                type="button"
                className="vv-st-icon-btn"
                onClick={resetProgress}
                title="Đặt lại toàn bộ đánh dấu"
              >
                <RotateCcw size={14} /> Đặt lại
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        className="vv-st-filters"
        role="group"
        aria-label="Lọc nhánh kỹ năng"
      >
        {[
          ["all", "Tất cả 4 nhánh (24)"],
          ["piano", "Piano (12)"],
          ["sao", "Sáo trúc C5 (6)"],
          ["theory", "Trọn bài & Nhạc lý (6)"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={filter === key ? "active" : ""}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="vv-st-grid">
        {visibleBranches.map((branch) => {
          const Icon = branch.icon;
          const branchSkills = branch.tiers.flat();
          const doneCount = branchSkills.filter((s) =>
            completed.has(s.id),
          ).length;
          return (
            <article
              key={branch.id}
              className={`vv-st-branch accent-${branch.accent}`}
            >
              <header className="vv-st-branch-head">
                <span className="vv-st-branch-icon">
                  <Icon size={18} />
                </span>
                <div>
                  <h4>{branch.title}</h4>
                  <small>{branch.subtitle}</small>
                </div>
                <span className="vv-st-branch-count">
                  {doneCount}/{branchSkills.length}
                </span>
              </header>

              <div className="vv-st-tiers">
                {branch.tiers.map((tier, tIdx) => (
                  <div key={tIdx} className="vv-st-tier">
                    {tIdx > 0 && (
                      <div className="vv-st-connector" aria-hidden="true">
                        <span />
                      </div>
                    )}
                    <div className="vv-st-tier-row">
                      {tier.map((skill) => {
                        const isDone = completed.has(skill.id);
                        const isSelected = selected.id === skill.id;
                        const isBursting = burstId === skill.id;
                        return (
                          <button
                            key={skill.id}
                            type="button"
                            className={`vv-st-node ${isDone ? "is-done" : ""} ${
                              isSelected ? "is-selected" : ""
                            } ${isBursting ? "is-bursting" : ""}`}
                            onClick={() => {
                              setSelectedId(skill.id);
                              playChime(false);
                            }}
                            aria-pressed={isSelected}
                          >
                            <span className="vv-st-node-badge">
                              {isDone ? (
                                <Check size={14} strokeWidth={3} />
                              ) : (
                                <span>{tIdx + 1}</span>
                              )}
                            </span>
                            <span className="vv-st-node-label">
                              {skill.short}
                            </span>
                            {!compact && (
                              <span className="vv-st-node-code">
                                {skill.lessonId}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <aside
        className="vv-st-inspector"
        aria-live="polite"
        aria-label="Chi tiết kỹ năng đang chọn"
      >
        <div className="vv-st-inspector-copy">
          <div className="vv-st-inspector-meta">
            <code>{selected.id}</code>
            <span>{selected.branchTitle}</span>
            {completed.has(selected.id) && (
              <strong className="vv-st-done-pill">
                <CheckCircle2 size={13} /> Đã thành thạo
              </strong>
            )}
          </div>
          <h4>{selected.title}</h4>
          <p>{selected.desc}</p>
          <small>
            <strong>Tiêu chí đạt chuẩn:</strong> {selected.criteria}
          </small>
        </div>
        <div className="vv-st-inspector-actions">
          <button
            type="button"
            className={`button ${
              completed.has(selected.id) ? "button-quiet" : "button-primary"
            }`}
            onClick={() => toggleMastery(selected.id)}
          >
            <CheckCircle2 size={15} />
            {completed.has(selected.id)
              ? "Bỏ đánh dấu thành thạo"
              : "Đánh dấu đã thành thạo"}
          </button>
          <a className="button button-quiet" href={studioHref}>
            Mở bài {selected.lessonId} trong Studio <ArrowRight size={15} />
          </a>
        </div>
      </aside>
    </section>
  );
}
