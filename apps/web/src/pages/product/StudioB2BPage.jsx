// Cổng Phòng đàn (B2B): chủ phòng đàn xem thời lượng tập tuần của từng học viên. Dữ liệu từ GET /b2b/studio.
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Clock3,
  Download,
  Flame,
  Search,
  Users,
} from "lucide-react";
import { EmptyState, ErrorState, SkeletonRows } from "../../ui/index.jsx";
import { t } from "../../i18n/index.js";
import { ProductNav } from "./ProductNav.jsx";
import { downloadCsv, getStudio } from "./commerce.js";

const ago = (iso) => {
  if (!iso) return "—";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  return d <= 0 ? "Hôm nay" : d === 1 ? "Hôm qua" : `${d} ngày trước`;
};

export function StudioB2BPage() {
  const [state, setState] = useState({ loading: true });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("minutes");
  const load = () => {
    setState({ loading: true });
    getStudio()
      .then((r) => setState({ loading: false, ...r }))
      .catch((error) => setState({ loading: false, error }));
  };
  useEffect(load, []);

  const students = useMemo(() => {
    const rows = (state.data?.students ?? []).filter((s) =>
      `${s.name} ${s.email}`.toLowerCase().includes(query.toLowerCase()),
    );
    return rows.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "vi")
        : b.minutesWeek - a.minutesWeek,
    );
  }, [state.data, query, sort]);

  const d = state.data;
  const total = (d?.students ?? []).reduce((n, s) => n + s.minutesWeek, 0);
  const active = (d?.students ?? []).filter((s) => s.minutesWeek > 0).length;
  const maxMin = Math.max(30, ...students.map((s) => s.minutesWeek));

  return (
    <div className="product-shell">
      <ProductNav active="studioB2b" />
      <main className="admin-main gx-b2b-page vv-page-enter">
        <div className="admin-heading">
          <div>
            <span className="section-kicker">
              <Building2 size={13} /> {t("pr.studio").toUpperCase()}
            </span>
            <h1>{d?.name ?? "Lớp của bạn"}</h1>
            <p>
              Thời lượng tập tuần này của từng học viên (tính từ thứ Hai, giờ
              Việt Nam).
            </p>
          </div>
          {d && (
            <button
              type="button"
              className="button button-quiet"
              onClick={() =>
                downloadCsv("vocaverse-lop.csv", [
                  [
                    "Học viên",
                    "Email",
                    "Phút tuần này",
                    "Lượt tập",
                    "Chuỗi ngày",
                    "Lần cuối",
                  ],
                  ...students.map((s) => [
                    s.name,
                    s.email,
                    s.minutesWeek,
                    s.sessionsWeek,
                    s.streak,
                    s.lastActiveAt ?? "",
                  ]),
                ])
              }
            >
              <Download size={15} /> Xuất CSV
            </button>
          )}
        </div>

        {state.loading && <SkeletonRows rows={6} />}
        {state.error && <ErrorState error={state.error} onRetry={load} />}
        {!state.loading && !state.error && !d && (
          <EmptyState title="Bạn chưa khởi tạo lớp / phòng đàn B2B">
            Tạo mã lớp để học viên nhập mã và chia sẻ thời lượng tự luyện hàng
            tuần với bạn.{" "}
            <button
              type="button"
              className="button button-primary"
              onClick={() =>
                import("../../api/client.js")
                  .then(({ commerce }) =>
                    commerce.createStudio("Lớp Piano & Sáo Trúc VocaVerse"),
                  )
                  .then(load)
                  .catch(() => {})
              }
            >
              + Khởi tạo Phòng đàn ngay
            </button>
          </EmptyState>
        )}

        {d && (
          <>
            <section className="dashboard-metrics gx-b2b-metrics">
              <article>
                <span className="metric-icon mint">
                  <Users size={17} />
                </span>
                <div>
                  <small>Ghế đang dùng</small>
                  <strong>
                    {d.seatsUsed}/{d.seats}
                  </strong>
                  <span>{active} học viên đã tập tuần này</span>
                </div>
              </article>
              <article>
                <span className="metric-icon lilac">
                  <Clock3 size={17} />
                </span>
                <div>
                  <small>Tổng phút tập</small>
                  <strong>{total}</strong>
                  <span>
                    Trung bình{" "}
                    {d.students.length
                      ? Math.round(total / d.students.length)
                      : 0}{" "}
                    phút/học viên
                  </span>
                </div>
              </article>
              <article>
                <span className="metric-icon peach">
                  <Flame size={17} />
                </span>
                <div>
                  <small>Cần nhắc nhở</small>
                  <strong>{d.students.length - active}</strong>
                  <span>Chưa tập lượt nào tuần này</span>
                </div>
              </article>
            </section>

            <div className="admin-toolbar">
              <label className="library-search">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm học viên…"
                  aria-label="Tìm học viên"
                />
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sắp xếp"
              >
                <option value="minutes">Nhiều phút tập trước</option>
                <option value="name">Theo tên</option>
              </select>
            </div>

            {students.length === 0 ? (
              <EmptyState title="Chưa có học viên">
                Gửi mã kích hoạt cho học viên để họ vào lớp.
              </EmptyState>
            ) : (
              <div className="vv-table-wrap">
                <table className="vv-table gx-class-table">
                  <thead>
                    <tr>
                      <th scope="col">Học viên</th>
                      <th scope="col">Phút tuần này</th>
                      <th scope="col">Lượt</th>
                      <th scope="col">Chuỗi</th>
                      <th scope="col">Lần cuối</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr
                        key={s.id}
                        className={s.minutesWeek === 0 ? "idle" : ""}
                      >
                        <td>
                          <strong>{s.name}</strong>
                          <br />
                          <small>{s.email}</small>
                        </td>
                        <td>
                          <div
                            className="gx-minbar"
                            aria-label={`${s.minutesWeek} phút`}
                          >
                            <i
                              style={{
                                width: `${Math.min(100, (s.minutesWeek / maxMin) * 100)}%`,
                              }}
                            />
                            <span>{s.minutesWeek}</span>
                          </div>
                        </td>
                        <td>{s.sessionsWeek}</td>
                        <td>{s.streak} ngày</td>
                        <td>{ago(s.lastActiveAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="admin-footnote">
              Phòng đàn chỉ thấy thời lượng và chuỗi ngày; bản ghi âm và điểm
              từng nốt vẫn ở trên máy học viên.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
