import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { bootSession } from "./api/client.js";
import { ToastHost } from "./ui/index.jsx";

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("VocaVerse offline cache is unavailable.", error);
    });
  });
}
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <main className="error-page" role="alert">
        <span className="error-code">500</span>
        <h1>Có lỗi xảy ra trên trang này.</h1>
        <p>
          Bạn thử tải lại trang. Nếu lỗi lặp lại, hãy báo cho chúng tôi qua
          trang Liên hệ.
        </p>
        <div className="error-actions">
          <button
            className="button button-primary"
            onClick={() => location.reload()}
          >
            Tải lại trang
          </button>
          <a className="button button-quiet" href="/">
            Về trang chủ
          </a>
        </div>
      </main>
    ) : (
      this.props.children
    );
  }
}

const root = createRoot(document.getElementById("root"));
// Khôi phục phiên từ cookie trước khi vẽ, để route bảo vệ biết người dùng là ai.
bootSession().finally(() =>
  root.render(
    <ErrorBoundary>
      <App />
      <ToastHost />
    </ErrorBoundary>,
  ),
);
