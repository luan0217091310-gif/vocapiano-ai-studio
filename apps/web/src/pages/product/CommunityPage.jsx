import { useEffect, useState } from "react";
import {
  Ban,
  BookOpen,
  Bot,
  EyeOff,
  Flag,
  Heart,
  Send,
  ShieldAlert,
  Sparkles,
  Trophy,
} from "lucide-react";
import { api, isLoggedIn } from "../../api/client.js";
import { readProductState } from "../../productStore.js";
import AiTutorChatPanel from "../../components/AiTutorChatPanel.jsx";
import { PublicFooter, PublicHeader } from "../Shared.jsx";
import { ProductNav } from "./ProductNav.jsx";

export function CommunityPage() {
  const account = readProductState().account;
  const [posts, setPosts] = useState([]);
  const [filterKind, setFilterKind] = useState("all");
  const [content, setContent] = useState("");
  const [lessonId, setLessonId] = useState("TS01");
  const [kind, setKind] = useState("achievement");
  const [under16Mode, setUnder16Mode] = useState(false);
  const [notice, setNotice] = useState("");
  const [aiModalOpen, setAiModalOpen] = useState(false);

  async function loadPosts() {
    try {
      const rows = await api.get("/community/posts");
      if (Array.isArray(rows)) setPosts(rows);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  async function submitPost(e) {
    e.preventDefault();
    setNotice("");
    if (under16Mode) {
      setNotice(
        "Chế độ học viên dưới 16 tuổi mặc định là Chỉ xem (Read-only) để đảm bảo an toàn không gian học.",
      );
      return;
    }
    if (!content.trim()) return;
    if (!isLoggedIn()) {
      const guestPost = {
        id: Date.now(),
        authorName: "Học viên Khách (Trên thiết bị)",
        lessonId,
        kind,
        content: content.trim(),
        likes: 1,
      };
      setPosts((prev) => [guestPost, ...prev]);
      setContent("");
      setNotice("Đã đăng ghi chú học thuật lên bảng tin cộng đồng trên máy!");
      return;
    }
    try {
      const created = await api.post("/community/posts", {
        lessonId,
        kind,
        content: content.trim(),
        under16: under16Mode,
      });
      setPosts((prev) => [created, ...prev]);
      setContent("");
      setNotice(
        "Đã chia sẻ thành tích & ghi chú học thuật lên Cộng đồng VocaVerse!",
      );
    } catch (err) {
      setNotice(err.message || "Không thể đăng bài lúc này.");
    }
  }

  async function likePost(id) {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, likes: (p.likes || 0) + 1 } : p)),
    );
    api.post(`/community/posts/${id}/like`, {}).catch(() => {});
  }

  async function reportPost(id) {
    setNotice("Đã gửi báo cáo vi phạm cho bộ phận kiểm duyệt VocaVerse.");
    api.post(`/community/posts/${id}/report`, {}).catch(() => {});
  }

  async function hidePost(id) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setNotice("Đã ẩn bình luận khỏi bảng tin của bạn.");
    api.post(`/community/posts/${id}/hide`, {}).catch(() => {});
  }

  async function blockAuthor(userId, authorName) {
    setPosts((prev) =>
      prev.filter((p) => p.authorName !== authorName && p.userId !== userId),
    );
    setNotice(`Đã chặn người dùng ${authorName}.`);
    if (isLoggedIn() && userId) {
      api.post("/community/block", { blockedUserId: userId }).catch(() => {});
    }
  }

  const visiblePosts = posts.filter(
    (p) => filterKind === "all" || p.kind === filterKind,
  );

  return (
    <div className={account ? "product-shell" : "library-public-shell"}>
      {account ? (
        <ProductNav active="community" />
      ) : (
        <PublicHeader active="community" />
      )}
      <main
        className={`library-main vv-page-enter ${account ? "" : "library-public-main"}`}
      >
        <div className="library-heading vv-page-hero">
          <div>
            <span className="section-kicker">
              CỘNG ĐỒNG HỌC THUẬT CÓ KIỂM DUYỆT · SỔ TAY Ô NHỊP & GIA SƯ AI
            </span>
            <h1>Diễn Đàn Học Thuật, Sổ Tay Ghi Chú Ô Nhịp & Gia Sư AI</h1>
            <p>
              Trao đổi phương pháp luyện ngón Piano, kỹ thuật hơi Sáo trúc C5
              theo từng ô nhịp và cùng bạn bè hoàn thành thử thách tuần. Tuân
              thủ nghiêm Cổng P1: không tự đăng ghi âm hoặc hình ảnh khi chưa có
              đồng ý rõ ràng.
            </p>
            <div className="vv-page-hero-pills">
              <span className="vv-page-hero-pill">
                📝 Lưu ghi chú cá nhân theo từng ô nhịp (Ô 1 → Ô 20)
              </span>
              <span className="vv-page-hero-pill">
                🤖 Gia sư AI trả lời 3 phần dựa trên 24 thẻ <code>kb://</code>
              </span>
              <span className="vv-page-hero-pill">
                🛡️ Kiểm duyệt 4 lớp: Báo cáo · Ẩn · Chặn · Chế độ &lt; 16 tuổi
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="button button-primary"
              style={{ whiteSpace: "nowrap" }}
              onClick={() => setAiModalOpen(true)}
            >
              <Bot size={16} /> Gia sư AI &amp; Sổ tay Ô nhịp
            </button>
          </div>
        </div>

        {/* Banner thử thách học thuật & Chế độ an toàn < 16 tuổi */}
        <section
          className="vv-acad-banner"
          aria-label="An toàn cộng đồng và thử thách học thuật tuần"
        >
          <div style={{ maxWidth: 680 }}>
            <span className="vv-badge">
              <Trophy size={13} /> CHUYÊN ĐỀ HỌC THUẬT TUẦN NÀY
            </span>
            <h2>
              Chinh phục trọn bài Ballad & Quê Hương (20 ô nhịp · 5 đoạn cấu
              trúc)
            </h2>
            <p>
              <strong>148 học viên</strong> đang tham gia · Mục tiêu sư phạm:
              Giữ vững phách đều 4/4 và chuyển hợp âm tay trái mượt đạt{" "}
              <strong>≥ 80% ở tốc độ 100%</strong> với bài{" "}
              <code>TS01 Nơi Này Có Anh</code> hoặc <code>TS15 Quê Hương</code>.
            </p>
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 12,
              background: under16Mode ? "#fdeee3" : "#ffffff",
              border: "1.5px solid #d5ddd8",
              color: "#172432",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={under16Mode}
              onChange={(e) => setUnder16Mode(e.target.checked)}
            />
            <ShieldAlert size={16} color="#a4541f" />
            <span>
              Chế độ Học viên &lt; 16 tuổi:{" "}
              <strong>{under16Mode ? "Đang bật (Chỉ xem)" : "Tắt"}</strong>
            </span>
          </label>
        </section>

        {notice && (
          <div
            role="status"
            className="gm-nudge"
            style={{ marginBottom: 16, fontWeight: 600 }}
          >
            {notice}
          </div>
        )}

        {/* Bố cục 2 cột cân đối: trái Đăng nhật ký & Ghi chú; phải Bộ lọc & Bảng tin có kiểm duyệt */}
        <div className="vv-community-layout">
          <section
            className="gm-card"
            aria-label="Chia sẻ thành tích hoặc ghi chú học thuật dưới bài học"
          >
            <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>
              <Sparkles
                size={16}
                style={{ verticalAlign: "middle", color: "#1f6f68" }}
              />{" "}
              Chia sẻ nhật ký luyện tập hoặc câu hỏi kỹ thuật
            </h2>
            <form onSubmit={submitPost} style={{ display: "grid", gap: 12 }}>
              <label className="vv-label">
                <span>Chọn bài hát / đơn vị học phần</span>
                <select
                  className="vv-acad-select"
                  value={lessonId}
                  onChange={(e) => setLessonId(e.target.value)}
                  disabled={under16Mode}
                >
                  <option value="TS01">
                    TS01 — Nơi Này Có Anh (Acoustic · 74 BPM)
                  </option>
                  <option value="TS04">
                    TS04 — Nàng Thơ (Acoustic Ballad · 70 BPM)
                  </option>
                  <option value="TS09">
                    TS09 — Diễm Xưa (Nhạc Trịnh · 62 BPM)
                  </option>
                  <option value="TS15">
                    TS15 — Quê Hương (Sáo &amp; Piano · 68 BPM)
                  </option>
                  <option value="TS25">
                    TS25 — See Tình (Pop Việt · 94 BPM)
                  </option>
                  <option value="TS26">
                    TS26 — Để Mị Nói Cho Mà Nghe (Sáo C5 · 92 BPM)
                  </option>
                  <option value="TS32">
                    TS32 — River Flows in You (Piano · 68 BPM)
                  </option>
                  <option value="PN01">
                    PN01 — Năm nốt Đô–Sol tay phải (Cấp 1)
                  </option>
                  <option value="SA03">
                    SA03 — Âm đầu tiên &amp; hơi đều Sáo C5 (Cấp 1)
                  </option>
                </select>
              </label>
              <label className="vv-label">
                <span>Chuyên mục thảo luận</span>
                <select
                  className="vv-acad-select"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  disabled={under16Mode}
                >
                  <option value="achievement">
                    🏆 Báo cáo tiến độ &amp; Số sao đạt được
                  </option>
                  <option value="comment">
                    💬 Ghi chú kỹ thuật ngón / hơi thở theo ô nhịp
                  </option>
                  <option value="challenge">
                    🔥 Nhóm cùng luyện tập theo tuần
                  </option>
                </select>
              </label>
              <textarea
                rows={4}
                className="vv-acad-textarea"
                value={content}
                disabled={under16Mode}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  under16Mode
                    ? "Tài khoản dưới 16 tuổi mặc định ở chế độ Chỉ xem cộng đồng..."
                    : "VD: Ở đoạn chuyển từ Verse sang Chorus (ô 8–9), mình tập riêng tay trái ở tốc độ 50% trước 3 lần giúp vào nhịp 100% chuẩn xác hơn hẳn..."
                }
              />
              <small className="gm-muted" style={{ lineHeight: 1.5 }}>
                🔒 Bảo mật học đường (P1 &amp; D-30): Hệ thống không tự tải âm
                thanh micro hay hình ảnh camera lên máy chủ.
              </small>
              <button
                type="submit"
                className="button button-primary"
                style={{ width: "100%", justifyContent: "center" }}
                disabled={under16Mode}
              >
                <Send size={15} /> Đăng lên diễn đàn
              </button>
            </form>
          </section>

          <div>
            {/* Bộ lọc chuyên mục */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div
                className="demo3d-toggle"
                role="group"
                aria-label="Lọc bài đăng cộng đồng"
              >
                {[
                  ["all", `Tất cả (${posts.length})`],
                  ["achievement", "🏆 Thành tích"],
                  ["comment", "💬 Mẹo ô nhịp"],
                  ["challenge", "🔥 Thử thách"],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={filterKind === k ? "active" : ""}
                    onClick={() => setFilterKind(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="button button-quiet"
                onClick={() => setAiModalOpen(true)}
              >
                <BookOpen size={15} /> Mở Sổ Tay Ghi Chú
              </button>
            </div>

            {/* Danh sách bài đăng cộng đồng có đầy đủ nút kiểm duyệt */}
            <section
              key={filterKind}
              className="vv-tab-panel"
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
              aria-label="Bảng tin cộng đồng"
            >
              {visiblePosts.map((p) => (
                <article
                  key={p.id}
                  className="gm-card"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <span
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "var(--vv-teal-soft)",
                          color: "var(--vv-teal-strong)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                        }}
                      >
                        {(p.authorName || "V")[0]}
                      </span>
                      <div>
                        <strong style={{ fontSize: 14.5 }}>
                          {p.authorName}
                        </strong>
                        <div
                          style={{ fontSize: 12.5, color: "var(--vv-muted)" }}
                        >
                          Học phần:{" "}
                          <a
                            href={`/studio?try=1&lesson=${encodeURIComponent(p.lessonId)}`}
                            style={{
                              color: "var(--vv-teal-strong)",
                              fontWeight: 700,
                            }}
                          >
                            {p.lessonId} (Mở trong Phòng luyện →)
                          </a>{" "}
                          ·{" "}
                          {p.kind === "achievement"
                            ? "🏆 Thành tích"
                            : p.kind === "challenge"
                              ? "🔥 Thử thách nhóm"
                              : "💬 Thảo luận kỹ thuật"}
                        </div>
                      </div>
                    </div>

                    {/* Bộ công cụ kiểm duyệt + Hỏi AI gắn đúng bài */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="button button-quiet"
                        style={{
                          minHeight: 34,
                          padding: "4px 10px",
                          fontSize: 12,
                        }}
                        onClick={() => likePost(p.id)}
                      >
                        <Heart size={13} color="#c2413a" /> {p.likes || 0}
                      </button>
                      <button
                        type="button"
                        className="button button-quiet"
                        style={{
                          minHeight: 34,
                          padding: "4px 10px",
                          fontSize: 12,
                        }}
                        onClick={() => {
                          setLessonId(p.lessonId || "TS01");
                          setAiModalOpen(true);
                        }}
                      >
                        <Bot size={13} color="#1f6f68" /> Sổ tay bài{" "}
                        {p.lessonId}
                      </button>
                      <button
                        type="button"
                        className="button button-quiet"
                        style={{
                          minHeight: 34,
                          padding: "4px 10px",
                          fontSize: 12,
                        }}
                        title="Báo cáo nội dung không phù hợp"
                        onClick={() => reportPost(p.id)}
                      >
                        <Flag size={13} /> Báo cáo
                      </button>
                      <button
                        type="button"
                        className="button button-quiet"
                        style={{
                          minHeight: 34,
                          padding: "4px 10px",
                          fontSize: 12,
                        }}
                        title="Ẩn bình luận này"
                        onClick={() => hidePost(p.id)}
                      >
                        <EyeOff size={13} /> Ẩn
                      </button>
                      <button
                        type="button"
                        className="button button-quiet"
                        style={{
                          minHeight: 34,
                          padding: "4px 10px",
                          fontSize: 12,
                        }}
                        title="Chặn người dùng này"
                        onClick={() => blockAuthor(p.userId, p.authorName)}
                      >
                        <Ban size={13} /> Chặn
                      </button>
                    </div>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: "var(--vv-ink)",
                    }}
                  >
                    {p.content}
                  </p>
                </article>
              ))}
            </section>
          </div>
        </div>
      </main>
      {aiModalOpen && (
        <AiTutorChatPanel
          lessonId={lessonId}
          instrument="piano"
          currentBar={1}
          maxBar={20}
          onClose={() => setAiModalOpen(false)}
        />
      )}
      {account ? (
        <div className="product-footer">
          Cộng đồng học thuật VocaVerse · Kiểm duyệt an toàn & bảo vệ quyền
          riêng tư
        </div>
      ) : (
        <PublicFooter />
      )}
    </div>
  );
}
