# VocaVerse / VocaPiano AI Studio — Bản Triển Khai Web & Cloudflare Workers

- **Live Demo (Cloudflare Workers)**: https://vocapiano-ai-studio.luan0017091310.workers.dev
- **Phòng luyện Đàn Piano & Sáo trúc C5 (Micro YIN / MIDI cục bộ)**: https://vocapiano-ai-studio.luan0017091310.workers.dev/studio?try=1&lesson=PN01
- **Thư viện 22 giáo trình cốt lõi + 8 bản trọn bài Public Domain 20 ô nhịp + 210 bài tập + Cây Kỹ Năng 24 thẻ `kb://`**: https://vocapiano-ai-studio.luan0017091310.workers.dev/library
- **6 Trò chơi Nhạc lý & Rương thưởng XP**: https://vocapiano-ai-studio.luan0017091310.workers.dev/games
- **Cộng đồng Học thuật, Sổ tay Ô nhịp & Gia sư AI**: https://vocapiano-ai-studio.luan0017091310.workers.dev/community
- **Kiểm chứng Tay mẫu 3D (Verified-T1)**: https://vocapiano-ai-studio.luan0017091310.workers.dev/demo-3d

## Triển khai trên Cloudflare Workers Builds
Cấu hình nằm sẵn trong [`wrangler.jsonc`](./wrangler.jsonc):
- Build command: `cd apps/web && npm ci && npm run build:cf`
- Assets directory: `./apps/web/dist-cf` (`not_found_handling: "single-page-application"`)
- Worker entrypoint: `apps/web/worker.mjs` (Edge API v1 không cần database ngoài, hỗ trợ xác thực cookie ký HMAC, chấm điểm cục bộ, chuyển nhạc DSP tự động, 6 trò chơi & cộng đồng)

## Tài liệu đề xuất ban đầu
- [`de_xuat_du_an_ai_day_hat_piano.md`](./de_xuat_du_an_ai_day_hat_piano.md)
- [`ke_hoach_trien_khai_tung_buoc_vocapiano_ai.md`](./ke_hoach_trien_khai_tung_buoc_vocapiano_ai.md)
