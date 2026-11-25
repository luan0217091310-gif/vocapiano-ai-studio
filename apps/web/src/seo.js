import { getLocale } from "./i18n/index.js";
// Tiêu đề, mô tả và Open Graph theo từng trang (SPA: cập nhật khi vào trang).
const SITE = "VocaVerse";
const DEFAULT_DESC =
  "Đàn piano và thổi sáo trúc đúng từng nốt ngay trên trình duyệt: chấm trực tiếp qua micro hoặc MIDI, sửa lỗi mỗi ngày. Tập thử miễn phí, không cần tài khoản.";

export const META = {
  "/": {
    title: "VocaVerse — Học piano & sáo trúc, chấm trực tiếp qua micro",
    desc: DEFAULT_DESC,
  },
  "/library": {
    title: "Thư viện bài",
    desc: "22 bài piano và sáo trúc theo cấp độ, có bản nhạc, piano roll và tay mẫu.",
  },
  "/pricing": {
    title: "Bảng giá",
    desc: "Miễn phí, Khởi động 49k, Plus từ 99k/tháng, Thành viên Sáng lập 499k/năm và Phòng đàn Studio 39k/học viên. Thanh toán VietQR, hoàn tiền 7 ngày.",
  },
  "/demo-3d": {
    title: "Demo 3D",
    desc: "Xem tay idol Minh An chơi đúng từng nốt, từng ngón, đã qua bộ kiểm chứng.",
  },
  "/help": {
    title: "Trợ giúp",
    desc: "Câu hỏi thường gặp và hướng dẫn dùng Practice Studio.",
  },
  "/about": {
    title: "Giới thiệu",
    desc: "VocaVerse: học viện idol AI dạy nhạc cụ đúng từng nốt.",
  },
  "/privacy": {
    title: "Chính sách bảo mật",
    desc: "Cách VocaVerse thu thập, dùng và bảo vệ dữ liệu của bạn.",
  },
  "/terms": {
    title: "Điều khoản sử dụng",
    desc: "Điều khoản khi dùng VocaVerse.",
  },
  "/contact": {
    title: "Liên hệ",
    desc: "Gửi câu hỏi, góp ý hoặc đề nghị hợp tác cho VocaVerse.",
  },
  "/login": { title: "Đăng nhập" },
  "/register": { title: "Tạo tài khoản" },
  "/forgot-password": { title: "Quên mật khẩu" },
  "/reset-password": { title: "Đặt lại mật khẩu" },
  "/verify-email": { title: "Xác minh email" },
  "/dashboard": { title: "Bảng điều khiển" },
  "/profile": { title: "Hồ sơ và cài đặt" },
  "/admin": { title: "Quản trị" },
  "/studio": { title: "Practice Studio" },
  "/onboarding": { title: "Cá nhân hóa" },
  "/api-docs": { title: "Tài liệu API" },
  "/studio-b2b": { title: "Cổng Phòng đàn" },
};

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function applyMeta(path) {
  if (typeof document === "undefined") return;
  const m = META[path] ?? { title: "Không tìm thấy trang" };
  const title = path === "/" ? m.title : `${m.title} · ${SITE}`;
  const desc = m.desc ?? DEFAULT_DESC;
  document.title = title;
  document.documentElement.lang = getLocale();
  setMeta("name", "description", desc);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", desc);
  setMeta("property", "og:url", location.origin + path);
}
