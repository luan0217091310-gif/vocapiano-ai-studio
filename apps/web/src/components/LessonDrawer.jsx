import {
  ChevronRight,
  Music2,
  Piano,
  Search,
  Star,
  Wind,
  X,
} from "lucide-react";
import { useState } from "react";
export default function LessonDrawer({ s, controller: c, close }) {
  const [filter, setFilter] = useState("piano"),
    [search, setSearch] = useState(""),
    [tab, setTab] = useState("starter"),
    [songDiff, setSongDiff] = useState(s.songDifficulty || "medium");
  const lessons = s.lessons.filter(
    (l) =>
      l.instrument === filter &&
      `${l.id} ${l.title}`.toLowerCase().includes(search.toLowerCase()),
  );
  const fullSongs = (s.localSongs || []).filter((song) =>
    `${song.id} ${song.title} ${song.artist} ${song.genre} ${song.theme}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const mySongs = (s.userSongs || []).filter((song) =>
    `${song.code} ${song.title} ${song.artist}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <button
        className="drawer-backdrop"
        onClick={close}
        aria-label="Đóng thư viện"
      />
      <aside
        className="lesson-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Thư viện bài tập"
      >
        <div className="drawer-heading">
          <div className="eyebrow">HÀNH TRÌNH ÂM NHẠC</div>
          <button
            onClick={close}
            className="icon-button"
            aria-label="Đóng thư viện"
          >
            <X size={20} />
          </button>
        </div>
        <h2>Chọn một giai điệu.</h2>
        <p className="muted">Từng nốt nhỏ, một hành trình lớn.</p>
        <label className="search-input">
          <Search size={17} />
          <input
            placeholder="Tìm bài học…"
            aria-label="Tìm bài học"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="instrument-filters">
          <button
            className={filter === "piano" ? "active" : ""}
            onClick={() => setFilter("piano")}
          >
            <Piano size={16} />
            Piano
          </button>
          <button
            className={filter === "sao_truc" ? "active" : ""}
            onClick={() => setFilter("sao_truc")}
          >
            <Wind size={16} />
            Sáo trúc
          </button>
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setTab("starter")}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              border: "1px solid #334155",
              background: tab === "starter" ? "#06B6D4" : "#0F172A",
              color: tab === "starter" ? "#04131D" : "#CBD5E1",
              cursor: "pointer",
            }}
          >
            Cơ bản ({lessons.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("full")}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              border: "1px solid #334155",
              background: tab === "full" ? "#06B6D4" : "#0F172A",
              color: tab === "full" ? "#04131D" : "#CBD5E1",
              cursor: "pointer",
            }}
          >
            Trọn bài ({fullSongs.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("user")}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              border: "1px solid #334155",
              background: tab === "user" ? "#06B6D4" : "#0F172A",
              color: tab === "user" ? "#04131D" : "#CBD5E1",
              cursor: "pointer",
            }}
          >
            Bài của tôi ({mySongs.length})
          </button>
        </div>
        {tab !== "starter" && (
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              marginBottom: 8,
              fontSize: 12,
            }}
          >
            <span className="muted">Độ khó:</span>
            {["easy", "medium", "hard"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSongDiff(d)}
                style={{
                  padding: "3px 10px",
                  borderRadius: 99,
                  border: "1px solid #334155",
                  background: songDiff === d ? "#10B981" : "#0F172A",
                  color: songDiff === d ? "#04131D" : "#CBD5E1",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {d === "easy" ? "Dễ" : d === "medium" ? "Vừa" : "Khó"}
              </button>
            ))}
          </div>
        )}
        <div className="drawer-lessons">
          {tab === "starter" &&
            lessons.map((l) => {
              const attempts = s.history.filter(
                (h) =>
                  h.lesson === l.id &&
                  h.source !== "demo" &&
                  h.practice !== "wait",
              );
              const totalNotes = l.score.parts.reduce(
                (sum, part) => sum + part.notes.length,
                0,
              );
              const best = attempts.length
                ? Math.min(
                    1,
                    Math.max(
                      ...attempts.map((h) =>
                        totalNotes ? h.correct / totalNotes : 0,
                      ),
                    ),
                  )
                : 0;
              const stars =
                best >= 0.95 ? 3 : best >= 0.8 ? 2 : best >= 0.6 ? 1 : 0;
              return (
                <button
                  key={l.id}
                  className={`lesson-card ${s.lesson?.id === l.id ? "selected" : ""}`}
                  data-lesson={l.id}
                  onClick={() => {
                    c.selectLesson(l);
                    close();
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="lesson-code">{l.id}</span>
                    <span className="difficulty">
                      {l.score.parts[0].level === "beginner" ? "Cơ bản" : "Dễ"}
                    </span>
                  </div>
                  <strong>
                    {l.title.replace(/^(PN|SA)\d+\s*[—–-]\s*/, "")}
                  </strong>
                  <div className="lesson-progress">
                    <span style={{ width: `${best * 100}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className="stars"
                      aria-label={`${stars} sao luyện tập tham khảo`}
                    >
                      {[1, 2, 3].map((n) => (
                        <Star
                          key={n}
                          size={12}
                          fill={stars >= n ? "currentColor" : "none"}
                          className={stars >= n ? "earned" : ""}
                        />
                      ))}
                    </span>
                    <small>
                      {attempts.length
                        ? `${Math.round(best * 100)}% nốt khớp`
                        : "Chưa luyện"}
                      <ChevronRight size={12} />
                    </small>
                  </div>
                </button>
              );
            })}
          {tab === "full" &&
            fullSongs.map((song) => (
              <button
                key={song.id}
                type="button"
                className={`lesson-card ${s.lesson?.id === song.id ? "selected" : ""}`}
                onClick={() => {
                  c.selectCatalogSong(song, filter, songDiff);
                  close();
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="lesson-code">
                    {song.id} · {song.genre}
                  </span>
                  <span className="difficulty">{song.bpm} BPM · 20 ô</span>
                </div>
                <strong>{song.title}</strong>
                <div
                  className="flex items-center justify-between"
                  style={{ marginTop: 4 }}
                >
                  <small className="muted">
                    {song.artist} · Chủ đề: {song.theme}
                  </small>
                  <small style={{ color: "#38BDF8" }}>
                    {filter === "piano" ? "Piano" : "Sáo C5"} (
                    {songDiff === "easy"
                      ? "Dễ"
                      : songDiff === "medium"
                        ? "Vừa"
                        : "Khó"}
                    ) <ChevronRight size={12} />
                  </small>
                </div>
              </button>
            ))}
          {tab === "user" &&
            mySongs.map((song) => (
              <button
                key={song.code}
                type="button"
                className={`lesson-card ${s.lesson?.id === song.code ? "selected" : ""}`}
                onClick={() => {
                  c.selectCatalogSong(song, filter, songDiff);
                  close();
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="lesson-code">
                    {song.code} · {song.genre}
                  </span>
                  <span className="difficulty">{song.bpm} BPM · 20 ô</span>
                </div>
                <strong>{song.title}</strong>
                <small
                  style={{ color: "#FCD34D", display: "block", marginTop: 4 }}
                >
                  ⚠ {song.qualityNote}
                </small>
              </button>
            ))}
          {tab === "starter" && !lessons.length && (
            <p className="muted">Chưa thấy bài phù hợp.</p>
          )}
          {tab === "full" && !fullSongs.length && (
            <p className="muted">Chưa thấy bài hát trọn bài phù hợp.</p>
          )}
          {tab === "user" && !mySongs.length && (
            <p className="muted">
              Bạn chưa nhập bài nào. Hãy bấm nút "Nhập nhạc" trên thanh hướng
              dẫn để chuyển link hoặc file MP3/WAV/MIDI thành bản nhạc Piano &
              Sáo C5!
            </p>
          )}
        </div>
        <div className="drawer-footer">
          <Music2 size={16} />
          <span>
            Tiến độ trên thiết bị này
            <br />
            <small>Mô phỏng không tính vào tiến độ.</small>
          </span>
        </div>
      </aside>
    </>
  );
}
