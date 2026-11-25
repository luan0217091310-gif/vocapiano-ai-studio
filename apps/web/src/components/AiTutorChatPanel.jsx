import { useEffect, useState } from "react";
import {
  BookmarkPlus,
  Bot,
  MessageSquareHeart,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { api, isLoggedIn } from "../api/client.js";

const SUGGESTED_QUESTIONS = [
  {
    q: "Vì sao mình hay sai nhịp ở ô 5–8?",
    a: "🎼 1. Nguyên lý Nhạc lý: Ô 5–8 là điểm chuyển đoạn từ Verse sang Điệp khúc, tay trái bắt đầu đổi hợp âm ở phách 1.\n🖐️ 2. Kỹ thuật Ngón: Mắt cần đọc trước (Sight-ahead) nốt gốc tay trái từ phách 4 của ô trước.\n🎯 3. Bài tập 3 bước (5 phút): (B1) Hạ tốc độ xuống 50% -> (B2) Bật lặp A–B từ ô 5 đến ô 8 -> (B3) Tập riêng ở chế độ 'Chờ đúng nốt' 2 lượt rồi mới bật nhịp thực.",
  },
  {
    q: "Cách chuyển hợp âm tay trái mượt không bị khựng?",
    a: "🎼 1. Nguyên lý Nhạc lý: Các vòng hợp âm Ballad/Acoustic (C – G – Am – F) giữ chung các nốt trụ trong thế tay.\n🖐️ 2. Kỹ thuật Ngón (Minh An): Thả lỏng cổ tay, dùng ngón 5 làm trụ cho nốt gốc và chỉ nhấc ngón vừa đủ khỏi mặt phím.\n🎯 3. Bài tập 3 bước: Tập riêng tay trái 3 lượt ở 75% tốc độ trước khi ghép hai tay.",
  },
  {
    q: "Thổi nốt Đô 6 và Rê 6 sáo trúc C5 không bị rè hoặc hụt hơi?",
    a: "🎼 1. Nguyên lý Âm học Sáo C5: Các nốt quãng 2 (Đô 6: ○●●●●●, Rê 6: ●●●●●○) cần tần số dao động cột khí gấp đôi quãng 1.\n🖐️ 2. Kỹ thuật Hơi (Gia Phong): Thu nhỏ khẩu hình môi khoảng 30%, tăng tốc độ luồng hơi (hơi gọn và tập trung hơn, không phồng má).\n🎯 3. Bài tập 3 bước: Lấy hơi sâu bằng cơ hoành ở vạch nghỉ cuối ô 4 và tập luyến mềm từ Sol 5 lên Đô 6.",
  },
  {
    q: "Nên bắt đầu tập một bài hát trọn bài 20 ô nhịp như thế nào?",
    a: "🎼 1. Phương pháp Phân đoạn (Chunking): Không tập liền 20 ô ngay từ đầu mà chia theo 5 đoạn cấu trúc (Intro · Verse · Chorus · Bridge · Outro).\n🖐️ 2. Kỹ thuật Thực hành: Bấm 'Xem mẫu' để nghe tổng thể, sau đó chọn độ khó 'Dễ' cho từng đoạn 4 ô.\n🎯 3. Lộ trình 3 bước: Chờ đúng nốt (100% đúng cao độ) -> Theo nhịp 75% -> Theo nhịp 100% để đạt 3 ⭐.",
  },
];

function buildLocalTutorReply(question, instrument, barRange) {
  const q = question.toLowerCase();
  const tutor =
    instrument === "sao_truc" ? "Gia Phong (Sáo C5)" : "Minh An (Piano)";
  if (
    q.includes("hơi") ||
    q.includes("sáo") ||
    q.includes("rè") ||
    q.includes("lỗ")
  ) {
    return `${tutor} — Hướng dẫn cho ô ${barRange}:\n• 🎼 Nhạc lý & Âm vực: Kiểm tra đúng thế bấm 6 lỗ trên FluteChart C5.\n• 🖐️ Kỹ thuật Hơi: Giữ thẳng lưng, bấm kín bụng ngón tay vào lỗ sáo và giữ luồng hơi đều.\n• 🎯 Bài tập 3 bước: Tập ở tốc độ 50% trong 3 lượt và lấy hơi đúng dấu thở cuối câu.`;
  }
  if (q.includes("hợp âm") || q.includes("tay trái") || q.includes("hai tay")) {
    return `${tutor} — Hướng dẫn cho ô ${barRange}:\n• 🎼 Nhạc lý: Xác định nốt phách 1 nơi hai tay chạm phím cùng lúc.\n• 🖐️ Kỹ thuật Ngón: Tập riêng từng tay trước khi ghép hai tay.\n• 🎯 Bài tập 3 bước: Bật chế độ 'Chờ đúng nốt' cho đoạn ô ${barRange}, sau đó tăng dần tốc độ từ 50% → 75% → 100%.`;
  }
  return `${tutor} — Gợi ý học thuật cho đoạn ô ${barRange}:\n• 🎼 Bước 1: Bấm nút nhảy đoạn để khoanh vùng đúng 4 ô nhịp bạn đang vướng.\n• 🖐️ Bước 2: Hạ tốc độ xuống 50% hoặc 75% và nghe mẫu 1 lượt.\n• 🎯 Bước 3: Luyện ở chế độ 'Chờ đúng nốt' cho thuộc thế ngón rồi mới chuyển sang 'Theo nhịp'.`;
}

export default function AiTutorChatPanel({
  lessonId = "PN01",
  lessonTitle = "",
  instrument = "piano",
  currentBar = 1,
  maxBar = 20,
  onClose,
}) {
  const [tab, setTab] = useState("chat");
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text:
        instrument === "sao_truc"
          ? `Chào bạn! Mình là Gia Phong — Gia sư Sáo trúc C5. Bạn đang mở học phần ${lessonId}. Chọn một câu hỏi học thuật gợi ý bên dưới hoặc nhập vướng mắc của bạn nhé!`
          : `Chào bạn! Mình là Minh An — Gia sư Piano. Bạn đang mở học phần ${lessonId}. Chọn một câu hỏi học thuật gợi ý bên dưới hoặc nhập ô nhịp bạn đang thấy khó nhé!`,
    },
  ]);
  const [input, setInput] = useState("");
  const [notes, setNotes] = useState([]);
  const [noteBar, setNoteBar] = useState(currentBar || 1);
  const [noteText, setNoteText] = useState("");

  const localKey = `vv_notes_${lessonId}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(localKey) || "[]");
      setNotes(saved);
    } catch {
      /* ignore */
    }
    if (isLoggedIn()) {
      api
        .get(`/notes?lessonId=${encodeURIComponent(lessonId)}`)
        .then((rows) => {
          if (Array.isArray(rows) && rows.length) setNotes(rows);
        })
        .catch(() => {});
    }
  }, [lessonId, localKey]);

  function askQuestion(qText, presetAnswer = null) {
    if (!qText.trim()) return;
    const answer =
      presetAnswer ||
      buildLocalTutorReply(
        qText,
        instrument,
        `${currentBar}–${Math.min(maxBar, currentBar + 3)}`,
      );
    setMessages((prev) => [
      ...prev,
      { role: "user", text: qText },
      { role: "ai", text: answer },
    ]);
    setInput("");
  }

  async function addBarNote(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    const item = {
      id: Date.now(),
      lessonId,
      barNumber: Number(noteBar) || 1,
      content: noteText.trim(),
    };
    const next = [item, ...notes];
    setNotes(next);
    setNoteText("");
    try {
      localStorage.setItem(localKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    if (isLoggedIn()) {
      try {
        const created = await api.post("/notes", {
          lessonId,
          barNumber: item.barNumber,
          content: item.content,
        });
        setNotes((prev) =>
          prev.map((x) => (x.id === item.id ? { ...item, id: created.id } : x)),
        );
      } catch {
        /* fallback local */
      }
    }
  }

  async function removeBarNote(id) {
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    try {
      localStorage.setItem(localKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    if (isLoggedIn()) {
      api.delete(`/notes/${id}`).catch(() => {});
    }
  }

  return (
    <div
      className="lesson-preview-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Hỏi gia sư AI và Ghi chú ô nhịp"
    >
      <section
        className="lesson-preview-modal vv-acad-modal-card"
        style={{
          maxWidth: 660,
          width: "94vw",
          maxHeight: "88vh",
          overflowY: "auto",
        }}
      >
        <button
          type="button"
          className="lesson-preview-close"
          aria-label="Đóng hộp thoại gia sư AI"
          onClick={onClose}
        >
          <X size={18} />
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <span className="section-kicker">
            {instrument === "sao_truc"
              ? "GIA PHONG · SÁO C5"
              : "MINH AN · PIANO"}
          </span>
          <span className="vv-badge">
            Sắp ra mắt · Bản Demo Sư phạm Cục bộ (0 gọi API ngoài)
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <button
            type="button"
            className={`button ${tab === "chat" ? "button-primary" : "button-quiet"}`}
            style={{ padding: "7px 14px", fontSize: 13 }}
            onClick={() => setTab("chat")}
          >
            <Bot size={15} /> Hỏi Gia sư AI
          </button>
          <button
            type="button"
            className={`button ${tab === "notes" ? "button-primary" : "button-quiet"}`}
            style={{ padding: "7px 14px", fontSize: 13 }}
            onClick={() => setTab("notes")}
          >
            <BookmarkPlus size={15} /> Sổ tay ghi chú theo ô nhịp (
            {notes.length})
          </button>
        </div>

        {tab === "chat" ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <small
                style={{
                  display: "block",
                  marginBottom: 6,
                  color: "#4a5a6a",
                  fontWeight: 600,
                }}
              >
                Câu hỏi học thuật thường gặp ({lessonTitle || lessonId}):
              </small>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SUGGESTED_QUESTIONS.map((item) => (
                  <button
                    key={item.q}
                    type="button"
                    onClick={() => askQuestion(item.q, item.a)}
                    style={{
                      fontSize: 12,
                      padding: "6px 11px",
                      borderRadius: 99,
                      background: "#eef8f6",
                      border: "1px solid #bfe3de",
                      color: "#1f6f68",
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <Sparkles
                      size={12}
                      style={{ verticalAlign: "middle", marginRight: 4 }}
                    />
                    {item.q}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 270,
                overflowY: "auto",
                padding: 12,
                borderRadius: 12,
                background: "#f8faf9",
                border: "1px solid var(--vv-line)",
                marginBottom: 12,
              }}
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "88%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: "pre-line",
                    background: m.role === "user" ? "#e3f3f1" : "#ffffff",
                    color: "#172432",
                    border:
                      m.role === "user"
                        ? "1px solid #9ad7cf"
                        : "1px solid var(--vv-line)",
                  }}
                >
                  {m.text}
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                askQuestion(input);
              }}
              style={{ display: "flex", gap: 8 }}
            >
              <input
                className="vv-acad-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Hỏi Minh An / Gia Phong về nhạc lý, thế ngón, nhịp, hơi thở..."
              />
              <button type="submit" className="button button-primary">
                <Send size={15} /> Gửi
              </button>
            </form>
          </>
        ) : (
          <div>
            <form
              onSubmit={addBarNote}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <span>Ô nhịp:</span>
                <input
                  type="number"
                  min="1"
                  max={maxBar || 20}
                  className="vv-acad-input"
                  style={{ width: 68 }}
                  value={noteBar}
                  onChange={(e) => setNoteBar(e.target.value)}
                />
              </label>
              <input
                className="vv-acad-input"
                style={{ flex: 1, minWidth: 200 }}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="VD: Ô 5 nhớ đổi ngón cái phách 3 / lấy hơi sâu trước điệp khúc..."
              />
              <button type="submit" className="button button-primary">
                Lưu ghi chú
              </button>
            </form>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 260,
                overflowY: "auto",
              }}
            >
              {notes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#f8faf9",
                    border: "1px solid var(--vv-line)",
                    fontSize: 13,
                    color: "#172432",
                  }}
                >
                  <div>
                    <strong style={{ color: "#1f6f68", marginRight: 8 }}>
                      Ô {n.barNumber}:
                    </strong>
                    <span>{n.content}</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Xoá ghi chú"
                    onClick={() => removeBarNote(n.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#c2413a",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {!notes.length && (
                <p style={{ fontSize: 13, color: "#4a5a6a" }}>
                  <MessageSquareHeart
                    size={15}
                    style={{ verticalAlign: "middle", marginRight: 6 }}
                  />
                  Chưa có ghi chú nào cho bài {lessonId}. Hãy ghi lại lưu ý ngón
                  tay hoặc nhịp ở từng ô để ôn tập hiệu quả hơn!
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
