// Trang tài liệu API đọc trực tiếp /api/v1/openapi.json (không cần Swagger UI ngoài, hợp CSP 'self').
import { useApi, ErrorState, SkeletonRows, Badge } from "../../ui/index.jsx";
import { PageShell } from "../Shared.jsx";

const ROLE = {
  public: ["Công khai", "gray"],
  optional: ["Khách hoặc đã đăng nhập", "gray"],
  user: ["Cần đăng nhập", ""],
  admin: ["Quản trị viên", "orange"],
};

export function ApiDocsPage() {
  const {
    data: spec,
    error,
    loading,
    reload,
  } = useApi(() =>
    fetch("/api/v1/openapi.json").then((r) => {
      if (!r.ok) throw new Error("Không tải được đặc tả API.");
      return r.json();
    }),
  );
  return (
    <PageShell>
      <main className="info-page api-docs">
        <span className="section-kicker">DÀNH CHO NHÀ PHÁT TRIỂN</span>
        <h1>VocaVerse API v1</h1>
        {loading && <SkeletonRows rows={6} />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {spec && (
          <>
            <p>{spec.info.description}</p>
            <p>
              Tải đặc tả OpenAPI 3.1:{" "}
              <a href="/api/v1/openapi.json">/api/v1/openapi.json</a> (nhập vào
              Swagger Editor hoặc Postman).
            </p>
            <div className="vv-table-wrap">
              <table className="vv-table">
                <thead>
                  <tr>
                    <th scope="col">Phương thức</th>
                    <th scope="col">Đường dẫn</th>
                    <th scope="col">Mô tả</th>
                    <th scope="col">Quyền</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(spec.paths).flatMap(([p, ops]) =>
                    Object.entries(ops).map(([method, op]) => (
                      <tr key={method + p}>
                        <td>
                          <code>{method.toUpperCase()}</code>
                        </td>
                        <td>
                          <code>{p}</code>
                        </td>
                        <td>{op.summary}</td>
                        <td>
                          <Badge tone={ROLE[op["x-role"]]?.[1]}>
                            {ROLE[op["x-role"]]?.[0]}
                          </Badge>
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </PageShell>
  );
}
