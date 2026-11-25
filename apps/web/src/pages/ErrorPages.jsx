import { PageShell } from "./Shared.jsx";

function ErrorLayout({ code, title, children }) {
  return (
    <PageShell>
      <main className="error-page">
        <span className="error-code">{code}</span>
        <h1>{title}</h1>
        <p>{children}</p>
        <div className="error-actions">
          <a className="button button-primary" href="/">
            Về trang chủ
          </a>
          <a className="button button-quiet" href="/library">
            Xem thư viện bài
          </a>
        </div>
      </main>
    </PageShell>
  );
}

export const NotFoundPage = () => (
  <ErrorLayout code="404" title="Không tìm thấy trang này.">
    Đường dẫn có thể đã đổi hoặc gõ nhầm. Bạn thử quay về trang chủ hoặc mở thư
    viện bài.
  </ErrorLayout>
);

export const ForbiddenPage = () => (
  <ErrorLayout code="403" title="Bạn chưa có quyền xem trang này.">
    Trang này dành cho quản trị viên. Nếu bạn nghĩ đây là nhầm lẫn, hãy liên hệ
    đội ngũ VocaVerse.
  </ErrorLayout>
);
