import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Coffee,
  Mic,
  Target,
  Download,
  HelpCircle,
  History,
  MicOff,
  Piano,
  PlugZap,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { DynamicsPicker } from "./InstrumentDock.jsx";
import { HISTORY_KEY } from "../../model.mjs";
import { POSTURE, POSTURE_MS, REST_ADVICE } from "../studio/safety.js";

/** Thẻ nhắc tư thế 3 giây trước khi vào bài (D-40). */
export function PostureCard({ instrument, onSkip }) {
  const card = POSTURE[instrument] ?? POSTURE.piano;
  return (
    <div className="posture-overlay" role="dialog" aria-label={card.title}>
      <div className="posture-card">
        <span className="eyebrow">TRƯỚC KHI VÀO BÀI</span>
        <h2>{card.title}</h2>
        <ul>
          {card.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div
          className="posture-progress"
          style={{ animationDuration: `${POSTURE_MS}ms` }}
        />
        <button className="text-button" onClick={onSkip}>
          Mình đã sẵn sàng
        </button>
      </div>
    </div>
  );
}

/** Màn nghỉ sau khi bấm "Mỏi tay / Chóng mặt": lời khuyên + đồng hồ 10 phút. */
export function RestScreen({ s, controller: c }) {
  const [now, setNow] = useState(() => Date.now());
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, s.rest.until - now),
    total = s.rest.until - s.rest.started,
    min = Math.floor(left / 60000),
    sec = Math.floor((left % 60000) / 1000);
  useEffect(() => {
    if (left === 0) c.endRest(false);
  }, [left, c]);
  const advice = [
    ...REST_ADVICE.common,
    ...(REST_ADVICE[s.lesson?.instrument] ?? REST_ADVICE.piano),
  ];
  return (
    <div className="rest-backdrop">
      <FocusTrap className="rest-card" label="Nghỉ ngơi" onEscape={() => {}}>
        <div className="rest-icon">
          <Coffee size={26} />
        </div>
        <span className="eyebrow">AN TOÀN LÀ TRÊN HẾT</span>
        <h2>Mình nghỉ một chút nhé.</h2>
        <div
          className="rest-timer"
          style={{ "--rest": 1 - left / total }}
          aria-live="polite"
        >
          <strong className="mono">
            {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
          </strong>
          <small>thời gian nghỉ còn lại</small>
        </div>
        <ul className="rest-advice">
          {advice.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="info-note">
          Lời khuyên chung theo hướng dẫn sức khoẻ người chơi nhạc (BAPAM),
          không thay thế ý kiến bác sĩ.
        </p>
        {confirm ? (
          <div className="rest-confirm">
            <p>
              Người lớn xác nhận bạn đã hết mỏi, không còn đau hay chóng mặt?
            </p>
            <button className="primary-button" onClick={() => c.endRest(true)}>
              Đã ổn, tiếp tục tập
            </button>
            <button className="text-button" onClick={() => setConfirm(false)}>
              Nghỉ thêm
            </button>
          </div>
        ) : (
          <button className="text-button" onClick={() => setConfirm(true)}>
            Bỏ qua thời gian nghỉ (cần người lớn xác nhận)
          </button>
        )}
      </FocusTrap>
    </div>
  );
}

/** Biểu đồ cột độ chính xác theo ô nhịp; ô thuộc đoạn cần sửa được tô nổi. */
function BarChart({ stats, drill }) {
  if (!stats?.length) return null;
  return (
    <div className="bar-chart" role="img" aria-label="Độ chính xác theo ô nhịp">
      {stats.map((b) => {
        const pct = Math.round(b.accuracy * 100),
          inDrill = drill && b.bar >= drill.from && b.bar <= drill.to;
        return (
          <div
            key={b.bar}
            className={`bar-col ${pct >= 80 ? "good" : pct >= 50 ? "mid" : "low"} ${inDrill ? "drill" : ""}`}
            title={`Ô ${b.bar}: ${pct}% · đúng ${b.hit}, lệch nhịp ${b.timing}, sai ${b.wrong}, thiếu ${b.miss}`}
          >
            <span className="bar-value">{pct}</span>
            <div className="bar-track">
              <i style={{ height: `${Math.max(4, pct)}%` }} />
            </div>
            <span className="bar-label">{b.bar}</span>
          </div>
        );
      })}
    </div>
  );
}
export function FocusTrap({ children, className = "", onEscape, label }) {
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    const root = ref.current;
    const selector =
      'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]';
    root.querySelector(selector)?.focus();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscape?.();
      }
      if (e.key === "Tab") {
        const items = [...root.querySelectorAll(selector)],
          first = items[0],
          last = items.at(-1);
        if (!first) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    root.addEventListener("keydown", key);
    return () => {
      root.removeEventListener("keydown", key);
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- đăng ký bàn phím một lần khi mở hộp thoại
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {children}
    </div>
  );
}
export default function StudioDialogs({ kind, close, s, controller: c }) {
  function download() {
    const u = URL.createObjectURL(
      new Blob([JSON.stringify(s.history, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = u;
    a.download = "vocaverse-tien-do.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 500);
  }
  const titles = {
    history: "Nhật ký luyện tập",
    settings: "Âm thanh & thời gian",
    help: "Làm quen phòng luyện",
    devices: "Kết nối nhạc cụ",
    demo: "Phòng thử mô phỏng",
    report: "Một lượt luyện, một bước tiến",
  };
  const icon = {
    history: History,
    settings: Settings2,
    help: HelpCircle,
    devices: PlugZap,
    demo: AudioLines,
    report: Piano,
  }[kind];
  const Icon = icon ?? HelpCircle;
  const micOn = s.micStatus === "on" || s.micStatus === "sim";
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <FocusTrap className="studio-modal" label={titles[kind]} onEscape={close}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              <Icon size={14} />
              VOCAVERSE STUDIO
            </span>
            <h2>{titles[kind]}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Đóng cửa sổ"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {kind === "devices" && (
          <>
            <p className="muted">
              Kết nối đàn USB MIDI để chơi bằng nhạc cụ của bạn. Tín hiệu xử lý
              ngay trên máy, không gửi lên máy chủ.
            </p>
            <div className="device-card">
              <Piano size={28} />
              <div>
                <strong>
                  {s.midiStatus === "connected"
                    ? "Đã tìm thấy đàn MIDI"
                    : "Bàn phím MIDI"}
                </strong>
                <p className="muted">
                  {s.midiStatus === "denied"
                    ? "Chưa được cấp quyền trong trình duyệt"
                    : s.midiStatus === "empty"
                      ? "Chưa thấy đàn. Kiểm tra dây và nguồn."
                      : "Hỗ trợ note-on/off, lực nhấn và pedal"}
                </p>
              </div>
              <span
                className={`signal-dot ${s.midiStatus === "connected" ? "green" : ""}`}
              />
            </div>
            <button className="primary-button" onClick={() => c.connectMidi()}>
              <PlugZap size={16} />
              Kết nối MIDI
            </button>
            {s.devices.length > 0 && (
              <label className="setting-row">
                Đầu vào
                <select
                  aria-label="Chọn đàn MIDI"
                  value={s.device}
                  disabled={!!c.run}
                  onChange={(e) => c.selectDevice(e.target.value)}
                >
                  {s.devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="device-card">
              {micOn ? <Mic size={23} /> : <MicOff size={23} />}
              <div>
                <strong>Micro chấm điểm</strong>
                <p className="muted">
                  Nghe sáo hoặc đàn qua micro. Xử lý cục bộ trên máy · Không ghi
                  âm lên máy chủ.
                </p>
              </div>
              <span className={`signal-dot ${micOn ? "green" : ""}`} />
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                disabled={!!c.run}
                onClick={() => (micOn ? c.disableMic() : c.enableMic())}
              >
                <Mic size={15} />
                {micOn ? "Tắt micro" : "Bật micro"}
              </button>
              <button
                className="text-button"
                disabled={!!c.run || s.micStatus === "on"}
                onClick={() =>
                  s.micStatus === "sim"
                    ? c.disableMic()
                    : c.enableMic({ simulate: true })
                }
              >
                {s.micStatus === "sim" ? "Tắt micro giả lập" : "Micro giả lập"}
              </button>
            </div>
          </>
        )}
        {kind === "settings" && (
          <>
            <label className="setting-row">
              <span>Mục tiêu phiên luyện</span>
              <select
                aria-label="Mục tiêu phiên luyện"
                value={s.mode}
                disabled={!!c.run}
                onChange={(e) => c.configure({ mode: e.target.value })}
              >
                <option value="learn">Học có gợi ý</option>
                <option value="exam">Kiểm tra sau lượt</option>
              </select>
            </label>
            <label className="setting-row">
              <span>Cách bám bài</span>
              <select
                aria-label="Cách bám bài"
                value={s.practice}
                disabled={!!c.run}
                onChange={(e) => c.configure({ practice: e.target.value })}
              >
                <option value="realtime">Theo nhịp · Real-time</option>
                <option value="wait" disabled={s.mode === "exam"}>
                  Chờ đúng nốt · Wait
                </option>
              </select>
            </label>
            <label className="setting-row">
              <span>
                Lực nhấn bàn phím ảo<small>p = nhẹ · mf = vừa · f = mạnh</small>
              </span>
              <DynamicsPicker s={s} controller={c} />
            </label>
            <label className="setting-row">
              <span>
                Âm đàn tổng hợp
                <small>Web Audio · không phải piano thu mẫu</small>
              </span>
              <input
                type="checkbox"
                checked={s.volume}
                onChange={(e) => {
                  c.set({ volume: e.target.checked });
                  if (!e.target.checked) c.silence();
                }}
              />
            </label>
            <label className="setting-row">
              <span>
                Đọc góp ý
                <small>
                  Giọng tiếng Việt tùy trình duyệt, chưa phải giọng idol
                </small>
              </span>
              <input
                type="checkbox"
                checked={s.speech}
                onChange={() => c.toggleSpeech()}
              />
            </label>
            <label className="setting-row">
              <span>
                Bù thời gian đầu vào
                <small>
                  Điều chỉnh timestamp khi chấm, không đo độ trễ phần cứng
                </small>
              </span>
              <span className="mono">
                {s.offset > 0 ? "+" : ""}
                {s.offset} ms
              </span>
            </label>
            <input
              aria-label="Bù thời gian đầu vào"
              type="range"
              min="-150"
              max="150"
              step="5"
              value={s.offset}
              disabled={!!c.run}
              onChange={(e) => c.set({ offset: Number(e.target.value) })}
            />
            <div className="range-labels">
              <span>−150 ms</span>
              <span>0</span>
              <span>+150 ms</span>
            </div>
            <p className="info-note">
              Chế độ “Chờ đúng nốt” hỗ trợ học cao độ, không đánh giá nhịp. Chế
              độ “Kiểm tra” luôn dùng thời gian thực và giữ góp ý đến cuối lượt.
            </p>
          </>
        )}
        {kind === "history" && (
          <>
            <p className="muted">
              Chỉ lưu trên trình duyệt này. Tiến độ mô phỏng được tách khỏi lượt
              tự luyện; số đo chỉ để tham khảo.
            </p>
            <div className="history-list">
              {s.history.length ? (
                s.history
                  .slice()
                  .reverse()
                  .map((r, i) => (
                    <div className="history-entry" key={`${r.at}:${i}`}>
                      <span className="lesson-code">{r.lesson}</span>
                      <div>
                        <strong>
                          {r.source === "demo"
                            ? "Mô phỏng"
                            : r.source === "midi"
                              ? "Đàn MIDI"
                              : "Tự luyện bàn phím"}
                        </strong>
                        <small>
                          {new Date(r.at).toLocaleString("vi-VN")} · {r.speed}%
                          · ô {r.bars?.join("–")}
                        </small>
                      </div>
                      <span className="mono">
                        {r.correct}/{r.notes}
                        <small>nốt khớp</small>
                      </span>
                    </div>
                  ))
              ) : (
                <div className="empty-state">
                  <History size={32} />
                  <h3>Hành trình của bạn bắt đầu ở đây.</h3>
                  <p>Hoàn thành một lượt để lưu lại tiến độ.</p>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={download}>
                <Download size={15} />
                Xuất JSON
              </button>
              <button
                className="text-button danger"
                disabled={!s.history.length}
                onClick={() => {
                  if (confirm("Xóa lịch sử luyện tập trên trình duyệt này?")) {
                    try {
                      c.storage?.removeItem(HISTORY_KEY);
                      c.set({ history: [] });
                    } catch {
                      c.set({ error: "Không xóa được lịch sử." });
                    }
                  }
                }}
              >
                <Trash2 size={14} />
                Xóa lịch sử
              </button>
            </div>
          </>
        )}
        {kind === "demo" && (
          <>
            <p className="muted">
              Dùng bản nhạc thật để sinh tín hiệu MIDI giả lập. Kết quả được
              đánh dấu “Mô phỏng”, không cộng vào tiến độ.
            </p>
            <button
              className="demo-card"
              disabled={!!c.run}
              onClick={() => {
                close();
                c.start("demo");
              }}
            >
              <Piano size={22} />
              <div>
                <strong>Nghe mẫu đúng</strong>
                <small>Quan sát cao độ, trường độ, ngón và sắc thái.</small>
              </div>
            </button>
            <button
              className="demo-card"
              disabled={!!c.run}
              onClick={() => {
                close();
                c.start("demo", true);
              }}
            >
              <AudioLines size={22} />
              <div>
                <strong>Thử mô phỏng sai</strong>
                <small>
                  Gài một nốt sai; lặp lại để xem chính sách phản hồi.
                </small>
              </div>
            </button>
            <details className="video-details">
              <summary>Video dựng thử từ Studio</summary>
              <p className="muted">
                Nền giữ chỗ và âm thử ~1 kHz; chưa có idol. Video bị tắt tiếng
                mặc định.
              </p>
              <video
                controls
                muted
                preload="none"
                src="/videos/pn03/yt_long.mp4"
              />
              <video
                controls
                muted
                preload="none"
                src="/videos/sao_riff/yt_short.mp4"
              />
            </details>
          </>
        )}
        {kind === "report" && s.report && (
          <>
            <p className="muted">
              {s.history.at(-1)?.source === "demo"
                ? "Đây là kết quả mô phỏng, không phải thành tích luyện tập."
                : "Kết quả tham khảo từ tín hiệu bạn vừa chơi."}
            </p>
            <div className="result-grid">
              {[
                [
                  `${s.report.accuracy.correct}/${s.report.accuracy.notes}`,
                  "Nốt khớp",
                ],
                [s.report.accuracy.wrong, "Sai cao độ"],
                [s.report.accuracy.missed, "Thiếu nốt"],
                [s.report.accuracy.extra, "Nốt thừa"],
              ].map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            {s.barStats?.length > 0 && (
              <>
                <h3 className="report-subtitle">Độ chính xác theo ô nhịp</h3>
                <BarChart stats={s.barStats} drill={s.drill} />
              </>
            )}
            {s.drill ? (
              <button
                className="drill-cta"
                onClick={() => {
                  close();
                  c.practiceDrill();
                }}
              >
                <Target size={20} />
                <span>
                  <strong>
                    Luyện ngay đoạn sai (ô {s.drill.from}
                    {s.drill.to > s.drill.from ? `–${s.drill.to}` : ""} ở tốc độ{" "}
                    {s.drill.speed}%)
                  </strong>
                  <small>
                    Chủ yếu {s.drill.reason} · tự bật lặp A–B và hạ tempo
                  </small>
                </span>
              </button>
            ) : (
              s.barStats?.length > 0 && (
                <p className="drill-clean">
                  Mọi ô nhịp đều đạt. Thử tăng tốc độ hoặc chuyển sang Kiểm tra
                  nhé.
                </p>
              )
            )}
            <p className="feedback-bubble">{s.feedback}</p>
            {s.question && (
              <button className="secondary-button" onClick={() => c.reveal()}>
                Tôi đã tự nghe · Xem góp ý
              </button>
            )}
            <div className="modal-actions">
              <button className="secondary-button" onClick={close}>
                Tiếp tục khám phá
              </button>
            </div>
          </>
        )}
        {kind === "help" && (
          <>
            <div className="help-steps">
              <div>
                <span>1</span>
                <p>
                  <strong>Nghe trước, chơi sau.</strong> Bấm Xem mẫu để nghe và
                  quan sát nốt. Dùng thư viện để đổi bài hoặc chuyển sang sáo
                  trúc.
                </p>
              </div>
              <div>
                <span>2</span>
                <p>
                  <strong>Chậm cũng là tiến bộ.</strong> Chọn tốc độ, khoảng ô
                  A–B và chế độ chờ đúng nốt nếu cần.
                </p>
              </div>
              <div>
                <span>3</span>
                <p>
                  <strong>Nhấn Space và bắt đầu.</strong> Đếm vào 3–2–1; chơi
                  bằng MIDI, chạm phím hoặc A W S E D F T G Y H U J K.
                </p>
              </div>
            </div>
            <div className="shortcut-grid">
              <span>
                <kbd>Space</kbd>Bắt đầu / tạm dừng / tiếp tục
              </span>
              <span>
                <kbd>Esc</kbd>Đóng cửa sổ / rời Studio View
              </span>
            </div>
            <p className="info-note">
              Khung gia sư là concept vector 2D chờ asset 3D. Khuông nhạc là bản
              xem trước cơ bản; chưa thay phần mềm khắc nhạc chuyên dụng. Trong
              Studio View, chọn Ghi video và chia sẻ tab hiện tại để tải WebM
              theo khung 16:9/9:16; chưa chuyển MP4. Sáo được chấm qua micro (xử
              lý cục bộ, không ghi âm lên máy chủ). Điểm số chỉ để tham khảo;
              học liệu chưa được giáo viên ký duyệt.
            </p>
          </>
        )}
      </FocusTrap>
    </div>
  );
}
