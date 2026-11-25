import Hand3DViewer from "../../components/Hand3DViewer.jsx";
import CharacterViewer from "../../components/CharacterViewer.jsx";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Box,
  Clock3,
  Cpu,
  Hand,
  Layers,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { PageShell } from "../Shared.jsx";

const pct = (v) => `${Math.round((v ?? 0) * 1000) / 10}%`;

function Stat({ icon: Icon, label, value, note, ok }) {
  return (
    <article className={`demo3d-stat ${ok === false ? "bad" : ""}`}>
      <span>
        <Icon size={16} /> {label}
      </span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

export function Demo3DPage() {
  const lesson = new URLSearchParams(location.search).get("lesson") ?? "PN01";
  const [choices, setChoices] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [variant, setVariant] = useState("published");
  const [archived, setArchived] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const endpoint = "/api/lessons/" + encodeURIComponent(lesson);

  useEffect(() => {
    fetch("/api/lessons")
      .then((r) => r.json())
      .then((rows) =>
        setChoices(rows.filter((row) => row.instrument === "piano")),
      )
      .catch(() => setChoices([]));
    fetch(endpoint + "/performance")
      .then(async (r) => {
        if (r.ok) return r.json();
        const problem = await r.json();
        if (lesson === "PN01" && problem.error === "planner_unavailable") {
          const saved = await fetch("/api/t8");
          if (saved.ok) {
            const archive = await saved.json();
            setArchived(true);
            return {
              title: "PN01 · Năm nốt Đô–Sol",
              recording: {
                ...archive,
                status: archive.report.decision,
                videos: {
                  published: "/videos/t8/pn01_published.mp4",
                  no_overlay: "/videos/t8/pn01_no_overlay.mp4",
                },
              },
            };
          }
        }
        throw new Error(
          {
            unknown_lesson: "Không tìm thấy mã bài.",
            instrument_unsupported: "Bộ dựng chuyển động hiện hỗ trợ piano.",
            score_invalid: "Bộ kiểm tra bản nhạc chưa cho phép lập kế hoạch.",
            planner_unavailable:
              "Bộ lập ngón Python chưa sẵn sàng trên máy chủ.",
          }[problem.error] ?? "Không tải được dữ liệu bài.",
        );
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [endpoint, lesson]);

  const recording = data?.recording;
  const r = recording?.report;
  const m = recording?.metrics;
  const motion = data?.motion;
  const status = {
    awaiting_render: "Đã lập kế hoạch ngón · Chờ dựng video",
    awaiting_verification: "Đã dựng video · Chờ kiểm chứng",
    human_review: "Chờ giáo viên duyệt bản dựng",
    plan_mismatch: "Video trên máy thuộc phiên bản kế hoạch khác",
    incomplete: "Các tệp của bản dựng chưa đầy đủ hoặc chưa khớp nhau",
    rerender: "Cần dựng lại video",
    block: "Bản dựng bị chặn",
    publish: "Báo cáo cho phép phát hành",
  }[recording?.status];
  const t1 = r?.t1;
  const t2 = r?.t2_det;

  return (
    <PageShell active="demo3d">
      <main className="info-page demo3d-page vv-page-enter">
        <div className="vv-page-hero" style={{ marginBottom: 22 }}>
          <div>
            <span className="section-kicker">
              KIỂM CHỨNG TAY MẪU 3D · CHUẨN VERIFIED-T1
            </span>
            <h1>{data?.title ?? "Chuyển động Piano 3D Minh An & Gia Phong"}</h1>
            <p>
              Số ngón, cao độ và thời điểm chạm phím đều được sinh trực tiếp từ
              bản nhạc <code>VocaScore</code> và kiểm chứng đối chiếu từng khung
              hình trước khi xuất bản vào Phòng luyện.
            </p>
          </div>
          <a
            className="button button-primary"
            href={"/studio?try=1&lesson=" + encodeURIComponent(lesson)}
          >
            Thử bài này trong Studio <ArrowRight size={15} />
          </a>
        </div>

        <label className="motion-select">
          Chọn bài giáo trình kiểm chứng 3D
          <select
            value={lesson}
            onChange={(event) =>
              location.assign(
                "/demo-3d?lesson=" + encodeURIComponent(event.target.value),
              )
            }
          >
            {!choices.some((row) => row.id === lesson) && (
              <option value={lesson}>{lesson}</option>
            )}
            {choices.map((row) => (
              <option key={row.id} value={row.id}>
                {row.id} · {row.title}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="demo3d-warn" role="alert">
            <TriangleAlert size={18} />
            {error}
          </p>
        )}
        {!data && !error && (
          <p role="status">Đang lập kế hoạch ngón cho {lesson}…</p>
        )}
        {status && (
          <p className="demo3d-lead" role="status">
            {status}
          </p>
        )}
        {archived && (
          <p className="demo3d-warn">
            Đang xem bản T8 đã lưu. Bộ lập ngón hiện chưa sẵn sàng để đối chiếu
            với bài trên máy.
          </p>
        )}
        {motion && (
          <section className="motion-contacts">
            <h2>Lịch bấm phím</h2>
            <p>
              {motion.events.length} lần bấm · {motion.fps} khung/giây ·{" "}
              {motion.preroll_s} giây chuẩn bị
            </p>
            <table>
              <caption className="sr-only">
                Các lần bấm theo thời gian của {lesson}
              </caption>
              <thead>
                <tr>
                  <th>Nhấn (s)</th>
                  <th>Nhả xong (s)</th>
                  <th>Phím</th>
                  <th>Tay</th>
                  <th>Ngón</th>
                </tr>
              </thead>
              <tbody>
                {(expanded ? motion.events : motion.events.slice(0, 5)).map(
                  (event) => (
                    <tr key={event.id}>
                      <td>{event.on_s.toFixed(3)}</td>
                      <td>{event.release_s.toFixed(3)}</td>
                      <td>
                        {
                          [
                            "C",
                            "C♯",
                            "D",
                            "D♯",
                            "E",
                            "F",
                            "F♯",
                            "G",
                            "G♯",
                            "A",
                            "A♯",
                            "B",
                          ][event.midi % 12]
                        }
                        {Math.floor(event.midi / 12) - 1}
                      </td>
                      <td>{event.hand === "R" ? "Phải" : "Trái"}</td>
                      <td>{event.finger}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            <div className="motion-actions">
              {motion.events.length > 5 && (
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded
                    ? "Thu gọn"
                    : "Xem đủ " + motion.events.length + " lần bấm"}
                </button>
              )}
              <a href={endpoint + "/motion"} download>
                Tải dữ liệu cho rig (.json)
              </a>
            </div>
          </section>
        )}

        {recording?.model && recording?.videos && (
          <section className="demo3d-player">
            <h2 className="demo3d-h2">Xem 3D tương tác · tay Minh An</h2>
            <Hand3DViewer
              modelSrc={recording.model}
              audioSrc={recording.videos.no_overlay}
            />
          </section>
        )}

        <section className="demo3d-player">
          <h2 className="demo3d-h2">Nhân vật 3D · Minh An &amp; Gia Phong</h2>
          <CharacterViewer />
        </section>

        {recording?.videos && (
          <>
            <section className="demo3d-player">
              <div
                className="demo3d-toggle"
                role="group"
                aria-label="Chọn bản video"
              >
                {[
                  ["published", "Bản phát hành (có overlay)"],
                  ["no_overlay", "Bản không overlay (dùng để kiểm)"],
                  ["goc_34", "Góc chéo 3/4 (dễ hình dung)"],
                ]
                  .filter(([key]) => recording.videos[key])
                  .map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={variant === key ? "active" : ""}
                      onClick={() => setVariant(key)}
                    >
                      {label}
                    </button>
                  ))}
              </div>
              <video
                key={variant}
                controls
                playsInline
                preload="metadata"
                src={recording.videos[variant] ?? recording.videos.published}
              />
              <p className="demo3d-caption">
                {m && `${m.video_s} giây · ${m.frame_count} khung. `}
                {lesson === "PN01" &&
                  "PN01 dùng tiếng tổng hợp để kiểm tra đồng bộ hình và tiếng."}
              </p>
            </section>
          </>
        )}

        {r && (
          <>
            <section className="demo3d-verdict">
              <BadgeCheck size={22} />
              <div>
                <strong>
                  PFS {r.pfs.bb} / 100 ·{" "}
                  {r.decision === "human_review" &&
                  t1.passed &&
                  r.pfs.floors_passed
                    ? "đạt cổng máy, chờ giáo viên duyệt"
                    : `quyết định: ${r.decision}`}
                </strong>
                <span>
                  Bậc hiện tại: <b>{r.tier}</b>. Muốn lên Verified-T1 cần giáo
                  viên piano duyệt toàn bộ video (docs/03).
                </span>
              </div>
            </section>

            <div className="demo3d-grid">
              <Stat
                icon={Hand}
                label="T1 · trên cảnh 3D"
                value={`${t1.events_ok}/${t1.events_total} nốt`}
                note={`${t1.violations.length} vi phạm · SP ${t1.sp}`}
                ok={t1.passed}
              />
              <Stat
                icon={Layers}
                label="T2-det · khung hình"
                value={`${t2.frames_checked} khung`}
                note={`${t2.frame_identity_mismatch} lệch · lật gương: ${t2.mirror_check}`}
                ok={t2.frame_identity_mismatch === 0}
              />
              <Stat
                icon={ShieldCheck}
                label="Đúng nốt / đúng ngón"
                value={`NF ${pct(t2.nf_bb)} · FF ${pct(t2.ff_bb)}`}
                note={`${t2.events_visible} sự kiện nhìn thấy · CE ${t2.ce}`}
                ok={t2.nf_bb >= 0.95 && t2.ff_bb >= 0.93 && t2.ce === 0}
              />
              <Stat
                icon={Clock3}
                label="Đồng bộ hình–tiếng"
                value={`${t2.sync.global_offset_ms} ms`}
                note={`ngưỡng ≤ 10 ms · p95 onset ${t2.sync.note_p95_frames} khung`}
                ok={Math.abs(t2.sync.global_offset_ms) <= 10}
              />
              <Stat
                icon={Box}
                label="Overlay"
                value={t2.overlay_check === "pass" ? "Khớp plan" : "Lệch"}
                note="tô phím + số ngón bật đúng khung"
                ok={t2.overlay_check === "pass"}
              />
              <Stat
                icon={Cpu}
                label="Render (GPU T1200 4 GB)"
                value={`${m.render_s_total} s`}
                note={`≈ ${Math.round((m.render_s_total / m.frame_count) * 100) / 100} s/khung · VRAM đỉnh ${m.vram_peak_mib ?? "?"} MiB`}
              />
            </div>
          </>
        )}

        {lesson === "PN01" && recording?.videos && (
          <section className="demo3d-limits">
            <h2>Còn thiếu trước khi dùng cho bài giảng</h2>
            <ul>
              <li>
                Tay đã dùng rig <b>Minh An</b> (32 xương) do đội 3D dựng; nhân
                vật toàn thân chưa được gắn chuyển động đánh đàn.
              </li>
              <li>Chưa thử phím đen, hai tay và pedal (PN01 không có).</li>
              <li>Âm thanh tổng hợp; chưa có âm mẫu piano có giấy phép.</li>
              <li>
                EDL tạm và chữ ký <code>VerifyReport</code> giữ chỗ (chưa có
                khoá Ed25519).
              </li>
            </ul>
            <p>
              Báo cáo đầy đủ: <code>experiments/logs/T8_lat-cat-doc.md</code>.
              Chạy lại: <code>make t8</code>.
            </p>
          </section>
        )}
        {data && (
          <a
            className="button button-primary"
            href={"/studio?lesson=" + encodeURIComponent(lesson)}
          >
            Mở bài trong Practice Studio <ArrowRight size={16} />
          </a>
        )}
      </main>
    </PageShell>
  );
}
