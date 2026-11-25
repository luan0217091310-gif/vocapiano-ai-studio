import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Clock3,
  Gamepad2,
  Heart,
  Library,
  Piano,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  Wind,
  X,
} from "lucide-react";
import { readProductState, updateProductState } from "../../productStore.js";
import { api, isLoggedIn, setFavorite, track } from "../../api/client.js";
import { ErrorState, SkeletonRows, toast } from "../../ui/index.jsx";
import VerifiedHand3D from "../../components/VerifiedHand3D.jsx";
import MusicImporterModal from "../../components/MusicImporterModal.jsx";
import MusicSkillTree from "../../components/MusicSkillTree.jsx";
import { PublicFooter, PublicHeader } from "../Shared.jsx";
import { ProductNav } from "./ProductNav.jsx";
import { t } from "../../i18n/index.js";

const FREE_PER_INSTRUMENT = 4;
const levelLabel = (level) =>
  level === "beginner"
    ? t("lib.beginner")
    : level === "intermediate"
      ? t("lib.intermediate")
      : t("lib.intro");
const starsOf = (acc) =>
  acc === undefined ? 0 : acc >= 0.95 ? 3 : acc >= 0.8 ? 2 : acc >= 0.5 ? 1 : 0;

export function LibraryPage() {
  const [lessons, setLessons] = useState([]),
    [query, setQuery] = useState(""),
    [difficulty, setDifficulty] = useState("all"),
    [previewId, setPreviewId] = useState(null),
    [instrument, setInstrument] = useState(
      readProductState().onboarding?.instrument ?? "piano",
    ),
    [favorites, setFavorites] = useState(
      () => new Set(readProductState().favorites ?? []),
    );
  const [loadState, setLoadState] = useState("loading"),
    [locked, setLocked] = useState(new Set()),
    [hand3d, setHand3d] = useState(new Set()),
    [access, setAccess] = useState("all"),
    [best, setBest] = useState(new Map()),
    [catalog, setCatalog] = useState(null),
    [catTab, setCatTab] = useState("full"),
    [localSongs, setLocalSongs] = useState([]),
    [userSongs, setUserSongs] = useState([]),
    [themeFilter, setThemeFilter] = useState("all"),
    [importerOpen, setImporterOpen] = useState(false);
  useEffect(() => {
    fetch("/api/local-songs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.songs && setLocalSongs(d.songs))
      .catch(() => {});
    fetch("/api/v1/import/songs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.data && setUserSongs(d.data))
      .catch(() => {});
    fetch("/api/catalog")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCatalog(d))
      .catch(() => {});
    fetch("/api/lessons")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((rows) => {
        setLessons(rows);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
    api
      .get("/hand3d")
      .then((rows) => setHand3d(new Set(rows.map((r) => r.lessonId))))
      .catch(() => {});
    // Điểm cao nhất mỗi bài → số sao tiến độ (chỉ khi đã đăng nhập).
    if (isLoggedIn())
      api
        .get("/me/sessions?pageSize=100")
        .then((rows) => {
          const m = new Map();
          for (const r of rows)
            m.set(r.lessonId, Math.max(m.get(r.lessonId) ?? 0, r.accuracy));
          setBest(m);
        })
        .catch(() => {});
    // Cờ khoá theo gói (khách xem như Free).
    api
      .get("/lessons")
      .then((rows) => {
        setLocked(new Set(rows.filter((r) => r.locked).map((r) => r.id)));
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!previewId) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setPreviewId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewId]);
  // Bài Plus: cùng luật với máy chủ (lessonAllowed) — Free mở 4 bài đầu của mỗi nhạc cụ theo thứ tự mã.
  const isPlusLesson = (id) => {
    const l = lessons.find((x) => x.id === id);
    const same = lessons
      .filter((x) => x.instrument === l?.instrument)
      .map((x) => x.id)
      .sort();
    return same.indexOf(id) >= FREE_PER_INSTRUMENT;
  };
  const filtered = useMemo(
    () =>
      lessons.filter(
        (l) =>
          l.instrument === instrument &&
          (difficulty === "all" || l.score.parts[0]?.level === difficulty) &&
          (access === "all" || (access === "plus") === isPlusLesson(l.id)) &&
          `${l.id} ${l.title}`.toLowerCase().includes(query.toLowerCase()),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lessons, instrument, query, difficulty, access],
  );
  async function favorite(id) {
    const on = !favorites.has(id);
    const next = new Set(favorites);
    if (on) next.add(id);
    else next.delete(id);
    setFavorites(next);
    if (!isLoggedIn()) {
      updateProductState({ favorites: [...next] });
      return;
    }
    try {
      await setFavorite(id, on);
    } catch (err) {
      setFavorites(favorites);
      toast.error(err.message);
    }
  }
  const last = readProductState().lastLesson;
  const account = Boolean(readProductState().account);
  const levels = [
    ...new Set(lessons.map((l) => l.score.parts[0]?.level).filter(Boolean)),
  ];
  return (
    <div className={account ? "product-shell" : "library-public-shell"}>
      {account ? (
        <ProductNav active="library" />
      ) : (
        <PublicHeader active="courses" />
      )}
      <main
        className={`library-main vv-page-enter ${account ? "" : "library-public-main"}`}
      >
        <div className="library-heading vv-page-hero">
          <div>
            <span className="section-kicker">{t("lib.kicker")}</span>
            <h1>{t("lib.title")}</h1>
            <p>{t("lib.desc")}</p>
            <div className="vv-page-hero-pills">
              <span className="vv-page-hero-pill">
                🎹 <strong>12</strong> Bài Piano cốt lõi (Tay mẫu 3D)
              </span>
              <span className="vv-page-hero-pill">
                🪈 <strong>10</strong> Bài Sáo trúc C5 (6 lỗ chuẩn)
              </span>
              <span className="vv-page-hero-pill">
                🎼 <strong>36</strong> Bài hát trọn bài 20 ô × 3 độ khó
              </span>
              <span className="vv-page-hero-pill">
                📚 <strong>16</strong> Bài cổ điển PD & <strong>210</strong> Bài
                tập kỹ thuật
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
            <button
              type="button"
              className="button button-primary"
              onClick={() => setImporterOpen(true)}
            >
              <Upload size={15} /> Nhập Link / File Nhạc → Tự Ra Đàn & Sáo
            </button>
            <a
              href="/games"
              className="button button-quiet"
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "#f8fafc",
                borderColor: "rgba(255,255,255,0.24)",
              }}
            >
              <Gamepad2 size={15} /> 6 Trò chơi âm nhạc
            </a>
            <a
              href={account ? "/dashboard" : "/"}
              className="text-link"
              style={{ color: "#7dd3fc" }}
            >
              {account ? t("lib.back") : t("lib.home")} <ArrowRight size={15} />
            </a>
          </div>
        </div>
        <div className="library-tools">
          <div className="instrument-tabs">
            <button
              className={instrument === "piano" ? "active" : ""}
              onClick={() => setInstrument("piano")}
            >
              <Piano size={16} /> Piano{" "}
              <small>
                {t("lib.lessons", {
                  n:
                    lessons.filter((l) => l.instrument === "piano").length ||
                    12,
                })}
              </small>
            </button>
            <button
              className={instrument === "sao_truc" ? "active" : ""}
              onClick={() => setInstrument("sao_truc")}
            >
              <Wind size={16} /> {t("lp.flute")}{" "}
              <small>
                {t("lib.lessons", {
                  n:
                    lessons.filter((l) => l.instrument === "sao_truc").length ||
                    10,
                })}
              </small>
            </button>
          </div>
          <label className="library-search">
            <Search size={17} />
            <input
              aria-label="Tìm bài học"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("lib.search")}
            />
          </label>
          <div className="library-filter">
            <span>{t("lib.level")}</span>
            <select
              aria-label="Lọc độ khó"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="all">{t("lib.allLevels")}</option>
              {levels.map((level) => (
                <option value={level} key={level}>
                  {levelLabel(level)}
                </option>
              ))}
            </select>
          </div>
          <div
            className="library-filter gx-access"
            role="group"
            aria-label={t("lib.access")}
          >
            {["all", "free", "plus"].map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={access === a}
                className={access === a ? "active" : ""}
                onClick={() => setAccess(a)}
              >
                {t(`lib.access${a[0].toUpperCase()}${a.slice(1)}`)}
              </button>
            ))}
            <span className="result-count">
              {t("lib.count", { n: filtered.length })}
            </span>
          </div>
        </div>
        {loadState === "loading" ? (
          <SkeletonRows rows={6} />
        ) : loadState === "error" ? (
          <ErrorState
            error={{
              message: t("lib.error"),
            }}
            onRetry={() => location.reload()}
          />
        ) : filtered.length ? (
          <div className="library-grid">
            {filtered.map((lesson, index) => {
              const saved = lesson.id === last;
              const favoriteOn = favorites.has(lesson.id);
              const title = lesson.title.replace(/^(PN|SA)\d+\s*[—–-]\s*/, "");
              const isFlute = lesson.instrument === "sao_truc";
              const plus = isPlusLesson(lesson.id);
              const verifier = lesson.score.license?.expert_verified_by;
              const reviewed = Boolean(verifier) && verifier !== "PENDING";
              const stars = starsOf(best.get(lesson.id));
              const bpm = Math.round(lesson.score.tempo_map?.[0]?.bpm ?? 72);
              const allNotes = lesson.score.parts.flatMap((part) => part.notes);
              const bars = Math.ceil(
                allNotes.reduce(
                  (max, note) => Math.max(max, note.tick + note.dur_tick),
                  0,
                ) /
                  (lesson.score.ppq *
                    (lesson.score.meter_map?.[0]?.numerator ?? 4)),
              );
              return (
                <article
                  className={`library-card gx-lib-card ${isFlute ? "flute" : "piano"} ${plus ? "is-plus" : "is-free"}`}
                  key={lesson.id}
                >
                  <div className="library-card-art">
                    <span className="library-card-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="library-card-tag">
                      {isFlute ? "SÁO TRÚC" : "PIANO"}
                    </span>
                    {isFlute ? (
                      <Wind size={52} />
                    ) : (
                      <div className="mini-piano-art">
                        {Array.from({ length: 13 }, (_, i) => (
                          <i
                            key={i}
                            className={
                              [1, 3, 6, 8, 10].includes(i) ? "black" : ""
                            }
                          />
                        ))}
                      </div>
                    )}
                    <button
                      className={`favorite-button ${favoriteOn ? "saved" : ""}`}
                      aria-label={
                        favoriteOn
                          ? `Bỏ yêu thích ${lesson.id}`
                          : `Yêu thích ${lesson.id}`
                      }
                      onClick={() => favorite(lesson.id)}
                    >
                      <Heart
                        size={17}
                        fill={favoriteOn ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                  <div className="library-card-body">
                    <div className="library-card-meta gx-card-tags">
                      <span>{lesson.id}</span>
                      <span>{levelLabel(lesson.score.parts[0]?.level)}</span>
                      {plus ? (
                        <span className="gx-tag plus">
                          <Lock size={11} /> {t("lib.plus")}
                        </span>
                      ) : (
                        <span className="gx-tag free">{t("lib.free")}</span>
                      )}
                      {hand3d.has(lesson.id) && (
                        <span className="gx-tag">{t("lib.hand3d")}</span>
                      )}
                    </div>
                    <h3>{title}</h3>
                    <p className="gx-card-stats">
                      <span>
                        <Clock3 size={13} /> {bpm} BPM
                      </span>
                      <span>
                        {lesson.score.meter_map?.[0]?.numerator ?? 4}/4
                      </span>
                      <span>{t("lib.notes", { n: allNotes.length })}</span>
                      <span>{t("lib.bars", { n: bars })}</span>
                    </p>
                    <div className="gx-card-row">
                      <span
                        className="gx-stars"
                        role="img"
                        aria-label={t("lib.stars", { n: stars })}
                      >
                        {[1, 2, 3].map((i) => (
                          <Star
                            key={i}
                            size={15}
                            fill={i <= stars ? "currentColor" : "none"}
                            className={i <= stars ? "on" : ""}
                          />
                        ))}
                      </span>
                      {!reviewed && (
                        <span className="gx-review" title={t("lib.reviewTip")}>
                          <ShieldCheck size={13} /> {t("lib.review")}
                        </span>
                      )}
                    </div>
                    <button
                      className="library-preview-trigger"
                      onClick={() => setPreviewId(lesson.id)}
                      aria-label={t("lib.details") + " " + lesson.id}
                    >
                      {t("lib.details")} <ChevronRight size={13} />
                    </button>
                    <div className="library-card-bottom">
                      <span>
                        {saved ? (
                          <>
                            <BadgeCheck size={14} /> {t("lib.learning")}
                          </>
                        ) : (
                          <>
                            <Clock3 size={14} /> {t("lib.notStarted")}
                          </>
                        )}
                      </span>
                      {locked.has(lesson.id) && account ? (
                        <a href="/pricing" className="library-locked">
                          {t("lib.unlock")} <ArrowRight size={15} />
                        </a>
                      ) : (
                        <a
                          href={`/studio?${account ? "" : "try=1&"}lesson=${encodeURIComponent(lesson.id)}`}
                          onClick={() => {
                            updateProductState({ lastLesson: lesson.id });
                            track("lesson.open", { lessonId: lesson.id });
                          }}
                        >
                          {account ? t("lib.open") : t("lib.try")}{" "}
                          <ArrowRight size={15} />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <Library size={30} />
            <h3>{t("lib.emptyT")}</h3>
            <p>{t("lib.emptyD")}</p>
          </div>
        )}
        {(localSongs.length > 0 || catalog?.items?.length > 0) && (
          <section
            className="gm-card"
            style={{ marginTop: 32 }}
            aria-label="Kho 36 bài hát trọn bài, bài của tôi và lộ trình 3 cấp độ"
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <span className="section-kicker">
                  KHO BÀI HÁT LỚN CHƠI TRỌN BÀI (20 Ô · 5 ĐOẠN · 3 ĐỘ KHÓ) & LỘ
                  TRÌNH KỸ THUẬT
                </span>
                <h2 style={{ margin: "4px 0" }}>
                  36 Bài Hát Trọn Bài (Ballad · Acoustic · Pop · Nhạc Trịnh ·
                  Tết), 16 Tác Phẩm PD & 210 Bài Tập (
                  {instrument === "piano" ? "Piano" : "Sáo trúc C5"})
                </h2>
                <p className="gm-muted" style={{ margin: 0 }}>
                  Mỗi bài hát có đủ 5 đoạn (Intro → Verse → Chorus → Bridge →
                  Outro), 3 độ khó (Dễ · Vừa · Khó) và chuyển đổi tức thì giữa
                  Đàn Piano & Sáo trúc C5.
                </p>
              </div>
              <div className="demo3d-toggle" role="group">
                <button
                  type="button"
                  className={catTab === "full" ? "active" : ""}
                  onClick={() => setCatTab("full")}
                >
                  Bài hát trọn bài ({localSongs.length || 36})
                </button>
                <button
                  type="button"
                  className={catTab === "user" ? "active" : ""}
                  onClick={() => setCatTab("user")}
                >
                  Bài của tôi ({userSongs.length})
                </button>
                <button
                  type="button"
                  className={catTab === "pd" ? "active" : ""}
                  onClick={() => setCatTab("pd")}
                >
                  Public Domain (16)
                </button>
                <button
                  type="button"
                  className={catTab === "ex" ? "active" : ""}
                  onClick={() => setCatTab("ex")}
                >
                  Bài tập kỹ thuật (210)
                </button>
                <button
                  type="button"
                  className={catTab === "skills" ? "active" : ""}
                  onClick={() => setCatTab("skills")}
                >
                  Cây kỹ năng (24 kb://)
                </button>
              </div>
            </div>

            {catTab === "skills" && (
              <div
                key="tab-skills"
                className="vv-tab-panel"
                style={{ marginTop: 14 }}
              >
                <MusicSkillTree />
              </div>
            )}

            {catTab === "full" && (
              <div key="tab-full" className="vv-tab-panel">
                <div
                  className="vv-acad-steps-bar"
                  style={{ marginTop: 14, marginBottom: 12 }}
                >
                  <div className="vv-acad-step-item">
                    <span className="vv-acad-step-num">1</span>
                    <div>
                      <strong>
                        Bước 1 · Nghe mẫu &amp; Xem cấu trúc 5 đoạn
                      </strong>
                      <small>
                        Mỗi bài chia rõ Intro (1–4) · Verse (5–8) · Chorus
                        (9–12) · Bridge (13–16) · Outro (17–20).
                      </small>
                    </div>
                  </div>
                  <div className="vv-acad-step-item">
                    <span className="vv-acad-step-num">2</span>
                    <div>
                      <strong>Bước 2 · Chọn cấp độ Dễ → Vừa → Khó</strong>
                      <small>
                        Dễ: giai điệu 1 tay/sáo cơ bản · Vừa: thêm nốt gốc hợp
                        âm · Khó: hợp âm rải Ballad/Acoustic.
                      </small>
                    </div>
                  </div>
                  <div className="vv-acad-step-item">
                    <span className="vv-acad-step-num">3</span>
                    <div>
                      <strong>
                        Bước 3 · Tập chậm 50% rồi ghép trọn bài 100%
                      </strong>
                      <small>
                        Dùng chế độ Thác nốt rơi hoặc Khuông nhạc đôi trong
                        Phòng luyện để đạt 3 ⭐.
                      </small>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 12,
                    alignItems: "center",
                  }}
                >
                  <small className="gm-muted">Lọc theo chủ đề:</small>
                  {[
                    "all",
                    "Tình yêu",
                    "Thư giãn",
                    "Quê hương",
                    "Gia đình",
                    "Học đường",
                    "Thiếu nhi",
                    "Tết & Lễ hội",
                    "Nhạc phim",
                  ].map((th) => (
                    <button
                      key={th}
                      type="button"
                      className={`button ${themeFilter === th ? "button-primary" : "button-quiet"}`}
                      style={{
                        minHeight: 34,
                        padding: "4px 12px",
                        fontSize: 12.5,
                      }}
                      onClick={() => setThemeFilter(th)}
                    >
                      {th === "all" ? "Tất cả chủ đề (36)" : th}
                    </button>
                  ))}
                </div>
                <div className="vv-song-grid">
                  {localSongs
                    .filter(
                      (s) =>
                        (themeFilter === "all" || s.theme === themeFilter) &&
                        `${s.id} ${s.title} ${s.artist} ${s.genre}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                    )
                    .map((song) => (
                      <article className="vv-song-card" key={song.id}>
                        <div>
                          <div className="vv-song-card-top">
                            <span className="vv-song-code">{song.id}</span>
                            <span className="vv-badge">{song.theme}</span>
                          </div>
                          <h3 style={{ marginTop: 8 }}>{song.title}</h3>
                          <div className="vv-song-meta">
                            {song.artist} · {song.genre} · {song.bpm} BPM
                          </div>
                          <div
                            className="vv-song-meta"
                            style={{ marginTop: 4, color: "#1f6f68" }}
                          >
                            Hợp âm:{" "}
                            {(song.chords || []).slice(0, 4).join(" – ")}
                          </div>
                        </div>
                        <div className="vv-song-sections" aria-label="5 đoạn">
                          <span>Intro</span>
                          <span>Verse</span>
                          <span>Chorus</span>
                          <span>Bridge</span>
                          <span>Outro</span>
                        </div>
                        <div className="vv-song-diffs">
                          {["easy", "medium", "hard"].map((d) => (
                            <a
                              key={d}
                              href={`/studio?${account ? "" : "try=1&"}lesson=${encodeURIComponent(song.id)}&inst=${instrument}&diff=${d}`}
                            >
                              {d === "easy"
                                ? "Dễ"
                                : d === "medium"
                                  ? "Vừa"
                                  : "Khó"}{" "}
                              →
                            </a>
                          ))}
                        </div>
                      </article>
                    ))}
                </div>
              </div>
            )}

            {catTab === "user" && (
              <div style={{ marginTop: 14 }}>
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
                  <p className="gm-muted" style={{ margin: 0 }}>
                    Các bài nhạc bạn tự nhập từ Link hoặc tệp
                    MP3/WAV/MIDI/MusicXML (luôn gắn nhãn{" "}
                    <em>"Bản chuyển tự động — có thể chưa chính xác"</em>).
                  </p>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setImporterOpen(true)}
                  >
                    <Sparkles size={15} /> Nhập bài nhạc mới
                  </button>
                </div>
                {userSongs.length > 0 ? (
                  <div className="vv-table-wrap">
                    <table className="vv-table">
                      <thead>
                        <tr>
                          <th scope="col">Mã</th>
                          <th scope="col">Tên bài & Nhãn chất lượng</th>
                          <th scope="col">Thể loại</th>
                          <th scope="col">Mở trong Phòng luyện</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userSongs.map((u) => (
                          <tr key={u.code}>
                            <td>
                              <strong>{u.code}</strong>
                            </td>
                            <td>
                              <div>
                                <strong>{u.title}</strong>
                              </div>
                              <small style={{ color: "#FCD34D" }}>
                                ⚠ {u.qualityNote}
                              </small>
                            </td>
                            <td>
                              {u.genre} · {u.bpm} BPM
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 6 }}>
                                {["easy", "medium", "hard"].map((d) => (
                                  <a
                                    key={d}
                                    className="button button-ghost"
                                    style={{ padding: "4px 8px", fontSize: 11 }}
                                    href={`/studio?${account ? "" : "try=1&"}lesson=${encodeURIComponent(u.code)}&inst=${instrument}&diff=${d}`}
                                  >
                                    {d === "easy"
                                      ? "Dễ"
                                      : d === "medium"
                                        ? "Vừa"
                                        : "Khó"}
                                  </a>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="gm-muted">
                    Chưa có bài nhạc cá nhân nào. Hãy bấm "Nhập bài nhạc mới" để
                    chuyển link hoặc file nhạc thành bản Đàn Piano & Sáo trúc
                    C5!
                  </p>
                )}
              </div>
            )}

            {(catTab === "pd" || catTab === "ex") && catalog?.items && (
              <div className="vv-table-wrap" style={{ marginTop: 12 }}>
                <table className="vv-table">
                  <thead>
                    <tr>
                      <th scope="col">Mã</th>
                      <th scope="col">Tên bài & Nguồn gốc</th>
                      <th scope="col">Cấp độ</th>
                      <th scope="col">Tốc độ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.items
                      .filter(
                        (x) =>
                          x.instrument === instrument &&
                          (catTab === "pd"
                            ? x.kind === "public_domain"
                            : x.kind === "exercise"),
                      )
                      .slice(0, 12)
                      .map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.id}</strong>
                          </td>
                          <td>
                            <div>{item.title}</div>
                            {item.composer && (
                              <small className="gm-muted">
                                {item.composer} (mất năm{" "}
                                {item.composerDeathYear} ≤ 1955 ·
                                pd_scope=global)
                              </small>
                            )}
                          </td>
                          <td>
                            {item.level === "beginner"
                              ? "Cấp 1 · Nhập môn"
                              : item.level === "easy"
                                ? "Cấp 2 · Cơ bản"
                                : "Cấp 3 · Tự tin"}
                          </td>
                          <td>{item.bpm} BPM</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {importerOpen && (
          <MusicImporterModal
            defaultInstrument={instrument}
            onClose={() => setImporterOpen(false)}
            onOpenInStudio={(song, inst, diff) => {
              setUserSongs((prev) => [song, ...prev]);
              setImporterOpen(false);
              location.href = `/studio?${account ? "" : "try=1&"}lesson=${encodeURIComponent(song.code)}&inst=${inst}&diff=${diff}`;
            }}
          />
        )}
      </main>
      {account && <div className="product-footer">{t("lib.footer")}</div>}
      {!account && <PublicFooter />}
      {previewId &&
        (() => {
          const lesson = lessons.find((item) => item.id === previewId);
          if (!lesson) return null;
          const notes = lesson.score.parts.flatMap((part) => part.notes);
          const lastTick = notes.reduce(
            (maxTick, note) => Math.max(maxTick, note.tick + note.dur_tick),
            0,
          );
          const beats = lesson.score.meter_map?.[0]?.numerator ?? 4;
          const bars = Math.ceil(lastTick / (lesson.score.ppq * beats));
          return (
            <div
              className="lesson-preview-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setPreviewId(null);
              }}
            >
              <section
                className="lesson-preview-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="lesson-preview-title"
              >
                <button
                  className="lesson-preview-close"
                  aria-label="Đóng xem trước"
                  onClick={() => setPreviewId(null)}
                >
                  <X size={18} />
                </button>
                <span className="section-kicker">
                  {lesson.instrument === "piano" ? "PIANO" : "SÁO TRÚC"} ·{" "}
                  {lesson.id}
                </span>
                <h2 id="lesson-preview-title">{lesson.title}</h2>
                <p>
                  Bản xem trước dùng dữ liệu nhạc hiện có. Mở Practice Studio để
                  nghe mẫu, xem nốt chạy và chọn cách luyện.
                </p>
                <div className="lesson-preview-stats">
                  <div>
                    <small>Tốc độ</small>
                    <strong>
                      {Math.round(lesson.score.tempo_map?.[0]?.bpm ?? 72)} BPM
                    </strong>
                  </div>
                  <div>
                    <small>Nhịp</small>
                    <strong>
                      {beats}/{lesson.score.meter_map?.[0]?.denominator ?? 4}
                    </strong>
                  </div>
                  <div>
                    <small>Độ dài</small>
                    <strong>{bars} ô nhịp</strong>
                  </div>
                  <div>
                    <small>Nốt</small>
                    <strong>{notes.length}</strong>
                  </div>
                  <div>
                    <small>Cấp độ</small>
                    <strong>
                      {lesson.score.parts[0]?.level === "beginner"
                        ? "Cơ bản"
                        : "Nhập môn"}
                    </strong>
                  </div>
                </div>
                {hand3d.has(lesson.id) && (
                  <VerifiedHand3D key={lesson.id} lessonId={lesson.id} />
                )}
                {lesson.instrument === "piano" && (
                  <a
                    className="motion-library-link"
                    href={"/demo-3d?lesson=" + encodeURIComponent(lesson.id)}
                  >
                    Xem kế hoạch ngón và video 3D
                  </a>
                )}
                <a
                  className="button button-primary"
                  href={"/studio?lesson=" + encodeURIComponent(lesson.id)}
                  onClick={() => updateProductState({ lastLesson: lesson.id })}
                >
                  Mở bài trong phòng tập <ArrowRight size={16} />
                </a>
              </section>
            </div>
          );
        })()}
    </div>
  );
}
