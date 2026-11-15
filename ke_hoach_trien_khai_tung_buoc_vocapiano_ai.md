# HƯỚNG DẪN TRIỂN KHAI DỰ ÁN TỪNG BƯỚC (STEP-BY-STEP IMPLEMENTATION GUIDE)

**Dự án:** `VocaPiano-AI` (`vocapiano-ai-studio`)

**Tên đề tài:** Nghiên cứu và Xây dựng Nền tảng Học Nhạc Thông minh Đa phương thức (Web & Mobile App): Ứng dụng Generative AI Tự động Phân tách Âm thanh và Sinh Video Hướng dẫn Thanh nhạc – Piano Trực quan cho Mọi Ca khúc Mới Phát hành và Nhạc Xưa Hiếm gặp

**Trưởng nhóm phụ trách:** Phùng Hữu Luân

**Ngày cập nhật:** 15/11/2026

## BƯỚC 1: Khởi Tạo Kho Mã Nguồn (GitHub) & Môi Trường Phát Triển

Mục tiêu của bước này là dựng bộ khung chuẩn để các thành viên trong nhóm có thể clone về làm việc song song mà không bị xung đột code.

### 1.1. Cấu trúc thư mục chuẩn trên GitHub (`vocapiano-ai-studio`)

```
vocapiano-ai-studio/
├── ai-audio-engine/          # Python: Tách nhạc, chuyển MIDI, phân tích giọng hát
│   ├── source_separation/    # Module Demucs tách Vocal & Piano/Accompaniment
│   ├── piano_transcription/  # Module Basic Pitch / Onsets & Frames + Thuật toán ngón bấm
│   ├── vocal_analysis/       # Module CREPE (Pitch) + WhisperX (Lyrics & điểm lấy hơi)
│   └── requirements.txt
├── ai-video-renderer/        # Python/Node: Sinh Video AI khẩu hình & Render phím đàn 3D
├── backend-api/              # FastAPI / ASP.NET Core: Quản lý API, Queue, Database
├── web-client/               # ReactJS / Next.js + Three.js + Web Audio API
├── mobile-app/               # Flutter / React Native (iOS & Android)
├── docker-compose.yml        # Đóng gói toàn bộ môi trường (Backend, Redis, DB, AI Worker)
└── README.md

```

### 1.2. Thiết lập quy trình làm việc nhóm (Git Workflow)

* **Nhánh `main`:** Chỉ chứa code đã kiểm thử ổn định (Production/Demo).

* **Nhánh `develop`:** Nhánh tích hợp chung của cả nhóm.

* **Nhánh tính năng (`feature/...`):** Mỗi thành viên tạo nhánh riêng theo module được giao (ví dụ: `feature/audio-separation`, `feature/piano-fingering`, `feature/web-piano-ui`).

## BƯỚC 2: Xây Dựng Lõi Xử Lý Âm Thanh AI (`ai-audio-engine`)

Đây là trái tim của hệ thống, giúp giải quyết bài toán tự động nhận bài hát mới ra hoặc nhạc xưa chưa từng có ai dạy để bóc tách thành dữ liệu dạy học.

### 2.1. Tiền xử lý & Khử nhiễu âm thanh (Đặc biệt cho Nhạc Xưa)

* **Công việc:** Nhận file đầu vào (`.mp3`, `.wav`, `.flac`), dùng `FFmpeg` và `librosa` chuẩn hóa về tần số lấy mẫu `44.1kHz` (cho tách nhạc) và `16kHz` (cho nhận diện lời).

* **Xử lý nhạc xưa:** Áp dụng bộ lọc khử tạp âm nền (Noise Reduction / Bandpass Filter) để loại bỏ tiếng rè băng cối/đĩa than cũ trước khi đưa vào mô hình AI.

### 2.2. Tách nguồn âm thanh (Audio Source Separation)

* **Công nghệ:** Tích hợp mô hình **Hybrid Demucs (`htdemucs_6s`)**.

* **Đầu ra:** Tách 1 bài hát bất kỳ thành các tệp âm thanh riêng biệt:

  1. `vocals.wav` (Giọng hát ca sĩ mẫu – dùng để phân tích cách hát).

  2. `piano.wav` & `other.wav` (Nhạc đệm – dùng để bóc tách nốt đàn và hợp âm).

  3. `backing_track.wav` (Beat nhạc nền đã tách giọng – dùng cho học viên hát Karaoke/Luyện thanh).

### 2.3. Phân tích Thanh nhạc & Điểm lấy hơi (`vocal_analysis`)

* **Trích xuất cao độ (Pitch Contour):** Chạy mô hình **CREPE** hoặc **RMVPE** trên file `vocals.wav` để lấy tần số $F_0$ (Hz) theo từng khung thời gian `10ms`, sau đó quy đổi sang nốt nhạc chuẩn (ví dụ: `C4`, `D#4`, `A4`).

* **Đồng bộ lời bài hát (Forced Alignment):** Dùng **WhisperX** để căn chỉnh từng chữ (word-level timestamps) khớp chính xác với giọng hát.

* **Tự động đánh dấu kỹ thuật hát:**

  * *Điểm lấy hơi (`Breath Marks`):* Phát hiện các khoảng nghỉ giữa các câu hát ($\ge 300\text{ms}$) hoặc sụt giảm năng lượng âm thanh (RMS Energy) trước câu dài để gắn nhãn `[Lấy hơi]`.

  * *Ngân rung (`Vibrato`) & Luyến láy:* Phát hiện dao động tuần hoàn của đường $F_0$ (tần số dao động 5–7 Hz) để gắn nhãn hướng dẫn `[Ngân giọng]` hoặc `[Luyến lên/xuống]`.

### 2.4. Chuyển đổi Piano MIDI & Thuật toán Gán Ngón Tay (`piano_transcription`)

* **Chuyển Audio sang MIDI:** Chạy mô hình **ByteDance Piano Transcription** hoặc **Basic Pitch** để trích xuất toàn bộ danh sách nốt nhạc `(pitch, start_time, end_time, velocity)`.

* **Tạo chế độ cho người mới học (Easy Mode Simplification):**

  * Tự động nhận diện hợp âm (Chord Recognition) theo từng ô nhịp.

  * Rút gọn phần tay trái về bấm hợp âm nền (Root/Triad chords) và tay phải đánh giai điệu chính (Melody) để người mới bắt đầu không bị quá tải.

* **Thuật toán gán số ngón tay (Piano Fingering Algorithm):**

  * Áp dụng quy hoạch động (Dynamic Programming / Viterbi Algorithm) dựa trên khoảng cách vật lý giữa các phím trắng/đen để gán ngón tay `1 (Cái), 2 (Trỏ), 3 (Giữa), 4 (Áp út), 5 (Út)` cho từng nốt nhạc sao cho ít phải vắt chéo tay nhất.

## BƯỚC 3: Xây Dựng Hệ Thống Sinh Video AI & Minh Họa Trực Quan (`ai-video-renderer`)

Sau khi có dữ liệu JSON/MIDI từ Bước 2, bước này biến các con số khô khan thành hình ảnh và Video AI hướng dẫn cụ thể.

### 3.1. Mô phỏng Bàn phím Piano & Bàn tay bấm phím (Piano Visualizer)

* **Hiển thị phím đàn & Nốt rơi (Falling Notes):** Render bàn phím 88 phím chuẩn; các thanh nốt nhạc rơi từ trên xuống khớp với `start_time` và `end_time`, trên mỗi nốt in rõ số ngón tay (`1`–`5`) và màu sắc phân biệt Tay Trái (Xanh dương) / Tay Phải (Cam/Đỏ).

* **Mô hình bàn tay 3D/AI:** Sử dụng bộ khung xương bàn tay 3D (Rigged 3D Hand Model trong Three.js / Blender Python API) nội suy chuyển động ngón tay bấm xuống đúng tọa độ phím đàn theo dữ liệu MIDI + Fingering đã tính toán ở Bước 2.

### 3.2. Sinh Video AI Minh họa Khẩu hình & Cách Hát (AI Vocal Avatar)

* **Đồng bộ khẩu hình (Lip-sync & Mouth Opening):** Sử dụng mô hình **SadTalker / Wav2Lip / MuseTalk** kết hợp với độ mở hàm tỷ lệ thuận với cao độ (Pitch) và âm lượng (Loudness) của file `vocals.wav` (khi hát nốt cao, khẩu hình mở dọc rõ ràng để người học nhìn theo).

* **Lớp phủ đồ họa chỉ dẫn (Visual Coaching Overlay):** Hiển thị thanh chạy cao độ (Pitch Bar), biểu tượng lấy hơi sâu trước câu hát, và gợi ý mở khẩu hình (`Mở tròn môi`, `Giữ hơi bụng`, `Luyến nhẹ`) ngay bên cạnh Video AI.

### 3.3. Chuẩn hóa Gói Dữ liệu Bài giảng (`Lesson Package JSON`)

Toàn bộ kết quả xử lý của 1 bài hát được đóng gói thành cấu trúc JSON thống nhất để Web và App đọc ngay lập tức:

```
{
  "song_id": "new_or_classic_song_001",
  "bpm": 120,
  "key_signature": "C Major",
  "audio_tracks": {
    "original": "url_to_original.mp3",
    "vocals": "url_to_vocals.wav",
    "backing": "url_to_backing.wav"
  },
  "ai_video_url": "url_to_vocal_avatar.mp4",
  "vocal_guide": [
    {
      "word": "Đêm",
      "start": 12.40,
      "end": 12.95,
      "target_midi": 60,
      "note_name": "C4",
      "breath_before": true,
      "technique": "Lấy hơi sâu, vào chữ nhẹ"
    }
  ],
  "piano_notes": [
    {
      "midi": 60,
      "note": "C4",
      "start": 12.40,
      "end": 13.00,
      "hand": "R",
      "finger": 1
    }
  ]
}

```

## BƯỚC 4: Xây Dựng Backend API & Hàng Đợi Xử Lý Bất Đồng Bộ (`backend-api`)

Vì quá trình tách nhạc và sinh Video AI tốn từ 30 giây đến 2 phút trên GPU, hệ thống cần kiến trúc xử lý bất đồng bộ (Asynchronous Task Queue) để Web/App không bị treo.

1. **Thiết kế Database (PostgreSQL / SQL Server):**

   * Bảng `Users`: Quản lý tài khoản, quãng giọng cá nhân (Vocal Range), trình độ Piano.

   * Bảng `Songs`: Lưu thông tin bài hát, trạng thái xử lý (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`), đường dẫn lưu trữ S3/Cloud.

   * Bảng `Lessons`: Lưu file JSON cấu hình phím bấm, lời bài hát, đường dẫn Video AI.

   * Bảng `PracticeLogs`: Lưu điểm số luyện tập của người dùng theo từng buổi.

2. **Thiết lập Hàng đợi (Redis + Celery Worker):**

   * Khi người dùng tải bài hát mới lên -> API trả về ngay `job_id` -> Đẩy tác vụ vào `Redis` -> `GPU Worker` nhận việc, chạy Pipeline Bước 2 & Bước 3 -> Cập nhật trạng thái qua **WebSocket** để báo cho màn hình người dùng biết tiến độ (`Đang tách nhạc 30%... -> Đang tạo phím bấm Piano 70%... -> Hoàn tất 100%`).

## BƯỚC 5: Phát Triển Ứng Dụng Web & Mobile App Tương Tác (`web-client` & `mobile-app`)

### 5.1. Giao diện Trình phát Đa phương thức (Synchronized Player)

* Đồng bộ hóa 4 thành phần trên cùng một trục thời gian (Master Clock):

  1. **Khung Video AI** hướng dẫn khẩu hình hát.

  2. **Thanh Lyrics & Pitch Graph** chạy theo thời gian thực (giống giao diện chấm điểm thanh nhạc chuyên nghiệp).

  3. **Bàn phím Piano 88 phím** kèm bàn tay/số ngón bấm sáng đèn.

  4. **Bộ điều khiển thông minh:** Chỉnh tốc độ (`0.5x`, `0.75x`, `1.0x`), dịch tông (`Transpose -6 đến +6 bán âm`), lặp đoạn khó (`A-B Loop`), bật/tắt giọng ca sĩ mẫu.

### 5.2. Mô-đun Chấm điểm & Sửa lỗi Thời gian thực (Real-time Feedback)

* **Chấm điểm Giọng hát (Qua Microphone):**

  * Thu luồng âm thanh từ Mic người học bằng `Web Audio API` (trên Web) hoặc `flutter_audio_capture` (trên App).

  * Chạy thuật toán **YIN / McLeod Pitch Method (MPM)** ngay trên thiết bị (Client-side) để lấy cao độ giọng người học với độ trễ $< 20\text{ms}$.

  * Vẽ đường giọng người học đè lên đường chuẩn của ca sĩ: Nếu lệch quá $\pm 50\text{ cents}$ (nửa cung) -> Báo màu đỏ (`Hơi phô/Thấp hơn tông`) để người học chỉnh giọng ngay.

* **Chấm điểm Đánh đàn Piano (Qua Microphone hoặc cáp MIDI USB):**

  * Hỗ trợ cắm dây MIDI trực tiếp từ đàn Organ/Piano điện vào điện thoại/máy tính, hoặc nhận diện âm thanh tiếng đàn qua Mic.

  * Chế độ **"Wait for Note" (Đợi bấm đúng mới chạy tiếp):** Nhạc tạm dừng ở nốt tiếp theo cho đến khi người mới học bấm đúng phím đàn trên bàn phím thì bài hát mới chạy tiếp.

## BƯỚC 6: Phân Công Nhân Sự & Kiểm Thử Thực Tế (Testing & Deployment)

### 6.1. Gợi ý phân chia công việc cho các thành viên trên GitHub

| Vai trò | Nhiệm vụ cụ thể | Thư mục phụ trách | 
| ----- | ----- | ----- | 
| **Team AI / Audio & Vision**  | Tích hợp Demucs, CREPE, WhisperX, Basic Pitch, viết thuật toán gán ngón tay Piano và sinh Video AI. | `ai-audio-engine/`, `ai-video-renderer/` | 
| **Team Backend & DevOps**  | Xây dựng REST API, WebSocket, cấu hình Redis/Celery Queue, Database, đóng gói Docker và triển khai lên AWS EC2/S3. | `backend-api/`, `docker-compose.yml` | 
| **Team Frontend Web &**  | Xây dựng giao diện bàn phím Piano, hiển thị Video AI, thu âm Microphone chấm điểm trực tiếp trên Web/App. | `web-client/`, `mobile-app/` | 

### 6.2. Kịch bản Kiểm thử (Testing Checklist) trước khi báo cáo cấp trên

1. **Test với Bài hát mới phát hành (New Release Test):** Lấy 3 bài hát vừa ra mắt trong tuần (chưa hề có bất kỳ video dạy đàn hay dạy hát nào trên mạng), đưa vào hệ thống và đo thời gian tự động sinh bài giảng (Mục tiêu: $< 90\text{ giây}$ cho một bài hát 4 phút).

2. **Test với Nhạc xưa / Bản thu cũ (Classic Song Test):** Lấy 3 bản thu nhạc xưa có chất lượng âm thanh trung bình, kiểm tra khả năng lọc nhiễu, tách giọng và độ chính xác của hợp âm/nốt Piano được sinh ra.

3. **Test trải nghiệm người mới học (Beginner Usability Test):** Cho người chưa rành nhạc lý thử nhìn số ngón tay (`1-2-3-4-5`) và điểm báo `[Lấy hơi]` trên màn hình để tập hát và bấm đàn đoạn điệp khúc trong vòng 15 phút.