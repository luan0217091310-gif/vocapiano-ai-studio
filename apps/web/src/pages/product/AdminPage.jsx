// Trang quản trị: tổng quan có biểu đồ, người dùng, sự kiện analytics, liên hệ, học liệu, lô mã Combo/Voucher.
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Inbox,
  Library,
  Search,
  Ticket,
  Users,
} from "lucide-react";
import { api, request } from "../../api/client.js";
import {
  Badge,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Pager,
  SkeletonRows,
  toast,
  useApi,
} from "../../ui/index.jsx";
import { ProductNav } from "./ProductNav.jsx";
import { VouchersTab } from "./VouchersTab.jsx";

const PLAN = { free: "Free", plus: "Plus", studio: "Studio" };
const fmtDate = (iso) => new Date(iso).toLocaleDateString("vi-VN");
const vnd = (n) => n.toLocaleString("vi-VN") + " đ";

const TABS = [
  ["overview", "Tổng quan", BarChart3],
  ["users", "Người dùng", Users],
  ["events", "Sự kiện", Activity],
  ["contacts", "Liên hệ", Inbox],
  ["content", "Học liệu", Library],
  ["vouchers", "Mã Combo/Voucher", Ticket],
];

export function AdminPage() {
  const [tab, setTab] = useState(
    () => new URLSearchParams(location.search).get("tab") ?? "overview",
  );
  const select = (t) => {
    setTab(t);
    history.replaceState(null, "", `/admin?tab=${t}`);
  };
  return (
    <div className="product-shell">
      <ProductNav active="admin" />
      <main className="admin-main">
        <div className="admin-heading">
          <div>
            <span className="section-kicker">BẢNG QUẢN TRỊ</span>
            <h1>Vận hành VocaVerse.</h1>
          </div>
        </div>
        <div
          className="demo3d-toggle admin-tabs"
          role="tablist"
          aria-label="Mục quản trị"
        >
          {TABS.map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "active" : ""}
              onClick={() => select(id)}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === "overview" && <Overview />}
          {tab === "users" && <UsersTab />}
          {tab === "events" && <EventsTab />}
          {tab === "contacts" && <ContactsTab />}
          {tab === "content" && <ContentTab />}
          {tab === "vouchers" && <VouchersTab />}
        </div>
      </main>
    </div>
  );
}

function Overview() {
  const { data, error, loading, reload } = useApi(() =>
    api.get("/admin/stats"),
  );
  if (loading) return <SkeletonRows rows={6} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const max = Math.max(
    1,
    ...data.daily.map((d) => Math.max(d.sessions, d.signups)),
  );
  return (
    <>
      <div className="admin-metrics">
        <article>
          <small>Người dùng</small>
          <strong>{data.users}</strong>
          <span className="gm-muted">{data.verified} đã xác minh email</span>
        </article>
        <article>
          <small>Hoạt động 7 ngày</small>
          <strong>{data.activeUsers7d}</strong>
          <span className="gm-muted">{data.sessions7d} lượt luyện</span>
        </article>
        <article>
          <small>Theo gói</small>
          <strong>
            {data.byPlan.free} / {data.byPlan.plus} / {data.byPlan.studio}
          </strong>
          <span className="gm-muted">Free / Plus / Studio</span>
        </article>
        <article>
          <small>Doanh thu mô phỏng</small>
          <strong>{vnd(data.revenueSandboxVnd)}</strong>
          <span className="gm-muted">
            {data.openContacts} liên hệ chờ xử lý
          </span>
        </article>
      </div>
      <section className="gm-card admin-chart-card">
        <h3>14 ngày gần nhất</h3>
        <div className="admin-legend">
          <span>
            <i className="lg-sessions" /> Lượt luyện
          </span>
          <span>
            <i className="lg-signups" /> Đăng ký mới
          </span>
        </div>
        <svg
          className="admin-chart"
          viewBox={`0 0 ${data.daily.length * 40} 150`}
          role="img"
          aria-label={`Biểu đồ cột: ${data.daily.map((d) => `${d.day} ${d.sessions} lượt, ${d.signups} đăng ký`).join("; ")}`}
        >
          {data.daily.map((d, i) => {
            const hs = (d.sessions / max) * 110;
            const hu = (d.signups / max) * 110;
            return (
              <g key={d.day} transform={`translate(${i * 40 + 6},0)`}>
                <rect
                  x="0"
                  y={120 - hs}
                  width="13"
                  height={Math.max(hs, 1)}
                  rx="3"
                  className="bar-sessions"
                />
                <rect
                  x="15"
                  y={120 - hu}
                  width="13"
                  height={Math.max(hu, 1)}
                  rx="3"
                  className="bar-signups"
                />
                <text x="14" y="140" textAnchor="middle">
                  {d.day.slice(8)}/{d.day.slice(5, 7)}
                </text>
              </g>
            );
          })}
        </svg>
      </section>
      <section className="gm-card">
        <h3>Bài được luyện nhiều nhất (30 ngày)</h3>
        {data.topLessons.length === 0 ? (
          <EmptyState title="Chưa có lượt luyện nào" />
        ) : (
          <ol className="gm-board">
            {data.topLessons.map((l, i) => (
              <li key={l.lessonId}>
                <span className="gm-rank">{i + 1}</span>
                <span>{l.lessonId}</span>
                <strong>{l.sessions} lượt</strong>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function UsersTab() {
  const [filters, setFilters] = useState({
    q: "",
    role: "",
    plan: "",
    status: "active",
    sort: "created_at",
    order: "desc",
    page: 1,
  });
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  // Gõ tìm kiếm: chờ 300 ms rồi mới gọi API.
  useEffect(() => {
    const id = setTimeout(
      () => setFilters((f) => (f.q === q ? f : { ...f, q, page: 1 })),
      300,
    );
    return () => clearTimeout(id);
  }, [q]);
  const qs = new URLSearchParams(
    Object.entries({ ...filters, pageSize: 10 }).filter(([, v]) => v !== ""),
  ).toString();
  const { data, meta, error, loading, reload } = useApi(
    () => request("GET", `/admin/users?${qs}`),
    [qs],
  );
  const set = (k) => (e) =>
    setFilters((f) => ({ ...f, [k]: e.target.value, page: 1 }));

  async function apply(id, body, message) {
    setBusy(true);
    try {
      await api.patch(`/admin/users/${id}`, body);
      toast.success(message);
      setPending(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="admin-toolbar">
        <label className="library-search">
          <Search size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm email hoặc tên…"
            aria-label="Tìm người dùng"
          />
        </label>
        <select
          value={filters.role}
          onChange={set("role")}
          aria-label="Lọc vai trò"
        >
          <option value="">Mọi vai trò</option>
          <option value="user">Người học</option>
          <option value="admin">Quản trị</option>
        </select>
        <select
          value={filters.plan}
          onChange={set("plan")}
          aria-label="Lọc gói"
        >
          <option value="">Mọi gói</option>
          <option value="free">Free</option>
          <option value="plus">Plus</option>
          <option value="studio">Studio</option>
        </select>
        <select
          value={filters.status}
          onChange={set("status")}
          aria-label="Lọc trạng thái"
        >
          <option value="active">Đang hoạt động</option>
          <option value="deleted">Đã khoá</option>
          <option value="all">Tất cả</option>
        </select>
        <select
          value={`${filters.sort}:${filters.order}`}
          onChange={(e) => {
            const [sort, order] = e.target.value.split(":");
            setFilters((f) => ({ ...f, sort, order, page: 1 }));
          }}
          aria-label="Sắp xếp"
        >
          <option value="created_at:desc">Mới nhất</option>
          <option value="created_at:asc">Cũ nhất</option>
          <option value="email:asc">Email A–Z</option>
          <option value="name:asc">Tên A–Z</option>
        </select>
      </div>
      {loading && <SkeletonRows rows={6} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <EmptyState title="Không có người dùng phù hợp">
          Thử bỏ bớt bộ lọc.
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <div className="vv-table-wrap">
          <table className="vv-table">
            <thead>
              <tr>
                <th scope="col">Người dùng</th>
                <th scope="col">Vai trò</th>
                <th scope="col">Gói</th>
                <th scope="col">Email</th>
                <th scope="col">Ngày tạo</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.displayName}</strong>
                    <br />
                    <span className="gm-muted">{u.email}</span>
                  </td>
                  <td>
                    <select
                      value={u.role}
                      aria-label={`Vai trò của ${u.email}`}
                      onChange={(e) =>
                        setPending({
                          u,
                          body: { role: e.target.value },
                          label: `Đổi vai trò của ${u.email} thành ${e.target.value === "admin" ? "Quản trị" : "Người học"}?`,
                        })
                      }
                    >
                      <option value="user">Người học</option>
                      <option value="admin">Quản trị</option>
                    </select>
                  </td>
                  <td>
                    <select
                      value={u.plan}
                      aria-label={`Gói của ${u.email}`}
                      onChange={(e) =>
                        apply(
                          u.id,
                          { plan: e.target.value },
                          `Đã đổi gói của ${u.email} sang ${PLAN[e.target.value]}.`,
                        )
                      }
                    >
                      {Object.entries(PLAN).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {u.emailVerified ? (
                      <Badge>Đã xác minh</Badge>
                    ) : (
                      <Badge tone="gray">Chưa</Badge>
                    )}
                  </td>
                  <td>{fmtDate(u.createdAt)}</td>
                  <td>
                    {u.deletedAt ? (
                      <button
                        className="button button-quiet"
                        onClick={() =>
                          apply(
                            u.id,
                            { active: true },
                            `Đã mở khoá ${u.email}.`,
                          )
                        }
                      >
                        Mở khoá
                      </button>
                    ) : (
                      <button
                        className="button button-quiet"
                        onClick={() =>
                          setPending({
                            u,
                            body: { active: false },
                            label: `Khoá tài khoản ${u.email}? Người dùng bị đăng xuất ngay.`,
                            danger: true,
                          })
                        }
                      >
                        Khoá
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        meta={meta}
        onPage={(page) => setFilters((f) => ({ ...f, page }))}
      />
      <ConfirmModal
        open={Boolean(pending)}
        title="Xác nhận thay đổi"
        message={pending?.label}
        confirmLabel={pending?.danger ? "Khoá tài khoản" : "Xác nhận"}
        danger={pending?.danger}
        busy={busy}
        onConfirm={() =>
          apply(pending.u.id, pending.body, "Đã cập nhật người dùng.")
        }
        onClose={() => setPending(null)}
      />
    </>
  );
}

function EventsTab() {
  const [name, setName] = useState("");
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({
    page,
    pageSize: 20,
    ...(name ? { name } : {}),
  }).toString();
  const { data, meta, error, loading, reload } = useApi(
    () => request("GET", `/admin/events?${qs}`),
    [qs],
  );
  return (
    <>
      <div className="admin-toolbar">
        <select
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc sự kiện"
        >
          <option value="">Mọi sự kiện</option>
          {meta?.names?.map((n) => (
            <option key={n.name} value={n.name}>
              {n.name} ({n.n})
            </option>
          ))}
        </select>
      </div>
      {loading && <SkeletonRows rows={6} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="Chưa có sự kiện" />}
      {data && data.length > 0 && (
        <div className="vv-table-wrap">
          <table className="vv-table">
            <thead>
              <tr>
                <th scope="col">Thời điểm</th>
                <th scope="col">Sự kiện</th>
                <th scope="col">Người dùng</th>
                <th scope="col">Thuộc tính</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.createdAt).toLocaleString("vi-VN")}</td>
                  <td>
                    <code>{e.name}</code>
                  </td>
                  <td>{e.userId ?? "khách"}</td>
                  <td>
                    <code>{e.props ? JSON.stringify(e.props) : "—"}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager meta={meta} onPage={setPage} />
    </>
  );
}

function ContactsTab() {
  const [page, setPage] = useState(1);
  const { data, meta, error, loading, reload } = useApi(
    () => request("GET", `/admin/contacts?page=${page}`),
    [page],
  );
  const handle = async (id) => {
    try {
      await api.post(`/admin/contacts/${id}/handle`);
      toast.success("Đã đánh dấu xử lý.");
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <>
      {loading && <SkeletonRows rows={4} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <EmptyState title="Chưa có tin nhắn liên hệ" />
      )}
      {data?.map((c) => (
        <article key={c.id} className="gm-card admin-contact">
          <header>
            <strong>{c.name}</strong> ·{" "}
            <a href={`mailto:${c.email}`}>{c.email}</a> ·{" "}
            <Badge tone="gray">{c.topic}</Badge>{" "}
            {c.handledAt ? (
              <Badge>Đã xử lý</Badge>
            ) : (
              <Badge tone="orange">Chờ xử lý</Badge>
            )}
          </header>
          <p>{c.message}</p>
          <footer className="gm-muted">
            {new Date(c.createdAt).toLocaleString("vi-VN")}
            {!c.handledAt && (
              <button
                className="button button-quiet"
                onClick={() => handle(c.id)}
              >
                Đánh dấu đã xử lý
              </button>
            )}
          </footer>
        </article>
      ))}
      <Pager meta={meta} onPage={setPage} />
    </>
  );
}

function ContentTab() {
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("lessons");
  const [instFilter, setInstFilter] = useState("all");
  const {
    data: cms,
    error,
    loading,
    reload,
  } = useApi(async () => {
    const [rLessons, rCatalog] = await Promise.all([
      fetch("/api/lessons"),
      fetch("/api/catalog"),
    ]);
    if (!rLessons.ok) throw new Error("Không tải được danh sách bài.");
    const lessons = await rLessons.json();
    const catalog = rCatalog.ok
      ? await rCatalog.json()
      : { counts: {}, items: [], externalDependencies: {} };
    return { lessons, catalog };
  });
  if (loading) return <SkeletonRows rows={6} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { lessons, catalog } = cms;
  const pdItems = (catalog.items ?? []).filter(
    (x) => x.kind === "public_domain",
  );
  const exItems = (catalog.items ?? []).filter((x) => x.kind === "exercise");
  const sourceRows =
    kindFilter === "lessons"
      ? lessons.map((l) => ({
          id: l.id,
          title: l.title,
          instrument: l.instrument,
          level: l.level ?? l.score?.level ?? "beginner",
          licenseClass: l.score?.license?.class ?? "original_inhouse",
          verifiedBy: l.score?.license?.expert_verified_by ?? null,
          composer: (l.score?.composers ?? []).join(", "),
          kind: "lesson",
        }))
      : kindFilter === "pd"
        ? pdItems.map((x) => ({
            id: x.id,
            title: x.title,
            instrument: x.instrument,
            level: x.level,
            licenseClass: "public_domain",
            verifiedBy: x.publishable ? "PD_GLOBAL" : "PENDING",
            composer: `${x.composer} (mất ${x.composerDeathYear} ≤ 1955)`,
            evidenceUrl: x.evidenceUrl,
            kind: "pd",
          }))
        : exItems.map((x) => ({
            id: x.id,
            title: x.title,
            instrument: x.instrument,
            level: x.level,
            licenseClass: "original_inhouse",
            verifiedBy: "PROCEDURAL_CODE",
            composer: "tools/generate_exercises.py",
            kind: "exercise",
          }));

  const rows = sourceRows.filter(
    (l) =>
      (instFilter === "all" || l.instrument === instFilter) &&
      `${l.id} ${l.title} ${l.composer ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const LEVEL_VI = {
    beginner: "Cấp 1 · Nhập môn",
    easy: "Cấp 2 · Cơ bản",
    intermediate: "Cấp 3 · Tự tin",
  };
  return (
    <>
      <div className="admin-metrics" style={{ marginBottom: 16 }}>
        <article>
          <small>Bài học gốc (MVP-α)</small>
          <strong>{lessons.length} gói</strong>
          <span className="gm-muted">
            4 xuất bản ngay · 18 chờ chuyên gia ký
          </span>
        </article>
        <article>
          <small>Bản nhạc Public Domain</small>
          <strong>{pdItems.length} bài</strong>
          <span className="gm-muted">pd_scope=global · Tác giả mất ≤ 1955</span>
        </article>
        <article>
          <small>Bài tập kỹ thuật tự sinh</small>
          <strong>{exItems.length} bài</strong>
          <span className="gm-muted">120 Piano · 90 Sáo trúc C5</span>
        </article>
        <article>
          <small>Dân ca & Phiếu chuyên gia</small>
          <strong>12 bài · 3 phiếu</strong>
          <span className="gm-muted">Phụ thuộc bên ngoài (không tự ký âm)</span>
        </article>
      </div>
      <div className="admin-toolbar" style={{ flexWrap: "wrap", gap: 10 }}>
        <div
          className="demo3d-toggle"
          role="group"
          aria-label="Phân loại học liệu CMS"
        >
          <button
            type="button"
            className={kindFilter === "lessons" ? "active" : ""}
            onClick={() => setKindFilter("lessons")}
          >
            Bài học gốc ({lessons.length})
          </button>
          <button
            type="button"
            className={kindFilter === "pd" ? "active" : ""}
            onClick={() => setKindFilter("pd")}
          >
            Public Domain ({pdItems.length})
          </button>
          <button
            type="button"
            className={kindFilter === "exercises" ? "active" : ""}
            onClick={() => setKindFilter("exercises")}
          >
            Bài tập kỹ thuật ({exItems.length})
          </button>
        </div>
        <select
          aria-label="Lọc nhạc cụ CMS"
          value={instFilter}
          onChange={(e) => setInstFilter(e.target.value)}
        >
          <option value="all">Mọi nhạc cụ</option>
          <option value="piano">Piano</option>
          <option value="sao_truc">Sáo trúc C5</option>
        </select>
        <label className="library-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm mã, tên bài hoặc tác giả…"
            aria-label="Tìm bài"
          />
        </label>
      </div>
      <div className="vv-table-wrap">
        <table className="vv-table">
          <thead>
            <tr>
              <th scope="col">Mã bài</th>
              <th scope="col">Tên & Nguồn gốc</th>
              <th scope="col">Nhạc cụ</th>
              <th scope="col">Cấp độ</th>
              <th scope="col">Lớp giấy phép</th>
              <th scope="col">Duyệt chuyên môn</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 80).map((l) => (
              <tr key={l.id}>
                <td>
                  <strong>{l.id}</strong>
                </td>
                <td>
                  <div>{l.title}</div>
                  {l.composer && (
                    <small className="gm-muted">{l.composer}</small>
                  )}
                </td>
                <td>{l.instrument === "piano" ? "Piano" : "Sáo trúc C5"}</td>
                <td>
                  <Badge tone="gray">{LEVEL_VI[l.level] ?? l.level}</Badge>
                </td>
                <td>
                  <code>{l.licenseClass}</code>
                </td>
                <td>
                  {l.verifiedBy === "PENDING" ? (
                    <Badge tone="orange">Chờ chuyên gia ký</Badge>
                  ) : l.verifiedBy === "PROCEDURAL_CODE" ? (
                    <Badge>Sinh tất định (In-App)</Badge>
                  ) : (
                    <Badge>Cổng License Đạt</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="admin-footnote">
        Mọi bản nhạc đi qua cổng giấy phép 3 lớp (
        <code>tools/license_gate.py</code>) và bộ kiểm{" "}
        <code>tools/build_content.py --check</code>. 12 bài dân ca Việt Nam (
        <code>folk_traditional</code>) và 3 Phiếu duyệt nhanh chờ chuyên gia
        người thật ký; hệ thống không tự sửa <code>expert_verified_by</code>.
      </p>
    </>
  );
}
