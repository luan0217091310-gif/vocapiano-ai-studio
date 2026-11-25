import { ArrowRight, Headphones, Lock, ShieldCheck } from "lucide-react";
import { PageShell } from "../Shared.jsx";

export function InfoPage({ kind }) {
  const help = kind === "help",
    privacy = kind === "privacy",
    terms = kind === "terms",
    about = kind === "about";
  const title = help
    ? "Hướng dẫn sử dụng & Câu hỏi thường gặp"
    : privacy
      ? "Chính sách Quyền riêng tư & Cổng an toàn P1"
      : terms
        ? "Điều khoản Dịch vụ & Cam kết Thương mại"
        : "Học viện Idol AI dạy Nhạc cụ Có Kiểm Chứng";
  return (
    <PageShell active={help ? "help" : ""}>
      <main className="info-page vv-page-enter" style={{ maxWidth: 1020 }}>
        <div className="vv-page-hero" style={{ marginBottom: 24 }}>
          <div>
            <span className="section-kicker">
              {help
                ? "TRỢ GIÚP HỌC VIÊN"
                : privacy
                  ? "AN TOÀN DỮ LIỆU P1"
                  : terms
                    ? "ĐIỀU KHOẢN MINH BẠCH"
                    : "VỀ VOCAVERSE"}
            </span>
            <h1>{title}</h1>
            <p>
              Tài liệu chuẩn hoá cho hệ thống VocaVerse Practice Studio: Đàn
              Piano, Sáo trúc C5, Micro DSP cục bộ (&lt; 15ms), USB-MIDI, 284+
              bài học &amp; Thanh toán VietQR.
            </p>
            <div className="vv-page-hero-pills">
              <span>🎹 Piano · 🪈 Sáo trúc C5</span>
              <span>🎙️ Micro YIN &amp; MIDI trên máy</span>
              <span>🔒 Âm thanh không rời thiết bị (P1)</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a
              className="button button-primary"
              href="/studio?try=1&lesson=PN01"
            >
              Mở Phòng luyện <ArrowRight size={15} />
            </a>
            <a
              className="button button-quiet"
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "#f8fafc",
                borderColor: "rgba(255,255,255,0.24)",
              }}
              href="/contact"
            >
              Liên hệ hỗ trợ
            </a>
          </div>
        </div>

        {help ? (
          <>
            <div className="faq-list">
              <details open>
                <summary>
                  1. Có thể luyện bằng Micro hay đàn MIDI không?
                </summary>
                <p>
                  Có cả hai. VocaVerse tích hợp bộ nhận diện cao độ YIN &amp;
                  đối chiếu nhịp thời gian thực (&lt; 15ms) trực tiếp qua Micro
                  trình duyệt cho cả Đàn Piano và Sáo trúc C5, đồng thời hỗ trợ
                  kết nối bàn phím USB-MIDI (Web MIDI) hoặc bấm trực tiếp trên
                  bàn phím ảo / cảm ứng điện thoại.
                </p>
              </details>
              <details open>
                <summary>
                  2. Làm sao nhập bài hát yêu thích từ file nhạc / link thành
                  nốt Piano &amp; Sáo?
                </summary>
                <p>
                  Tại trang <a href="/library">Thư viện</a> hoặc{" "}
                  <a href="/dashboard">Tổng quan</a>, bấm{" "}
                  <strong>Nhập Link / File Nhạc → Tự Ra Đàn &amp; Sáo</strong>.
                  Bạn có thể tải tệp MP3/WAV/MIDI/MusicXML (≤ 45MB) để hệ thống
                  tự tách Tempo (BPM), hợp âm, nốt giai điệu 5 đoạn và mở chỉnh
                  sửa nhanh trước khi lưu vào Phòng luyện.
                </p>
              </details>
              <details>
                <summary>
                  3. Tiến độ học tập, XP và Sổ tay ô nhịp lưu ở đâu?
                </summary>
                <p>
                  Khi chưa đăng nhập (chế độ tập thử <code>?try=1</code> hoặc
                  học viên dưới 16 tuổi), mọi tiến độ được giữ ngay trên máy tại
                  localStorage. Khi đã đăng ký tài khoản, lịch sử luyện tập, mục
                  tiêu tuần, XP trò chơi, rương thưởng và ghi chú ô nhịp được
                  đồng bộ vào máy chủ SQLite WAL của bạn.
                </p>
              </details>
              <details>
                <summary>4. Vì sao mở Studio offline vẫn hoạt động?</summary>
                <p>
                  PWA Service Worker cache sẵn giao diện Practice Studio và nhạc
                  liệu cơ bản sau lần mở online đầu tiên, giúp bạn tiếp tục xem
                  khuông nhạc, thác nốt và tập offline khi mất mạng.
                </p>
              </details>
              <details>
                <summary>
                  5. Video Studio View (Creator) xuất định dạng gì?
                </summary>
                <p>
                  Studio View hỗ trợ khung hình chuẩn 16:9 hoặc 9:16 dọc điện
                  thoại và ghi tệp WebM chất lượng cao trực tiếp từ tab trình
                  duyệt xuống thiết bị của bạn mà không tải video lên máy chủ.
                </p>
              </details>
            </div>
          </>
        ) : privacy ? (
          <div className="legal-draft">
            <span className="draft-pill">
              <Lock size={12} style={{ marginRight: 4 }} /> CỔNG AN TOÀN P1 · XỬ
              LÝ CỤC BỘ TRÊN THIẾT BỊ
            </span>
            <h2>1. Dữ liệu âm thanh Micro &amp; Video không rời thiết bị</h2>
            <p>
              Tín hiệu micro trong Practice Studio được giải mã hoàn toàn trong
              bộ nhớ trình duyệt bằng Web Audio API + thuật toán YIN/DTW. Không
              có byte âm thanh thô hay hình ảnh camera nào được gửi lên máy chủ
              khi chưa có đồng ý rõ ràng từ người dùng hoặc phụ huynh.
            </p>
            <h2>
              2. Tài khoản, Trẻ vị thành niên (&lt; 16 tuổi) &amp; Phụ huynh
            </h2>
            <p>
              Tài khoản chính thức yêu cầu xác nhận từ đủ 16 tuổi trở lên. Học
              viên dưới 16 tuổi có thể tập thử trực tiếp qua liên kết không cần
              tài khoản (<code>?try=1</code>), và trang{" "}
              <a href="/community">Cộng đồng</a> có chế độ Chỉ xem (Read-only)
              cho học viên nhỏ tuổi. Trong <a href="/profile">Hồ sơ</a>, bạn có
              thể tải xuống toàn bộ dữ liệu cá nhân (JSON) hoặc xoá vĩnh viễn
              tài khoản bất kỳ lúc nào.
            </p>
            <h2>3. Kiểm soát mạng bên ngoài (Zero External Trackers)</h2>
            <p>
              Phông chữ Inter và JetBrains Mono được đóng gói tự host ngay trong
              ứng dụng. Sản phẩm không chèn tracker quảng cáo hay gọi tên miền
              theo dõi bên thứ ba.
            </p>
          </div>
        ) : terms ? (
          <div className="legal-draft">
            <span className="draft-pill">
              <ShieldCheck size={12} style={{ marginRight: 4 }} /> CHÍNH SÁCH SỬ
              DỤNG &amp; BẢN QUYỀN HỌC LIỆU
            </span>
            <h2>
              1. Nguồn sự thật bản nhạc VocaScore &amp; Kiểm chứng sư phạm
            </h2>
            <p>
              Mọi thế bấm Piano (1–5), Sáo trúc C5 (6 lỗ ●○◐) và chuyển động tay
              3D đều được sinh tự động từ bản nhạc chuẩn <code>VocaScore</code>.
              Các bài học gắn trạng thái <em>Chờ chuyên gia âm nhạc duyệt</em>{" "}
              được đánh dấu minh bạch cho tới khi có xác nhận chính thức của
              giáo viên bộ môn.
            </p>
            <h2>
              2. Học liệu Public Domain, Bài tập kỹ thuật &amp; Bài hát test
            </h2>
            <p>
              16 tác phẩm cổ điển thuộc phạm vi công cộng (
              <code>pd_scope=global</code>
              ), 210 bài tập kỹ thuật do hệ thống sinh tự động và 36 bản phối
              bài hát thử nghiệm nội bộ đều tuân thủ phân loại bản quyền rạch
              ròi trước khi phát hành thương mại. Các bản chuyển tự động từ công
              cụ Nhập nhạc AI luôn gắn nhãn{" "}
              <em>&ldquo;Bản chuyển tự động — có thể chưa chính xác&rdquo;</em>.
            </p>
            <h2>3. Gói dịch vụ, Thanh toán VietQR &amp; Hoàn tiền 7 ngày</h2>
            <p>
              Bản thử hiện tại hỗ trợ cổng thanh toán VietQR sandbox và đổi mã
              Voucher / Combo hộp nhạc cụ tại <a href="/pricing">Bảng giá</a>.
              Người dùng luôn được báo trước tối thiểu 7 ngày trước kỳ gia hạn
              và hỗ trợ hoàn tiền 100% trong 7 ngày đầu.
            </p>
          </div>
        ) : about ? (
          <>
            <div className="about-grid">
              <article>
                <span>01 · BẢN NHẠC LÀ GỐC</span>
                <h2>Một chuẩn VocaScore duy nhất</h2>
                <p>
                  Khuông nhạc đôi, Thác nốt rơi, số ngón Piano, sơ đồ 6 lỗ Sáo
                  C5 và tay mẫu 3D cùng đọc trực tiếp từ một tệp VocaScore đã
                  kiểm tra hợp lệ.
                </p>
              </article>
              <article>
                <span>02 · GIA SƯ TRÊN MÁY</span>
                <h2>Phản hồi trực tiếp &lt; 15ms</h2>
                <p>
                  Nhận diện sai nốt, lệch nhịp, chia câu theo 5 đoạn cấu trúc và
                  trả lời thắc mắc sư phạm bằng Gia sư Minh An &amp; Gia Phong.
                </p>
              </article>
              <article>
                <span>03 · DỄ DÙNG TRÊN MỌI MÀN HÌNH</span>
                <h2>Đồng bộ từ điện thoại tới phòng đàn</h2>
                <p>
                  Tối ưu cho cả màn hình dọc 375px, máy tính bảng và phòng đàn
                  B2B tại trung tâm âm nhạc.
                </p>
              </article>
            </div>
          </>
        ) : null}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 24,
          }}
        >
          <a className="button button-primary" href="/library">
            Khám phá Kho 284+ bài <ArrowRight size={15} />
          </a>
          <a className="button button-quiet" href="/games">
            <Headphones size={15} /> Thực hành 6 Trò chơi
          </a>
          <a className="button button-quiet" href="/">
            Về trang chủ
          </a>
        </div>
      </main>
    </PageShell>
  );
}
