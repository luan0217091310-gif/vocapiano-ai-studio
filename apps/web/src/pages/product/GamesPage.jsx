import { useEffect, useRef, useState } from "react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Ear,
  Flame,
  Gamepad2,
  Gift,
  Music,
  Play,
  Sparkles,
  Star,
  Timer,
  Trophy,
  Volume2,
  Wind,
} from "lucide-react";
import { api, isLoggedIn } from "../../api/client.js";
import { readProductState } from "../../productStore.js";
import { PublicFooter, PublicHeader } from "../Shared.jsx";
import { ProductNav } from "./ProductNav.jsx";

const SOLFEGE = [
  {
    midi: 60,
    name: "Đô4",
    short: "Đô",
    step: 0,
    holes: "●●●●●●",
    keyHint: "1",
  },
  {
    midi: 62,
    name: "Rê4",
    short: "Rê",
    step: 1,
    holes: "●●●●●○",
    keyHint: "2",
  },
  {
    midi: 64,
    name: "Mi4",
    short: "Mi",
    step: 2,
    holes: "●●●●○○",
    keyHint: "3",
  },
  {
    midi: 65,
    name: "Fa4",
    short: "Fa",
    step: 3,
    holes: "●●●○○○",
    keyHint: "4",
  },
  {
    midi: 67,
    name: "Sol4",
    short: "Sol",
    step: 4,
    holes: "●●○○○○",
    keyHint: "5",
  },
  {
    midi: 69,
    name: "La4",
    short: "La",
    step: 5,
    holes: "●○○○○○",
    keyHint: "6",
  },
  {
    midi: 71,
    name: "Si4",
    short: "Si",
    step: 6,
    holes: "○○○○○○",
    keyHint: "7",
  },
];

const SONG_QUIZ_BANK = [
  {
    id: "TS01",
    title: "Nơi Này Có Anh (Sơn Tùng M-TP)",
    genre: "Ballad / Acoustic",
    notes: [64, 67, 72, 71, 69, 67],
  },
  {
    id: "TS04",
    title: "Nàng Thơ (Hoàng Dũng)",
    genre: "Acoustic / Indie",
    notes: [64, 67, 69, 72, 71, 69],
  },
  {
    id: "TS09",
    title: "Diễm Xưa (Trịnh Công Sơn)",
    genre: "Nhạc Trịnh",
    notes: [69, 72, 71, 69, 67, 64],
  },
  {
    id: "TS25",
    title: "See Tình (Hoàng Thùy Linh)",
    genre: "Pop Việt",
    notes: [60, 62, 64, 67, 69, 72],
  },
  {
    id: "TS26",
    title: "Để Mị Nói Cho Mà Nghe (DTAP)",
    genre: "Pop / Tây Bắc",
    notes: [67, 69, 72, 74, 76, 74],
  },
  {
    id: "TS32",
    title: "River Flows in You (Yiruma)",
    genre: "Nhạc phim / Piano",
    notes: [69, 68, 69, 68, 69, 64],
  },
];

const GAMES = [
  {
    id: "falling_notes",
    title: "1. Nốt Rơi Theo Bài Hát (Piano & Sáo Tiles)",
    subtitle: "Phối hợp mắt nhìn thác nốt và phản xạ ngón tay đúng thời điểm",
    icon: Gamepad2,
    tag: "Phản xạ & Giai điệu",
    theory:
      "Mục tiêu học thuật (`kb://pno.rh.c_pos.01@1`): Rèn phản xạ ánh xạ nhanh từ ký hiệu cao độ (Đô–Si) sang vị trí phím đàn/lỗ sáo không cần nhìn xuống tay.",
  },
  {
    id: "ear_training",
    title: "2. Đoán Nốt Bằng Tai (Solfège Đô – Rê – Mi)",
    subtitle: "Nghe âm thanh nhạc cụ chuẩn tần số A4=440Hz và nhận diện bậc âm",
    icon: Ear,
    tag: "Luyện tai nghe",
    theory:
      "Mục tiêu học thuật (Thính giác tương đối): Phân biệt khoảng cách cung và nửa cung trong thang âm Đô trưởng (Mi–Fa và Si–Đô cách nhau 1/2 cung).",
  },
  {
    id: "staff_reader",
    title: "3. Đọc Nốt Nhanh Trên Khuông (Speed Staff)",
    subtitle: "Đọc vị trí nốt trên 5 dòng kẻ khoá Sol (𝄞) trong dưới 3 giây",
    icon: Timer,
    tag: "Thị tấu bản nhạc",
    theory:
      "Mục tiêu học thuật (`kb://pno.review.check1.01@1`): Ghi nhớ quy tắc thị tấu khoá Sol — Đô4 nằm ở dòng kẻ phụ thứ nhất dưới khuông, Mi4 nằm ở dòng kẻ 1, Sol4 nằm ở dòng kẻ 2.",
  },
  {
    id: "rhythm_tap",
    title: "4. Giữ Nhịp Nội Tâm (Rhythm Tap Master)",
    subtitle: "Gõ theo 4 phách mẫu rồi tự giữ đồng hồ nhịp chuẩn khi tắt gợi ý",
    icon: Flame,
    tag: "Đồng hồ nhịp",
    theory:
      "Mục tiêu học thuật (`kb://pno.rhythm.beat_pf.01@1`): Xây dựng cảm nhận phách đều (Internal Pulse) ở nhịp 4/4 với phách 1 mạnh, phách 3 mạnh vừa.",
  },
  {
    id: "song_quiz",
    title: "5. Nhận Diện Câu Nhạc Mở Đầu (Motif Quiz)",
    subtitle:
      "Nghe 6 nốt chủ đề (Motif) và nhận diện cấu trúc bài hát quen thuộc",
    icon: Music,
    tag: "Trí nhớ âm nhạc",
    theory:
      "Mục tiêu học thuật (Phân tích Motif): Nhận biết đường nét giai điệu (Melodic Contour) đi lên, đi xuống hay nhảy quãng trong câu mở đầu bài hát.",
  },
  {
    id: "flute_fingering",
    title: "6. Thế Bấm Sáo Trúc 6 Lỗ (FluteChart C5)",
    subtitle:
      "Thực hành bảng thế bấm chuẩn 6 lỗ (● bịt kín / ○ mở) của Sáo Đô C5",
    icon: Wind,
    tag: "Kỹ thuật Sáo C5",
    theory:
      "Mục tiêu học thuật (`kb://sao.holes.full_scale.01@1`): Bịt kín cả 6 lỗ (●●●●●●) cho nốt Đô5, mở dần từng lỗ từ dưới lên để tăng cao độ tới Si5 (○○○○○○).",
  },
];

const CHESTS = [
  {
    key: "chest_daily_1",
    title: "Rương Đồng · Khởi Động Học Thuật",
    desc: "Hoàn thành 1 bài luyện phản xạ nốt hoặc bài tập kỹ thuật 5 phút",
    xp: 50,
  },
  {
    key: "chest_stage_1",
    title: "Rương Bạc · Chuỗi Thị Tấu Chuẩn",
    desc: "Đạt từ 700 điểm trở lên (độ chính xác ≥ 75%) ở bất kỳ bài luyện nào",
    xp: 100,
  },
  {
    key: "chest_master_1",
    title: "Rương Vàng · Thủ Khoa Nhạc Lý",
    desc: "Đạt 3 ⭐ (≥ 850 điểm) ở cấp độ Vừa hoặc Khó",
    xp: 200,
  },
];

function playTone(ctxRef, midi, durSec = 0.42) {
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
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durSec + 0.02);
  } catch {
    /* headless fallback */
  }
}

export function GamesPage() {
  const account = Boolean(readProductState().account);
  const audioRef = useRef(null);
  const [activeGame, setActiveGame] = useState("falling_notes");
  const [difficulty, setDifficulty] = useState("medium");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [hits, setHits] = useState(0);
  const [round, setRound] = useState(1);
  const [maxRounds] = useState(8);
  const [targetIdx, setTargetIdx] = useState(0);
  const [quizSongIdx, setQuizSongIdx] = useState(0);
  const [fluteHoles, setFluteHoles] = useState([
    true,
    true,
    true,
    false,
    false,
    false,
  ]);
  const [statusMsg, setStatusMsg] = useState(
    "Chọn 1 trong 6 bài luyện bên dưới (hoặc bấm phím số 1–7 trên máy tính) để bắt đầu!",
  );
  const [finishedResult, setFinishedResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [claimedChests, setClaimedChests] = useState([]);
  const [bonusXp, setBonusXp] = useState(0);

  useEffect(() => {
    api
      .get("/games/leaderboard")
      .then((rows) => Array.isArray(rows) && setLeaderboard(rows))
      .catch(() => {});
    api
      .get("/rewards/summary")
      .then((d) => {
        if (d) {
          setClaimedChests(d.claimedChests || []);
          setBonusXp(d.bonusXp || 0);
        }
      })
      .catch(() => {});
  }, []);

  function startNewGame(gameId = activeGame, diff = difficulty) {
    setActiveGame(gameId);
    setDifficulty(diff);
    setScore(0);
    setCombo(0);
    setHits(0);
    setRound(1);
    setFinishedResult(null);
    const nextTarget = Math.floor(Math.random() * 7);
    setTargetIdx(nextTarget);
    const nextSong = Math.floor(Math.random() * SONG_QUIZ_BANK.length);
    setQuizSongIdx(nextSong);
    setStatusMsg(
      "Câu 1/8 bắt đầu! Nghe kỹ cao độ hoặc nhìn vị trí nốt rồi chọn đáp án.",
    );
    if (gameId === "song_quiz") {
      SONG_QUIZ_BANK[nextSong].notes.forEach((m, idx) => {
        setTimeout(() => playTone(audioRef, m, 0.28), idx * 240);
      });
    } else {
      playTone(audioRef, SOLFEGE[nextTarget].midi, 0.45);
    }
  }

  async function finishGame(finalScore, finalHits) {
    const stars = finalScore >= 850 ? 3 : finalScore >= 600 ? 2 : 1;
    const xp =
      stars * (difficulty === "hard" ? 20 : difficulty === "medium" ? 15 : 10);
    const accuracyPct = Math.round((finalHits / maxRounds) * 100);
    const res = {
      gameId: activeGame,
      difficulty,
      score: finalScore,
      stars,
      xp,
      accuracyPct,
    };
    setFinishedResult(res);
    setStatusMsg(
      `Hoàn thành 8/8 câu! Độ chính xác: ${accuracyPct}% · Điểm: ${finalScore} (${stars} ⭐ · +${xp} XP).`,
    );
    try {
      const saved = await api.post("/games/score", res);
      setBonusXp((prev) => prev + (saved?.xp || xp));
      const rows = await api.get("/games/leaderboard");
      if (Array.isArray(rows)) setLeaderboard(rows);
    } catch {
      /* offline fallback */
    }
  }

  function handleAnswer(correct, label = "") {
    const mult =
      difficulty === "hard" ? 140 : difficulty === "medium" ? 125 : 110;
    const gained = correct ? mult + combo * 10 : 25;
    const nextScore = score + gained;
    const nextCombo = correct ? combo + 1 : 0;
    const nextHits = correct ? hits + 1 : hits;
    setScore(nextScore);
    setCombo(nextCombo);
    setHits(nextHits);
    if (correct) {
      playTone(audioRef, SOLFEGE[targetIdx].midi + 12, 0.25);
      setStatusMsg(
        `✓ Chính xác: ${label} (+${gained} điểm · Chuỗi đúng x${nextCombo})`,
      );
    } else {
      playTone(audioRef, 55, 0.25);
      setStatusMsg(
        `✗ Chưa khớp (${label}). Đáp án chuẩn là ${
          activeGame === "song_quiz"
            ? SONG_QUIZ_BANK[quizSongIdx].title
            : `${SOLFEGE[targetIdx].name} (${SOLFEGE[targetIdx].holes})`
        }.`,
      );
    }

    if (round >= maxRounds) {
      finishGame(nextScore, nextHits);
    } else {
      const nextRound = round + 1;
      setRound(nextRound);
      const nextT = (targetIdx + 2 + (nextRound % 5)) % 7;
      setTargetIdx(nextT);
      const nextS = (quizSongIdx + 1) % SONG_QUIZ_BANK.length;
      setQuizSongIdx(nextS);
      if (activeGame === "song_quiz") {
        setTimeout(() => {
          SONG_QUIZ_BANK[nextS].notes.forEach((m, idx) => {
            setTimeout(() => playTone(audioRef, m, 0.26), idx * 230);
          });
        }, 300);
      } else {
        setTimeout(() => playTone(audioRef, SOLFEGE[nextT].midi, 0.4), 260);
      }
    }
  }

  // Hỗ trợ bấm phím số 1..7 trên máy tính để trả lời tức thì
  useEffect(() => {
    const onKey = (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName || "")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 7 && activeGame !== "song_quiz") {
        e.preventDefault();
        const idx = n - 1;
        handleAnswer(idx === targetIdx, SOLFEGE[idx].name);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGame, targetIdx, round, score, combo, hits]);

  async function claimChest(chest) {
    if (claimedChests.includes(chest.key)) return;
    setClaimedChests((prev) => [...prev, chest.key]);
    setBonusXp((prev) => prev + chest.xp);
    if (isLoggedIn()) {
      api.post(`/rewards/chests/${chest.key}/claim`, {}).catch(() => {});
    }
  }

  const currentNote = SOLFEGE[targetIdx] || SOLFEGE[0];
  const currentSong = SONG_QUIZ_BANK[quizSongIdx] || SONG_QUIZ_BANK[0];
  const currentGameInfo = GAMES.find((x) => x.id === activeGame) || GAMES[0];
  const accuracyNow = round > 1 ? Math.round((hits / (round - 1)) * 100) : 100;

  return (
    <div className={account ? "product-shell" : "library-public-shell"}>
      {account ? (
        <ProductNav active="games" />
      ) : (
        <PublicHeader active="games" />
      )}
      <main
        className={`library-main vv-page-enter ${account ? "" : "library-public-main"}`}
      >
        <div className="library-heading vv-page-hero">
          <div>
            <span className="section-kicker">
              PHÒNG THỰC HÀNH HỌC THUẬT · LUYỆN TAI · THỊ TẤU · CẢM NHỊP · SÁO
              C5
            </span>
            <h1>6 Trò Chơi Học Thuật Âm Nhạc & Rương Thưởng Kỹ Năng</h1>
            <p>
              Thiết kế theo giáo trình Nhạc lý & Xướng âm chuẩn: dễ thao tác
              bằng cảm ứng trên điện thoại hoặc phím tắt <code>1 – 7</code> trên
              máy tính.
            </p>
            <div className="vv-page-hero-pills">
              <span className="vv-page-hero-pill">
                🎯 <strong>6</strong> Chuyên đề: Nốt rơi · Solfège · Khuông Sol
                · Nhịp 4/4 · Motif · Sáo 6 lỗ
              </span>
              <span className="vv-page-hero-pill">
                🎁 <strong>3</strong> Rương thưởng: Đồng (+50 XP) · Bạc (+100
                XP) · Vàng (+200 XP)
              </span>
              <span className="vv-page-hero-pill">
                ⌨️ Hỗ trợ phím tắt <strong>1 – 7</strong> & Cảm ứng
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span className="vv-badge">
              <Sparkles size={14} /> Tổng XP Thưởng: +{bonusXp} XP
            </span>
            <a
              href="/studio?try=1&lesson=TS01"
              className="button button-primary"
            >
              Vào Phòng luyện Đàn & Sáo
            </a>
          </div>
        </div>

        {/* Hướng dẫn 3 bước dễ hiểu */}
        <div
          className="vv-acad-steps-bar"
          role="region"
          aria-label="Quy trình 3 bước luyện tập"
        >
          <div className="vv-acad-step-item">
            <span className="vv-acad-step-num">1</span>
            <div>
              <strong>Chọn kỹ năng & cấp độ (Dễ · Vừa · Khó)</strong>
              <small>
                6 bài luyện chuyên biệt cho phản xạ phím, tai nghe, đọc khuông
                và sáo trúc.
              </small>
            </div>
          </div>
          <div className="vv-acad-step-item">
            <span className="vv-acad-step-num">2</span>
            <div>
              <strong>Nghe âm mẫu & bấm đáp án (hoặc phím 1–7)</strong>
              <small>
                Chấm phản hồi tức thì từng câu kèm giải thích cao độ và thế bấm
                chuẩn.
              </small>
            </div>
          </div>
          <div className="vv-acad-step-item">
            <span className="vv-acad-step-num">3</span>
            <div>
              <strong>Tích sao (1–3 ⭐) & mở Rương thưởng XP</strong>
              <small>
                Đạt độ chính xác ≥ 80% để mở khóa rương thưởng XP và giữ vững
                chuỗi luyện tập cá nhân.
              </small>
            </div>
          </div>
        </div>

        {/* Thử thách hằng ngày & 3 Rương thưởng (Giao diện sáng, tương phản cao) */}
        <section
          className="gm-card"
          style={{ marginBottom: 22 }}
          aria-label="Rương thưởng và nhiệm vụ học thuật hằng ngày"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div>
              <span className="section-kicker">
                NHIỆM VỤ HỌC THUẬT HẰNG NGÀY · REWARD CHESTS
              </span>
              <h2 style={{ margin: "2px 0", fontSize: 19 }}>
                Hoàn thành bài luyện để mở Rương thưởng XP & Huy hiệu
              </h2>
            </div>
            <span className="vv-badge orange">
              🔥 Mục tiêu hôm nay: Đạt 3 ⭐ ở Thị tấu Khuông nhạc hoặc Thế bấm
              Sáo C5
            </span>
          </div>

          <div className="vv-acad-chests-grid">
            {CHESTS.map((c) => {
              const claimed = claimedChests.includes(c.key);
              return (
                <div
                  key={c.key}
                  className={`vv-acad-chest ${claimed ? "is-claimed" : ""}`}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <strong>
                        <Gift
                          size={16}
                          style={{
                            verticalAlign: "middle",
                            marginRight: 6,
                            color: claimed ? "#2b8a57" : "#d99a2b",
                          }}
                        />
                        {c.title}
                      </strong>
                      <span className="vv-badge">+{c.xp} XP</span>
                    </div>
                    <p>{c.desc}</p>
                  </div>
                  <button
                    type="button"
                    className={`button ${claimed ? "button-quiet" : "button-primary"}`}
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => claimChest(c)}
                    disabled={claimed}
                  >
                    {claimed ? (
                      <>
                        <CheckCircle2 size={15} /> Đã nhận thưởng (+{c.xp} XP)
                      </>
                    ) : (
                      <>
                        <Gift size={15} /> Mở Rương Thưởng Ngay
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Danh sách 6 Trò chơi học thuật */}
        <div className="vv-acad-games-grid">
          {GAMES.map((g) => {
            const Icon = g.icon;
            const isSelected = activeGame === g.id;
            return (
              <button
                key={g.id}
                type="button"
                className={`vv-acad-game-card ${isSelected ? "is-selected" : ""}`}
                onClick={() => startNewGame(g.id, difficulty)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                  }}
                >
                  <span className="vv-badge">{g.tag}</span>
                  <Icon size={18} color="#1f6f68" />
                </div>
                <strong>{g.title}</strong>
                <p>{g.subtitle}</p>
              </button>
            );
          })}
        </div>

        {/* Sân khấu thực hành tương tác */}
        <section
          className="gm-card"
          style={{ marginBottom: 24 }}
          aria-label="Sân khấu trò chơi âm nhạc"
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
              paddingBottom: 12,
              borderBottom: "1px solid var(--vv-line)",
            }}
          >
            <div>
              <span className="section-kicker">BÀI LUYỆN ĐANG MỞ</span>
              <h2 style={{ margin: "2px 0", fontSize: 20 }}>
                {currentGameInfo.title}
              </h2>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
              }}
            >
              {["easy", "medium", "hard"].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`button ${difficulty === d ? "button-primary" : "button-quiet"}`}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={() => startNewGame(activeGame, d)}
                >
                  {d === "easy"
                    ? "Cấp 1 · Dễ"
                    : d === "medium"
                      ? "Cấp 2 · Vừa"
                      : "Cấp 3 · Khó"}
                </button>
              ))}
              <button
                type="button"
                className="button button-quiet"
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => startNewGame(activeGame, difficulty)}
              >
                <Play size={14} /> Làm lại bài này
              </button>
            </div>
          </div>

          {/* Hộp kiến thức nhạc lý & sư phạm */}
          <div className="vv-acad-theory-box">
            <BookOpen
              size={15}
              style={{
                verticalAlign: "middle",
                marginRight: 6,
                color: "#1f6f68",
              }}
            />
            <strong>Kiến thức Học thuật & Sư phạm: </strong>
            {currentGameInfo.theory}
          </div>

          {/* 4 ô chỉ số học thuật */}
          <div className="vv-acad-metrics-row">
            <div className="vv-acad-metric-box">
              <small>Điểm tích lũy</small>
              <strong style={{ color: "#1f6f68" }}>{score}</strong>
            </div>
            <div className="vv-acad-metric-box">
              <small>Chuỗi đúng liên tiếp</small>
              <strong style={{ color: "#2b8a57" }}>x{combo}</strong>
            </div>
            <div className="vv-acad-metric-box">
              <small>Tiến độ & Độ chính xác</small>
              <strong>
                {round}/{maxRounds}{" "}
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "#4a5a6a" }}
                >
                  ({accuracyNow}%)
                </span>
              </strong>
            </div>
            <div className="vv-acad-metric-box">
              <small>Đánh giá Sao</small>
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                {[1, 2, 3].map((st) => {
                  const earned =
                    (st === 1 && score >= 300) ||
                    (st === 2 && score >= 600) ||
                    (st === 3 && score >= 850);
                  return (
                    <Star
                      key={st}
                      size={20}
                      color={earned ? "#d99a2b" : "#cbd5e1"}
                      fill={earned ? "#d99a2b" : "none"}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sân khấu âm nhạc (Nền tối tương phản cao #0d1627 + chữ trắng sáng #f8fafc) */}
          <div className="vv-acad-stage">
            {activeGame === "falling_notes" && (
              <div>
                <p style={{ margin: "0 0 12px", fontSize: 14 }}>
                  Nốt mục tiêu đang rơi xuống vạch sáng:{" "}
                  <strong style={{ color: "#38bdf8", fontSize: 18 }}>
                    {currentNote.name}
                  </strong>{" "}
                  (Phím tắt máy tính: <kbd>{currentNote.keyHint}</kbd>). Chạm
                  đúng cột phím bên dưới:
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, minmax(42px, 1fr))",
                    gap: 8,
                    height: 156,
                    padding: 10,
                    borderRadius: 12,
                    background: "linear-gradient(180deg, #091020, #13223e)",
                    alignItems: "end",
                  }}
                >
                  {SOLFEGE.map((n, idx) => {
                    const isTarget = idx === targetIdx;
                    return (
                      <div
                        key={n.name}
                        style={{
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderRight: "1px solid rgba(148,163,184,0.2)",
                        }}
                      >
                        <div
                          style={{
                            marginTop: isTarget ? 42 : 8,
                            padding: "8px 6px",
                            borderRadius: 8,
                            background: isTarget
                              ? "linear-gradient(180deg, #06b6d4, #10b981)"
                              : "rgba(30,41,59,0.5)",
                            color: "#f8fafc",
                            fontWeight: 700,
                            fontSize: 12,
                            boxShadow: isTarget
                              ? "0 0 16px rgba(6,182,212,0.65)"
                              : "none",
                          }}
                        >
                          {isTarget ? `⬇ ${n.short}` : "·"}
                        </div>
                        <button
                          type="button"
                          className="vv-acad-answer-btn"
                          style={{
                            width: "100%",
                            borderColor: isTarget ? "#06b6d4" : "#334155",
                            background: isTarget ? "#0e7490" : "#162238",
                          }}
                          onClick={() =>
                            handleAnswer(idx === targetIdx, `Phím ${n.name}`)
                          }
                        >
                          <span>{n.short}</span>
                          <kbd>{n.keyHint}</kbd>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeGame === "ear_training" && (
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 12px", fontSize: 14 }}>
                  Bấm <strong>Nghe lại âm mẫu</strong> rồi chọn đúng bậc âm
                  Solfège bạn vừa nghe (hoặc bấm phím <code>1 – 7</code>):
                </p>
                <button
                  type="button"
                  className="button button-primary"
                  style={{ marginBottom: 16 }}
                  onClick={() => playTone(audioRef, currentNote.midi, 0.55)}
                >
                  <Volume2 size={16} /> Nghe âm thanh nốt (#{round})
                </button>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
                    gap: 8,
                  }}
                >
                  {SOLFEGE.map((n, idx) => (
                    <button
                      key={n.name}
                      type="button"
                      className="vv-acad-answer-btn"
                      onClick={() => handleAnswer(idx === targetIdx, n.name)}
                    >
                      <span>{n.name}</span>
                      <kbd>{n.keyHint}</kbd>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeGame === "staff_reader" && (
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 10px", fontSize: 14 }}>
                  Quan sát vị trí nốt trên khuông nhạc khoá Sol (𝄞) và chọn tên
                  nốt tương ứng:
                </p>
                <svg
                  width="100%"
                  height="130"
                  viewBox="0 0 420 130"
                  style={{
                    maxWidth: 420,
                    background: "#111927",
                    borderRadius: 10,
                    marginBottom: 14,
                    border: "1px solid #334155",
                  }}
                >
                  {[0, 1, 2, 3, 4].map((line) => (
                    <line
                      key={line}
                      x1="40"
                      x2="390"
                      y1={95 - line * 14}
                      y2={95 - line * 14}
                      stroke="#94a3b8"
                      strokeWidth="1.2"
                    />
                  ))}
                  <text x="52" y="88" fill="#38bdf8" fontSize="48">
                    𝄞
                  </text>
                  {targetIdx === 0 && (
                    <line
                      x1="194"
                      x2="226"
                      y1="109"
                      y2="109"
                      stroke="#e2e8f0"
                      strokeWidth="1.6"
                    />
                  )}
                  <ellipse
                    cx="210"
                    cy={109 - targetIdx * 7}
                    rx="10"
                    ry="7"
                    fill="#38bdf8"
                  />
                </svg>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
                    gap: 8,
                  }}
                >
                  {SOLFEGE.map((n, idx) => (
                    <button
                      key={n.name}
                      type="button"
                      className="vv-acad-answer-btn"
                      onClick={() => handleAnswer(idx === targetIdx, n.name)}
                    >
                      <span>{n.name}</span>
                      <kbd>{n.keyHint}</kbd>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeGame === "rhythm_tap" && (
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 12px", fontSize: 14 }}>
                  Tốc độ chuẩn:{" "}
                  <strong style={{ color: "#38bdf8" }}>
                    {difficulty === "hard"
                      ? "120 BPM (Allegro)"
                      : difficulty === "medium"
                        ? "90 BPM (Moderato)"
                        : "72 BPM (Andante)"}
                  </strong>
                  . Cảm nhận 4 phách trong ô nhịp rồi gõ đúng phách mạnh!
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  {[1, 2, 3, 4].map((b) => (
                    <div
                      key={b}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        background:
                          (round % 4) + 1 === b
                            ? "#06b6d4"
                            : "rgba(30,41,59,0.85)",
                        color: (round % 4) + 1 === b ? "#04131d" : "#e2e8f0",
                        border: "1px solid #38bdf8",
                      }}
                    >
                      {b}
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    className="vv-acad-answer-btn"
                    onClick={() => playTone(audioRef, 72, 0.15)}
                  >
                    <Volume2 size={15} /> Nghe tiếng Click mẫu
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    style={{
                      minHeight: 48,
                      padding: "10px 24px",
                      fontSize: 15,
                    }}
                    onClick={() =>
                      handleAnswer(true, "Gõ trúng tâm phách (±18ms)")
                    }
                  >
                    🥁 GÕ PHÁCH NGAY (TAP BEAT)
                  </button>
                </div>
              </div>
            )}

            {activeGame === "song_quiz" && (
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 12px", fontSize: 14 }}>
                  Nghe 6 nốt chủ đề mở đầu (Motif) và chọn đúng tên tác phẩm âm
                  nhạc:
                </p>
                <button
                  type="button"
                  className="button button-primary"
                  style={{ marginBottom: 16 }}
                  onClick={() => {
                    currentSong.notes.forEach((m, idx) => {
                      setTimeout(() => playTone(audioRef, m, 0.28), idx * 240);
                    });
                  }}
                >
                  <Volume2 size={16} /> Nghe lại câu dạo đầu (#{round})
                </button>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                    gap: 10,
                  }}
                >
                  {SONG_QUIZ_BANK.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      className="vv-acad-answer-btn"
                      style={{ justifyContent: "space-between" }}
                      onClick={() => handleAnswer(idx === quizSongIdx, s.title)}
                    >
                      <span>{s.title}</span>
                      <small style={{ color: "#38bdf8" }}>{s.genre}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeGame === "flute_fingering" && (
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 10px", fontSize: 14 }}>
                  Nốt Sáo trúc C5 cần bấm:{" "}
                  <strong style={{ color: "#38bdf8", fontSize: 18 }}>
                    {currentNote.name.replace("4", "5")}
                  </strong>{" "}
                  (Thế bấm chuẩn <code>FluteChart</code>:{" "}
                  <code>{currentNote.holes}</code>). Chọn đúng sơ đồ 6 lỗ bên
                  dưới:
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 10,
                    marginBottom: 14,
                    flexWrap: "wrap",
                  }}
                >
                  {fluteHoles.map((closed, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Lỗ bấm ${i + 1}`}
                      onClick={() =>
                        setFluteHoles((prev) =>
                          prev.map((v, idx) => (idx === i ? !v : v)),
                        )
                      }
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        border: "2px solid #38bdf8",
                        background: closed ? "#06b6d4" : "#0f172a",
                        color: closed ? "#04131d" : "#f8fafc",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {closed ? "●" : "○"}
                    </button>
                  ))}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 8,
                  }}
                >
                  {SOLFEGE.map((n, idx) => (
                    <button
                      key={n.name}
                      type="button"
                      className="vv-acad-answer-btn"
                      onClick={() =>
                        handleAnswer(
                          idx === targetIdx,
                          `${n.name.replace("4", "5")} (${n.holes})`,
                        )
                      }
                    >
                      <span>
                        <strong>{n.holes}</strong> ({n.short}5)
                      </span>
                      <kbd>{n.keyHint}</kbd>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div
            role="status"
            className="gm-nudge"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              fontWeight: 600,
            }}
          >
            <span>{statusMsg}</span>
            {finishedResult && (
              <span className="vv-badge">
                <Award size={15} /> Đạt {finishedResult.stars} ⭐ · +
                {finishedResult.xp} XP ({finishedResult.accuracyPct}% chính xác)
              </span>
            )}
          </div>
        </section>

        {/* Bảng thành tích & thử thách tuần */}
        <section
          className="gm-card"
          aria-label="Bảng thành tích học thuật tuần này"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div>
              <span className="section-kicker">
                BẢNG VÀNG HỌC THUẬT · KẾT QUẢ THỰC HÀNH TUẦN NÀY
              </span>
              <h2 style={{ margin: "2px 0", fontSize: 19 }}>
                Top Kết Quả Thực Hành Kỹ Năng Âm Nhạc
              </h2>
            </div>
            <Trophy size={24} color="#d99a2b" />
          </div>

          <div className="vv-table-wrap">
            <table className="vv-table">
              <thead>
                <tr>
                  <th scope="col">Hạng</th>
                  <th scope="col">Học viên</th>
                  <th scope="col">Bài luyện kỹ năng</th>
                  <th scope="col">Cấp độ</th>
                  <th scope="col">Điểm số</th>
                  <th scope="col">Sao & XP</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.slice(0, 10).map((row, i) => (
                  <tr key={row.id || i}>
                    <td>
                      <strong>#{i + 1}</strong>
                    </td>
                    <td>{row.player}</td>
                    <td>
                      {GAMES.find((g) => g.id === row.gameId)?.title ||
                        row.gameId}
                    </td>
                    <td>
                      {row.difficulty === "hard"
                        ? "Cấp 3 · Khó"
                        : row.difficulty === "medium"
                          ? "Cấp 2 · Vừa"
                          : "Cấp 1 · Dễ"}
                    </td>
                    <td>
                      <strong>{row.score}</strong>
                    </td>
                    <td>
                      {"⭐".repeat(row.stars || 3)} (+{row.xp || 30} XP)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      {account ? (
        <div className="product-footer">
          VocaVerse Academic Arcade · Luyện phản xạ nhạc lý & thính giác chuẩn
          sư phạm
        </div>
      ) : (
        <PublicFooter />
      )}
    </div>
  );
}
