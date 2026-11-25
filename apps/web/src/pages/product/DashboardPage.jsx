import { useEffect, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  Clock3,
  Crown,
  Gamepad2,
  Layers,
  Music2,
  Piano,
  Play,
  Sparkles,
  Star,
  Target,
  Upload,
  Wind,
} from "lucide-react";
import { api } from "../../api/client.js";
import { readProductState } from "../../productStore.js";
import {
  BadgesCard,
  ChecklistCard,
  LevelCard,
  WeeklyGoalCard,
} from "../../components/ProgressPanels.jsx";
import MusicImporterModal from "../../components/MusicImporterModal.jsx";
import AiTutorChatPanel from "../../components/AiTutorChatPanel.jsx";
import { ErrorState, Skeleton, useApi } from "../../ui/index.jsx";
import { vnDay } from "../../vnDay.js";
import { t } from "../../i18n/index.js";
import { ProductNav } from "./ProductNav.jsx";

const LESSON_TITLES = {
  PN01: "PN01 · Năm nốt Đô–Sol tay phải & neo Đô giữa",
  PN02: "PN02 · Bước liền bậc tay phải Đô–Sol",
  PN03: "PN03 · Giai điệu mở đầu & giữ phách đều",
  PN04: "PN04 · Tay trái neo Đô3–Sol3",
  PN05: "PN05 · Phối hợp hai tay cơ bản",
  PN06: "PN06 · Kiểm tra lưu giữ 1 (Thị tấu & Nhịp)",
  SA01: "SA01 · Âm đầu tiên & khẩu hình Sáo trúc C5",
  SA02: "SA02 · Thế bấm Sol5 – La5 – Si5",
  SA03: "SA03 · Bài luyện hơi đều Sáo trúc 03",
  TS01: "TS01 · Nơi Này Có Anh (Acoustic Ballad · 20 ô nhịp)",
  TS04: "TS04 · Nàng Thơ (Acoustic Ballad · 20 ô nhịp)",
  TS09: "TS09 · Diễm Xưa (Nhạc Trịnh · 20 ô nhịp)",
  TS15: "TS15 · Quê Hương (Dân ca & Sáo C5 · 20 ô nhịp)",
  TS25: "TS25 · See Tình (Pop Việt · 20 ô nhịp)",
  TS26: "TS26 · Để Mị Nói Cho Mà Nghe (Sáo trúc C5 · 20 ô nhịp)",
  TS32: "TS32 · River Flows in You (Piano · 20 ô nhịp)",
};

const labelFor = (id) => LESSON_TITLES[id] ?? id ?? "Bài học";

/** Số lượt mỗi ngày trong 7 ngày gần nhất (giờ Việt Nam) từ lịch sử máy chủ. */
function getDays(sessions) {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    const key = vnDay(d);
    out.push({
      key,
      label: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][
        new Date(`${key}T00:00:00Z`).getUTCDay()
      ],
      count: sessions.filter((s) => s.day === key).length,
    });
  }
  return { days: out };
}

export function DashboardPage() {
  const progressQ = useApi(() => api.get("/me/progress"));
  const sessionsQ = useApi(() => api.get("/me/sessions?pageSize=100"));
  const [importerOpen, setImporterOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      progressQ.reload();
      sessionsQ.reload();
    };
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const progress = progressQ.data;
  const valid = sessionsQ.data ?? [];
  const state = readProductState(),
    last = state.lastLesson || valid[0]?.lessonId || "PN06",
    stats = getDays(valid);
  const isFluteLast =
    String(last).startsWith("SA") ||
    last === "TS26" ||
    last === "TS15" ||
    state.onboarding?.instrument === "sao_truc";
  const isFullSongLast =
    String(last).startsWith("TS") || String(last).startsWith("USR");
  const planName =
    state.account?.plan === "plus"
      ? "Gói Plus"
      : state.account?.plan === "founder"
        ? "Gói Sáng lập"
        : state.account?.plan === "studio"
          ? "Phòng đàn B2B"
          : state.account?.plan === "starter"
            ? "Gói Khởi động"
            : "Gói Miễn phí (Free)";

  const accuracy = valid.length
    ? Math.round(
        (valid.reduce((n, s) => n + s.accuracy, 0) / valid.length) * 100,
      )
    : null;
  const max = Math.max(1, ...stats.days.map((d) => d.count));
  const name = state.account?.name
    ?.replace(/^\[Mẫu\]\s*/, "")
    .replace(/\s*\(.*\)$/, "");
  return (
    <div className="product-shell">
      <ProductNav active="dashboard" />
      <main className="dashboard-main vv-page-enter">
        <section className="dashboard-greeting vv-page-hero">
          <div>
            <span className="section-kicker">{t("db.kicker")}</span>
            <h1>{t("db.hello", { name: name || t("db.you") })}</h1>
            <p>{t("db.sub")}</p>
            <div className="vv-page-hero-pills">
              <span className="vv-page-hero-pill">
                <Crown size={13} /> <strong>{planName}</strong>
              </span>
              <span className="vv-page-hero-pill">
                {isFluteLast ? <Wind size={13} /> : <Piano size={13} />}{" "}
                <strong>{isFluteLast ? "Sáo trúc C5" : "Đàn Piano"}</strong>
              </span>
              <span className="vv-page-hero-pill">
                🎼 <strong>284+</strong> Học phần · <strong>36</strong> Trọn bài
                20 ô
              </span>
              <span className="vv-page-hero-pill">
                🤖 Gia sư AI <strong>24 thẻ</strong>
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
            }}
          >
            <button
              type="button"
              className="button button-primary"
              onClick={() => setImporterOpen(true)}
            >
              <Upload size={15} /> Nhập Link / File Nhạc AI
            </button>
            <button
              type="button"
              className="button button-quiet"
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "#f8fafc",
                borderColor: "rgba(255,255,255,0.24)",
              }}
              onClick={() => setAiModalOpen(true)}
            >
              <Bot size={15} /> Hỏi Gia sư AI & Sổ tay
            </button>
            <a className="button button-primary" href="/library">
              {t("db.pick")} <ArrowRight size={16} />
            </a>
          </div>
        </section>

        <section className="continue-card">
          <div className="continue-art">
            <span className="music-orbit orbit-a" />
            <span className="music-orbit orbit-b" />
            {isFluteLast ? <Wind size={72} /> : <Piano size={72} />}
            <i>♪</i>
            <b>♫</b>
          </div>
          <div className="continue-copy">
            <span className="continue-label">
              <span className="status-pip" /> BÀI ĐANG HỌC & SÂN KHẤU PHÒNG
              LUYỆN
            </span>
            <h2>{labelFor(last)}</h2>
            <p>
              {valid.some((s) => s.lessonId === last)
                ? "Tiếp tục từ bài bạn luyện gần nhất với đầy đủ chế độ Thác nốt rơi, Khuông nhạc đôi và tua tốc độ 25%–150%."
                : "Mở ngay Phòng luyện tương tác để tập từng câu hoặc chơi trọn bài 20 ô nhịp (Intro → Verse → Chorus → Bridge → Outro)."}
            </p>
            <div className="continue-meta">
              <span>
                <Clock3 size={14} /> {isFullSongLast ? "74–92 BPM" : "72 BPM"}
              </span>
              <span>
                <Music2 size={14} />{" "}
                {isFluteLast ? "Sáo trúc C5 · 6 lỗ" : "Đàn Piano · 2 tay"}
              </span>
              <span>
                <BookOpen size={14} />{" "}
                {isFullSongLast ? "20 ô nhịp · 5 đoạn" : "8 ô nhịp · Chuẩn"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 10,
              }}
            >
              <a
                className="button button-primary"
                href={`/studio?lesson=${encodeURIComponent(last)}`}
              >
                Vào phòng luyện <Play size={15} fill="currentColor" />
              </a>
              <a
                className="button button-quiet"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  color: "#f8fafc",
                  borderColor: "rgba(148,163,184,0.3)",
                }}
                href="/studio?lesson=TS01&inst=piano&diff=medium"
              >
                🎹 Trọn bài Piano (TS01)
              </a>
              <a
                className="button button-quiet"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  color: "#f8fafc",
                  borderColor: "rgba(148,163,184,0.3)",
                }}
                href="/studio?lesson=TS26&inst=sao_truc&diff=medium"
              >
                🪈 Trọn bài Sáo C5 (TS26)
              </a>
            </div>
          </div>
          <div className="continue-side">
            <div className="mini-score">
              <strong>{accuracy === null ? "—" : `${accuracy}%`}</strong>
              <small>
                độ chính xác <br />
                trung bình
              </small>
            </div>
            <span>Tính trên các lượt đã lưu vào tài khoản</span>
          </div>
        </section>

        <WeeklyGoalCard
          progress={progress}
          sessions={valid}
          lastLesson={last}
          today={vnDay()}
        />

        <section className="dashboard-metrics">
          <article>
            <span className="metric-icon mint">
              <Target size={17} />
            </span>
            <div>
              <small>Lượt tự luyện</small>
              <strong>
                {progress ? (
                  progress.totals.sessions
                ) : (
                  <Skeleton w={40} h={24} />
                )}
              </strong>
              <span>
                {progress
                  ? `${Math.round(progress.totals.seconds / 60)} phút luyện tập`
                  : "Đang tải…"}
              </span>
            </div>
          </article>
          <article>
            <span className="metric-icon lilac">
              <AudioLines size={17} />
            </span>
            <div>
              <small>Độ chính xác</small>
              <strong>{accuracy === null ? "Chưa có" : `${accuracy}%`}</strong>
              <span>
                {accuracy === null
                  ? "Hoàn thành lượt đầu để xem"
                  : "Trung bình các lượt có chấm"}
              </span>
            </div>
          </article>
          <article>
            <span className="metric-icon peach">
              <Star size={17} />
            </span>
            <div>
              <small>Chuỗi ngày tập</small>
              <strong>
                {progress ? (
                  `${progress.streak.current} ngày`
                ) : (
                  <Skeleton w={60} h={24} />
                )}
              </strong>
              <span>
                {progress ? `Kỷ lục ${progress.streak.best} ngày` : "Đang tải…"}
              </span>
            </div>
          </article>
        </section>

        <section
          aria-label="Bản đồ học thuật và tiện ích trung tâm"
          style={{ marginTop: 22, marginBottom: 22 }}
        >
          <div className="vv-bento-grid">
            <article className="vv-bento-card">
              <div className="vv-bento-head teal">
                <span className="vv-bento-icon">
                  <Layers size={20} />
                </span>
                <div>
                  <span className="vv-bento-badge">
                    LỘ TRÌNH HỌC THUẬT 3 CẤP ĐỘ
                  </span>
                  <h3>Từ Nhập môn đến Chơi trọn bài 20 ô nhịp</h3>
                </div>
              </div>
              <div className="vv-bento-body">
                <p>
                  Hệ thống phân tầng rõ ràng cho cả Đàn Piano và Sáo trúc C5 để
                  bạn biết chính xác mình đang ở đâu và cần mở khóa kỹ năng gì
                  tiếp theo:
                </p>
                <ul className="vv-bento-list">
                  <li>
                    <Check size={15} />
                    <span>
                      <strong>Cấp 1 · Nhập môn (70 bài):</strong> Tư thế tay,
                      neo Đô giữa (PN01–PN04), khẩu hình &amp; hơi đều Sáo C5
                      (SA01–SA03).
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      <strong>Cấp 2 · Cơ bản (86 bài):</strong> Phối hợp 2 tay
                      độc lập, âm giai Đô trưởng / La thứ, 16 bài cổ điển Public
                      Domain.
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      <strong>Cấp 3 · Tự tin &amp; Trọn bài (128 bài):</strong>{" "}
                      36 ca khúc hoàn chỉnh 5 đoạn (Intro → Outro) với 3 độ khó
                      Dễ · Vừa · Khó.
                    </span>
                  </li>
                </ul>
                <div className="vv-bento-actions">
                  <a className="button button-primary" href="/library">
                    Mở Thư viện 284+ bài <ArrowRight size={15} />
                  </a>
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => setImporterOpen(true)}
                  >
                    <Upload size={14} /> Nhập nhạc AI
                  </button>
                </div>
              </div>
            </article>

            <article className="vv-bento-card">
              <div className="vv-bento-head gold">
                <span className="vv-bento-icon amber">
                  <Gamepad2 size={20} />
                </span>
                <div>
                  <span className="vv-bento-badge">
                    TRUNG TÂM THỰC HÀNH &amp; GIA SƯ AI
                  </span>
                  <h3>Luyện Tai, Thị Tấu, Ghi Chú Ô Nhịp &amp; Gói Dịch Vụ</h3>
                </div>
              </div>
              <div className="vv-bento-body">
                <p>
                  Kết hợp luyện ngón trong Phòng luyện với 6 trò chơi phản xạ
                  nhạc lý, sổ tay ghi chú gắn theo từng ô nhịp và tư vấn 1-1 từ
                  Gia sư AI:
                </p>
                <ul className="vv-bento-list">
                  <li>
                    <Check size={15} />
                    <span>
                      <strong>6 Trò chơi &amp; 3 Rương XP:</strong> Nốt rơi,
                      Đoán nốt Solfège, Đọc khuông khoá Sol, Nhịp 4/4, Thế bấm
                      Sáo 6 lỗ.
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      <strong>Sổ tay Ô nhịp &amp; Gia sư AI:</strong> Chẩn đoán
                      nguyên nhân sai nhịp/cao độ theo 24 thẻ tri thức{" "}
                      <code>kb://</code>.
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      <strong>Gói học ({planName}):</strong> Mở khóa toàn bộ Tay
                      mẫu 3D, kho bài Plus và cổng Phòng đàn B2B.
                    </span>
                  </li>
                </ul>
                <div className="vv-bento-actions">
                  <a className="button button-primary" href="/games">
                    Vào 6 Trò chơi Học thuật <ArrowRight size={15} />
                  </a>
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => setAiModalOpen(true)}
                  >
                    <Bot size={14} /> Hỏi Gia sư AI
                  </button>
                  <a className="button button-quiet" href="/pricing">
                    Xem Gói học &amp; B2B
                  </a>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="dashboard-lower">
          <article className="week-card">
            <div className="card-heading">
              <div>
                <h3>Nhịp học tuần này</h3>
                <p>Số lượt luyện mỗi ngày</p>
              </div>
              <span className="chart-legend">
                <i />
                Lượt luyện
              </span>
            </div>
            <div className="week-chart">
              {stats.days.map((day) => (
                <div className="chart-day" key={day.key}>
                  <div className="chart-track">
                    <i
                      style={{
                        height: `${day.count ? Math.max(10, (day.count / max) * 100) : 4}%`,
                      }}
                      className={day.count ? "has-value" : ""}
                    />
                  </div>
                  <small>{day.label}</small>
                </div>
              ))}
            </div>
            <p className="chart-footnote">
              {sessionsQ.error
                ? "Chưa tải được lịch sử luyện tập."
                : valid.length
                  ? `${valid.length} lượt luyện gần đây đã lưu vào tài khoản.`
                  : "Bắt đầu một lượt học để bắt đầu nhịp luyện của bạn."}
            </p>
          </article>
          <article className="suggest-card">
            <span className="suggest-icon">
              <Sparkles size={18} />
            </span>
            <span className="section-kicker">GỢI Ý TIẾP THEO</span>
            <h3>
              {state.onboarding?.instrument === "sao_truc"
                ? "Khám phá sáo trúc"
                : "Làm nóng đôi tay"}
            </h3>
            <p>
              {state.onboarding?.level === "new"
                ? "Bắt đầu với bài piano cơ bản, tập chậm từng câu."
                : "Thử một đoạn ngắn và tăng tốc khi đã chắc nhịp."}
            </p>
            <a className="text-link text-link-accent" href="/library">
              Tìm bài phù hợp <ArrowRight size={15} />
            </a>
          </article>
        </section>
        <section className="gm-grid" aria-label="Thành tích">
          {progressQ.loading && <Skeleton h={180} />}
          {progressQ.error && (
            <ErrorState error={progressQ.error} onRetry={progressQ.reload} />
          )}
          {progress && (
            <>
              <ChecklistCard
                account={state.account}
                onboarding={state.onboarding}
                progress={progress}
                favorites={(state.favorites ?? []).length}
                viewed3d={Boolean(state.viewed3d)}
              />
              <LevelCard progress={progress} />
              <BadgesCard progress={progress} />
            </>
          )}
        </section>
        <section className="dashboard-bottom">
          <div>
            <span className="section-kicker">GỢI Ý CHO BẠN</span>
            <h3>Những bài học đang chờ bạn</h3>
          </div>
          <a className="text-link" href="/library">
            Xem tất cả <ArrowRight size={15} />
          </a>
          <div className="course-preview-grid">
            <a className="course-preview piano-preview" href="/studio">
              <span className="course-chip">PIANO · CƠ BẢN</span>
              <Piano size={31} />
              <strong>Giai điệu mở đầu</strong>
              <small>PN03 · Luyện nhịp và ngón</small>
              <ChevronRight size={16} />
            </a>
            <a className="course-preview flute-preview" href="/library">
              <span className="course-chip">SÁO TRÚC · KHÁM PHÁ</span>
              <Wind size={31} />
              <strong>Làm quen thế bấm</strong>
              <small>Thư viện mẫu · 10 bài</small>
              <ChevronRight size={16} />
            </a>
            <a className="course-preview studio-preview" href="/studio">
              <span className="course-chip">BÀI GỢI Ý</span>
              <Music2 size={31} />
              <strong>Kiểm tra lưu giữ 1</strong>
              <small>PN06 · 72 BPM · 8 ô</small>
              <ChevronRight size={16} />
            </a>
            <a
              className="course-preview piano-preview"
              href="/studio?lesson=TS01&inst=piano&diff=medium"
            >
              <span className="course-chip">TRỌN BÀI 20 Ô · 5 ĐOẠN</span>
              <Sparkles size={31} />
              <strong>Nơi Này Có Anh (Acoustic)</strong>
              <small>TS01 · Dễ / Vừa / Khó · Piano & Sáo C5</small>
              <ChevronRight size={16} />
            </a>
            <a className="course-preview flute-preview" href="/games">
              <span className="course-chip">THỰC HÀNH HỌC THUẬT</span>
              <Target size={31} />
              <strong>6 Trò chơi Nhạc lý & Tai nghe</strong>
              <small>Thị tấu · Cảm nhịp · Sáo 6 lỗ · Rương XP</small>
              <ChevronRight size={16} />
            </a>
            <a className="course-preview studio-preview" href="/community">
              <span className="course-chip">SỔ TAY & DIỄN ĐÀN</span>
              <BookOpen size={31} />
              <strong>Ghi chú Ô nhịp & Hỏi Gia sư AI</strong>
              <small>Hỏi đáp sư phạm & chuyên đề tuần</small>
              <ChevronRight size={16} />
            </a>
          </div>
        </section>
      </main>
      {importerOpen && (
        <MusicImporterModal
          defaultInstrument={isFluteLast ? "sao_truc" : "piano"}
          onClose={() => setImporterOpen(false)}
          onOpenInStudio={(song, inst, diff) => {
            setImporterOpen(false);
            location.href = `/studio?lesson=${encodeURIComponent(song.code)}&inst=${inst}&diff=${diff}`;
          }}
        />
      )}
      {aiModalOpen && (
        <AiTutorChatPanel
          lessonId={last}
          instrument={isFluteLast ? "sao_truc" : "piano"}
          currentBar={1}
          maxBar={20}
          onClose={() => setAiModalOpen(false)}
        />
      )}
      <div className="product-footer">
        VocaVerse · Practice Studio <span>Tiến độ đồng bộ theo tài khoản</span>
      </div>
    </div>
  );
}
