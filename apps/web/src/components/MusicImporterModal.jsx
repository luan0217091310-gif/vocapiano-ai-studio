import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileAudio,
  Link2,
  Music,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api } from "../api/client.js";
import { noteName } from "../../model.mjs";

const SAMPLE_PRESETS = [
  {
    title: "Nơi Này Có Anh (Acoustic Cover)",
    artist: "Sơn Tùng M-TP",
    genre: "Acoustic / Ballad",
    theme: "Tình yêu",
    bpm: 74,
    mode: "major",
    melodyPitches: [
      64, 67, 72, 71, 69, 67, 64, 65, 69, 67, 64, 62, 60, 62, 64, 67,
    ],
  },
  {
    title: "Nàng Thơ (Indie Acoustic Ballad)",
    artist: "Hoàng Dũng",
    genre: "Acoustic / Indie",
    theme: "Tình yêu",
    bpm: 70,
    mode: "major",
    melodyPitches: [
      64, 67, 69, 72, 71, 69, 67, 64, 65, 69, 67, 64, 62, 64, 60, 60,
    ],
  },
  {
    title: "Để Mị Nói Cho Mà Nghe (Sáo Trúc Tây Bắc)",
    artist: "DTAP / Hoàng Thùy Linh",
    genre: "Pop / Dân gian",
    theme: "Học đường",
    bpm: 92,
    mode: "major",
    melodyPitches: [
      67, 69, 72, 74, 76, 74, 72, 69, 67, 69, 72, 69, 67, 64, 62, 60,
    ],
  },
  {
    title: "Diễm Xưa (Độc Tấu Trữ Tình)",
    artist: "Trịnh Công Sơn",
    genre: "Nhạc Trịnh",
    theme: "Thư giãn",
    bpm: 62,
    mode: "minor",
    melodyPitches: [
      69, 72, 71, 69, 67, 64, 69, 71, 72, 74, 71, 69, 67, 64, 69, 69,
    ],
  },
];

export default function MusicImporterModal({
  onClose,
  onOpenInStudio,
  defaultInstrument = "piano",
}) {
  const [linkInput, setLinkInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [artistInput, setArtistInput] = useState("");
  const [genreInput, setGenreInput] = useState("Acoustic / Ballad");
  const [themeInput, setThemeInput] = useState("Tình yêu");
  const [fileInfo, setFileInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [previewInst, setPreviewInst] = useState(defaultInstrument);
  const [previewDiff, setPreviewDiff] = useState("medium");
  const [editBpm, setEditBpm] = useState(72);

  const PIPELINE_STEPS = [
    "1/6. Đang đọc luồng âm thanh / bản nhạc & kiểm tra giới hạn <= 10 phút…",
    "2/6. Đang dò nhịp (Onset Autocorrelation BPM), phách 4/4 và chia vạch ô nhịp…",
    "3/6. Đang nhận diện giọng (Key) và vòng hợp âm đệm…",
    "4/6. Đang tách nốt giai điệu chính (YIN Pitch) & lượng tử hoá theo lưới phách…",
    "5/6. Đang chia 5 đoạn cấu trúc (Intro · Verse · Chorus · Bridge · Outro)…",
    "6/6. Đang lập thế ngón Piano (1–5) & Sáo trúc C5 (6 lỗ ●○◐ FluteChart)…",
  ];

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > 45 * 1024 * 1024) {
      setError(
        "Tệp vượt quá 45MB (~10 phút nhạc). Vui lòng chọn tệp ngắn hơn.",
      );
      return;
    }
    const cleanName = file.name.replace(/\.[^.]+$/, "");
    if (!titleInput) setTitleInput(cleanName);
    let xmlText = null;
    if (/\.(musicxml|xml)$/i.test(file.name)) {
      xmlText = await file.text().catch(() => null);
    }
    setFileInfo({
      name: file.name,
      sizeKb: Math.round(file.size / 1024),
      xmlText,
      sourceKind: /\.(mid|midi|musicxml|xml)$/i.test(file.name)
        ? "midi_xml"
        : "audio_file",
    });
  }

  async function runAnalyze(preset = null) {
    setError("");
    setBusy(true);
    setStepIdx(0);
    const timer = setInterval(() => {
      setStepIdx((prev) => (prev < 5 ? prev + 1 : prev));
    }, 120);
    try {
      const payload = preset
        ? {
            title: preset.title,
            artist: preset.artist,
            genre: preset.genre,
            theme: preset.theme,
            bpm: preset.bpm,
            mode: preset.mode,
            melodyPitches: preset.melodyPitches,
            sourceKind: "preset_audio",
            durationSec: 180,
          }
        : {
            title:
              titleInput.trim() ||
              fileInfo?.name ||
              linkInput.trim() ||
              "Bản Acoustic Tự Chọn",
            artist: artistInput.trim() || "Người học VocaVerse",
            genre: genreInput,
            theme: themeInput,
            sourceRef: linkInput.trim() || fileInfo?.name || "local_import",
            sourceKind:
              fileInfo?.sourceKind || (linkInput ? "url" : "audio_file"),
            xmlText: fileInfo?.xmlText || undefined,
            durationSec: 180,
          };
      const created = await api.post("/import/analyze", payload);
      clearInterval(timer);
      setStepIdx(5);
      setResult(created);
      setEditBpm(created.bpm || 72);
    } catch (err) {
      clearInterval(timer);
      setError(err.message || "Không thể chuyển đổi tệp nhạc này.");
    } finally {
      setBusy(false);
    }
  }

  async function applyQuickEdit(patch) {
    if (!result) return;
    try {
      const updated = await api.patch(`/import/songs/${result.code}`, patch);
      setResult((prev) => ({
        ...prev,
        bpm: updated.bpm,
        arrangements: updated.arrangements,
      }));
      setEditBpm(updated.bpm);
    } catch (err) {
      setError(err.message || "Không lưu được chỉnh sửa.");
    }
  }

  const activeScore =
    result?.arrangements?.[previewInst]?.[previewDiff] ??
    result?.arrangements?.piano?.medium;
  const activeNotes = activeScore?.parts?.[0]?.notes ?? [];

  return (
    <div
      className="lesson-preview-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Nhập link hoặc file nhạc tự động ra bản đàn và sáo"
    >
      <section
        className="lesson-preview-modal vv-acad-modal-card"
        style={{
          maxWidth: 840,
          width: "94vw",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <button
          type="button"
          className="lesson-preview-close"
          aria-label="Đóng cửa sổ nhập nhạc"
          onClick={onClose}
        >
          <X size={18} />
        </button>

        <span className="section-kicker">
          CÔNG CỤ CHUYỂN NHẠC HỌC THUẬT (AUDIO / MIDI / MUSICXML → VOCASCORE
          0.1)
        </span>
        <h2 style={{ margin: "4px 0 6px" }}>
          Nhập Link hoặc Tải File Nhạc → Tự Ra Bản Đàn Piano & Sáo Trúc C5
        </h2>
        <p style={{ margin: "0 0 14px", color: "#4a5a6a", fontSize: 13.5 }}>
          Dán link nhạc (YouTube, TikTok, SoundCloud, link âm thanh/video) hoặc
          chọn tệp{" "}
          <code>.mp3, .wav, .m4a, .ogg, .flac, .mp4, .mid, .musicxml</code> (tối
          đa 10 phút). Bộ đệm âm thanh tạm được xoá ngay sau khi trích xuất nốt.
        </p>

        {error && (
          <div
            role="alert"
            style={{
              background: "#fbe9e7",
              border: "1px solid #f0c4bf",
              color: "#c2413a",
              padding: "10px 12px",
              borderRadius: 10,
              marginBottom: 12,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {!result ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <label className="vv-label">
                <span>
                  <Link2 size={14} style={{ verticalAlign: "middle" }} /> 1. Dán
                  link nhạc (YouTube / TikTok / SoundCloud / Audio)
                </span>
                <input
                  className="vv-acad-input"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="Dán link bài hát hoặc mã video cần chuyển thành nốt..."
                />
              </label>

              <label className="vv-label">
                <span>
                  <Upload size={14} style={{ verticalAlign: "middle" }} /> 2.
                  Hoặc tải tệp âm thanh / MIDI / MusicXML (≤ 10 phút)
                </span>
                <input
                  type="file"
                  className="vv-acad-input"
                  accept=".mp3,.wav,.m4a,.ogg,.flac,.mp4,.webm,.mov,.mid,.midi,.musicxml,.xml"
                  onChange={handleFileSelect}
                />
              </label>
            </div>

            {fileInfo && (
              <div className="gm-nudge" style={{ marginBottom: 12 }}>
                <FileAudio size={14} style={{ verticalAlign: "middle" }} /> Đã
                nạp tệp: <strong>{fileInfo.name}</strong> ({fileInfo.sizeKb} KB)
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <label className="vv-label">
                <span>Tên bài hát</span>
                <input
                  className="vv-acad-input"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="VD: Nàng Thơ (Acoustic)"
                />
              </label>
              <label className="vv-label">
                <span>Ca sĩ / Tác giả</span>
                <input
                  className="vv-acad-input"
                  value={artistInput}
                  onChange={(e) => setArtistInput(e.target.value)}
                  placeholder="VD: Hoàng Dũng"
                />
              </label>
              <label className="vv-label">
                <span>Thể loại</span>
                <select
                  className="vv-acad-select"
                  value={genreInput}
                  onChange={(e) => setGenreInput(e.target.value)}
                >
                  <option value="Acoustic / Ballad">Acoustic / Ballad</option>
                  <option value="Pop Việt">Pop Việt</option>
                  <option value="Nhạc Trịnh">Nhạc Trịnh</option>
                  <option value="Bolero">Bolero</option>
                  <option value="Nhạc phim">Nhạc phim</option>
                  <option value="Nhạc Tết">Nhạc Tết</option>
                </select>
              </label>
              <label className="vv-label">
                <span>Chủ đề</span>
                <select
                  className="vv-acad-select"
                  value={themeInput}
                  onChange={(e) => setThemeInput(e.target.value)}
                >
                  <option value="Tình yêu">Tình yêu</option>
                  <option value="Thư giãn">Thư giãn</option>
                  <option value="Quê hương">Quê hương</option>
                  <option value="Gia đình">Gia đình</option>
                  <option value="Học đường">Học đường</option>
                  <option value="Tết & Lễ hội">Tết & Lễ hội</option>
                </select>
              </label>
            </div>

            {busy ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "#f0f9f8",
                  border: "1px solid #bfe3de",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <strong style={{ color: "#1f6f68", fontSize: 13.5 }}>
                    {PIPELINE_STEPS[stepIdx]}
                  </strong>
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => setBusy(false)}
                  >
                    Huỷ
                  </button>
                </div>
                <div className="gm-bar">
                  <i style={{ width: `${((stepIdx + 1) / 6) * 100}%` }} />
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => runAnalyze(null)}
                >
                  <Sparkles size={16} /> Phân tích & Sinh bản nhạc Piano + Sáo
                  C5
                </button>
              </div>
            )}

            <div
              style={{
                borderTop: "1px solid var(--vv-line)",
                paddingTop: 12,
              }}
            >
              <small
                style={{
                  display: "block",
                  marginBottom: 8,
                  color: "#4a5a6a",
                  fontWeight: 600,
                }}
              >
                Hoặc thử nhanh 1 chạm với mẫu bài hát có sẵn:
              </small>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SAMPLE_PRESETS.map((p) => (
                  <button
                    key={p.title}
                    type="button"
                    className="button button-quiet"
                    style={{ fontSize: 12, padding: "6px 10px" }}
                    onClick={() => runAnalyze(p)}
                  >
                    <Music size={13} /> {p.title}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 10,
                background: "#fdeee3",
                border: "1px solid #f3c8a6",
                color: "#7c3a10",
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              <span>
                <AlertTriangle size={15} style={{ verticalAlign: "middle" }} />{" "}
                <strong>{result.qualityNote}</strong> · Đã lưu vào{" "}
                <em>"Bài của tôi"</em> (<code>{result.code}</code>) · Đã xoá tệp
                âm thanh tạm.
              </span>
              {result.outOfRangeShifted > 0 && (
                <small style={{ fontWeight: 700 }}>
                  Sáo C5: đã tự dịch quãng 8 cho {result.outOfRangeShifted} nốt
                  ngoài âm vực
                </small>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {(result.pipelineSteps || []).map((st) => (
                <div
                  key={st}
                  style={{
                    fontSize: 12,
                    padding: "7px 10px",
                    borderRadius: 8,
                    background: "#eef8f6",
                    border: "1px solid #cce5e1",
                    color: "#1f6f68",
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2
                    size={13}
                    style={{ verticalAlign: "middle", marginRight: 5 }}
                  />
                  {st}
                </div>
              ))}
            </div>

            {/* Trình sửa nhanh bản nhạc (Quick Score Editor) */}
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "#fafaf8",
                border: "1px solid var(--vv-line)",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <strong style={{ fontSize: 14.5 }}>
                  <Sliders size={14} style={{ verticalAlign: "middle" }} /> Xem
                  trước & Trình sửa nhanh ({result.title})
                </strong>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["piano", "sao_truc"].map((inst) => (
                    <button
                      key={inst}
                      type="button"
                      className={`button ${previewInst === inst ? "button-primary" : "button-quiet"}`}
                      style={{ padding: "5px 10px", fontSize: 12 }}
                      onClick={() => setPreviewInst(inst)}
                    >
                      {inst === "piano" ? "🎹 Đàn Piano" : "🪈 Sáo trúc C5"}
                    </button>
                  ))}
                  {["easy", "medium", "hard"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`button ${previewDiff === d ? "button-primary" : "button-quiet"}`}
                      style={{ padding: "5px 10px", fontSize: 12 }}
                      onClick={() => setPreviewDiff(d)}
                    >
                      {d === "easy" ? "Dễ" : d === "medium" ? "Vừa" : "Khó"}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "center",
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                <label
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span>Tốc độ (BPM):</span>
                  <input
                    type="number"
                    min="45"
                    max="180"
                    className="vv-acad-input"
                    style={{ width: 74, padding: "5px 8px" }}
                    value={editBpm}
                    onChange={(e) => setEditBpm(Number(e.target.value))}
                  />
                  <button
                    type="button"
                    className="button button-quiet"
                    style={{ padding: "5px 10px", fontSize: 12 }}
                    onClick={() => applyQuickEdit({ bpm: editBpm })}
                  >
                    Lưu BPM
                  </button>
                </label>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>Dịch giọng (Transpose):</span>
                  <button
                    type="button"
                    className="button button-quiet"
                    style={{ padding: "5px 10px", fontSize: 12 }}
                    onClick={() => applyQuickEdit({ transpose: -1 })}
                  >
                    -1 nửa cung
                  </button>
                  <button
                    type="button"
                    className="button button-quiet"
                    style={{ padding: "5px 10px", fontSize: 12 }}
                    onClick={() => applyQuickEdit({ transpose: 1 })}
                  >
                    +1 nửa cung
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(135px, 1fr))",
                  gap: 8,
                  maxHeight: 175,
                  overflowY: "auto",
                }}
              >
                {activeNotes.slice(0, 12).map((n, idx) => (
                  <div key={n.id} className="vv-acad-note-chip">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontWeight: 700,
                      }}
                    >
                      <span>
                        #{idx + 1} {noteName(n.pitch)}
                      </span>
                      <span style={{ color: "#1f6f68" }}>
                        {previewInst === "piano"
                          ? `Ngón ${n.technique?.finger ?? 1}`
                          : n.technique?.fingering}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        title="Hạ 1 nửa cung"
                        style={{ flex: 1 }}
                        onClick={() =>
                          applyQuickEdit({
                            editNote: {
                              instrument: previewInst,
                              difficulty: previewDiff,
                              noteId: n.id,
                              pitchDelta: -1,
                            },
                          })
                        }
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        title="Nâng 1 nửa cung"
                        style={{ flex: 1 }}
                        onClick={() =>
                          applyQuickEdit({
                            editNote: {
                              instrument: previewInst,
                              difficulty: previewDiff,
                              noteId: n.id,
                              pitchDelta: 1,
                            },
                          })
                        }
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        title="Xoá nốt thừa"
                        style={{ color: "#c2413a" }}
                        onClick={() =>
                          applyQuickEdit({
                            editNote: {
                              instrument: previewInst,
                              difficulty: previewDiff,
                              noteId: n.id,
                              delete: true,
                            },
                          })
                        }
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <button
                type="button"
                className="button button-quiet"
                onClick={() => setResult(null)}
              >
                Nhập bài khác
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  if (onOpenInStudio) {
                    onOpenInStudio(result, previewInst, previewDiff);
                  } else {
                    location.href = `/studio?try=1&lesson=${encodeURIComponent(result.code)}&inst=${previewInst}&diff=${previewDiff}`;
                  }
                }}
              >
                Mở ngay trong Phòng luyện (
                {previewInst === "piano" ? "Piano" : "Sáo C5"} ·{" "}
                {previewDiff === "easy"
                  ? "Dễ"
                  : previewDiff === "medium"
                    ? "Vừa"
                    : "Khó"}
                ) <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
