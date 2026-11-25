import { useEffect, useState } from "react";
import {
  AudioLines,
  ArrowRight,
  Download,
  HelpCircle,
  LogIn,
  Menu,
  WifiOff,
} from "lucide-react";
import { readProductState } from "../productStore.js";
import { api, isLoggedIn } from "../api/client.js";
import { getLocale, setLocale, t } from "../i18n/index.js";

function PwaStatusBar() {
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine === false,
  );
  const [installEvent, setInstallEvent] = useState(null);

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    const onInstallPrompt = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
    };
  }, []);

  if (!offline && !installEvent) return null;

  return (
    <div className="vv-pwa-bar" role="status" aria-live="polite">
      {offline && (
        <span className="vv-pwa-offline">
          <WifiOff size={14} /> Đang ngoại tuyến — Phòng luyện &amp; bài học đã
          lưu vẫn hoạt động bình thường.
        </span>
      )}
      {installEvent && (
        <button
          type="button"
          className="vv-pwa-install-btn"
          onClick={async () => {
            try {
              await installEvent.prompt();
              await installEvent.userChoice;
            } catch {
              /* ignore cancelled prompt */
            }
            setInstallEvent(null);
          }}
        >
          <Download size={14} /> Cài VocaVerse làm ứng dụng (PWA)
        </button>
      )}
    </div>
  );
}

export function Brand({ light = false }) {
  return (
    <a
      className={`public-brand ${light ? "light" : ""}`}
      href="/"
      aria-label="VocaVerse — Trang chủ"
    >
      <span className="brand-mark">
        <AudioLines size={21} strokeWidth={2.4} />
      </span>
      <span>
        voca<span>verse</span>
        <i />
      </span>
    </a>
  );
}

export function PublicHeader({ active = "" }) {
  const account = readProductState().account;
  const links = [
    ["courses", "/library", t("nav.courses")],
    ["games", "/games", "Trò chơi"],
    ["community", "/community", "Cộng đồng"],
    ["pricing", "/pricing", t("nav.pricing")],
    ["demo3d", "/demo-3d", t("nav.demo3d")],
    ["help", "/help", t("nav.help")],
  ];
  const cta = account ? "/dashboard" : "/studio?try=1&lesson=PN01";
  return (
    <>
      <a className="vv-skip-link" href="#main-content">
        Chuyển tới nội dung chính
      </a>
      <PwaStatusBar />
      <header className="public-header">
        <Brand />
        <nav aria-label="Điều hướng chính">
          {links.map(([id, href, label]) => (
            <a key={id} className={active === id ? "active" : ""} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="public-actions">
          {account ? (
            <a className="text-link" href="/dashboard">
              {t("nav.space")} <ArrowRight size={15} />
            </a>
          ) : (
            <a className="text-link" href="/login">
              <LogIn size={15} /> {t("nav.login")}
            </a>
          )}
          <a className="button button-primary button-small" href={cta}>
            {account ? t("nav.enter") : t("nav.start")}
          </a>
        </div>
        <details className="gx-mobile-menu">
          <summary aria-label={t("nav.menu")}>
            <Menu size={20} />
          </summary>
          <div className="gx-mobile-sheet">
            {links.map(([id, href, label]) => (
              <a key={id} href={href}>
                {label}
              </a>
            ))}
            <a href={account ? "/dashboard" : "/login"}>
              {account ? t("nav.space") : t("nav.login")}
            </a>
            <a className="button button-primary" href={cta}>
              {account ? t("nav.enter") : t("nav.start")}
            </a>
          </div>
        </details>
      </header>
    </>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="footer-main">
        <div>
          <Brand />
          <p>{t("footer.tagline")}</p>
          <label className="lang-switch">
            {t("footer.language")}{" "}
            <select
              value={getLocale()}
              onChange={(e) =>
                setLocale(
                  e.target.value,
                  isLoggedIn()
                    ? (locale) => api.patch("/me", { locale })
                    : undefined,
                )
              }
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
        <div className="footer-links">
          <strong>{t("footer.explore")}</strong>
          <a href="/library">{t("footer.paths")}</a>
          <a href="/games">6 Trò chơi Học thuật</a>
          <a href="/community">Cộng đồng &amp; Gia sư AI</a>
          <a href="/demo-3d">Demo Tay mẫu 3D</a>
          <a href="/pricing">{t("footer.plans")}</a>
          <a href="/pricing#studio">{t("footer.b2b")}</a>
        </div>
        <div className="footer-links">
          <strong>VocaVerse</strong>
          <a href="/about">{t("footer.about")}</a>
          <a href="/help">{t("nav.help")}</a>
          <a href="/privacy">{t("footer.privacy")}</a>
          <a href="/terms">{t("footer.terms")}</a>
          <a href="/contact">{t("footer.contact")}</a>
          <a href="/api-docs">Tài liệu API</a>
        </div>
        <div className="footer-note">
          <span>
            <HelpCircle size={15} /> {t("footer.beta")}
          </span>
          <p>{t("footer.betaNote")}</p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 VocaVerse · Practice Studio</span>
        <span>{t("footer.made")}</span>
      </div>
    </footer>
  );
}

export function PianoArtwork() {
  return (
    <svg
      className="piano-artwork"
      viewBox="0 0 700 520"
      role="img"
      aria-label="Minh họa gia sư VocaVerse bên bàn phím piano"
    >
      <defs>
        <linearGradient id="orb" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#b7ebe5" />
          <stop offset="1" stopColor="#d7d8f7" />
        </linearGradient>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#43536f" />
          <stop offset="1" stopColor="#202c46" />
        </linearGradient>
        <linearGradient id="skin" x1="0" y1="0" x2="0.8" y2="1">
          <stop stopColor="#f4c7a8" />
          <stop offset="1" stopColor="#e5a98d" />
        </linearGradient>
        <filter id="soft">
          <feGaussianBlur stdDeviation="24" />
        </filter>
      </defs>
      <circle cx="417" cy="220" r="193" fill="url(#orb)" opacity=".8" />
      <circle
        cx="535"
        cy="95"
        r="48"
        fill="#ffd6a1"
        opacity=".72"
        filter="url(#soft)"
      />
      <path
        d="M132 462c17-111 103-165 218-165 117 0 202 57 220 165z"
        fill="url(#body)"
      />
      <path d="m311 300 38 64 38-64 25 20-27 112h-75l-26-112z" fill="#e9eef3" />
      <path d="m338 348 11 19 12-19 16 84h-55z" fill="#182235" />
      <path
        d="M292 182c0-84 34-124 87-124 63 0 92 49 82 137-5 48-37 88-82 91-47 3-87-48-87-104z"
        fill="url(#skin)"
      />
      <path
        d="M290 165c-9-77 20-137 90-137 68 0 99 56 86 131-26-3-49-20-68-49-25 31-61 52-108 55z"
        fill="#273249"
      />
      <path
        d="M305 169c-20-55-12-94 10-124-44 11-72 52-68 109 3 36 16 61 34 76zM444 159c22-46 20-88-1-118 43 18 64 57 55 111-5 31-16 53-33 68z"
        fill="#263249"
      />
      <path
        d="M314 180q22-16 45 0M390 180q21-16 44 0"
        fill="none"
        stroke="#384054"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <ellipse cx="339" cy="191" rx="5" ry="7" fill="#263249" />
      <ellipse cx="410" cy="191" rx="5" ry="7" fill="#263249" />
      <path
        d="m372 190-9 39 16 2M352 252q21 13 43-1"
        fill="none"
        stroke="#b86f69"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M127 442h458l27 38H100z" fill="#263248" />
      <rect x="119" y="429" width="478" height="48" rx="9" fill="#fffdf9" />
      {Array.from({ length: 14 }, (_, i) => (
        <path
          key={i}
          d={`M${151 + i * 31} 430v47`}
          stroke="#d2d5d7"
          strokeWidth="2"
        />
      ))}
      {[0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map((i) => (
        <rect
          key={i}
          x={171 + i * 31}
          y="429"
          width="17"
          height="31"
          rx="3"
          fill="#202b40"
        />
      ))}
      <circle cx="587" cy="168" r="5" fill="#f5ad63" />
      <circle cx="145" cy="250" r="4" fill="#5bc7ba" />
      <path
        d="M528 277c18-39 32-41 45-31-1 20-16 37-45 47M236 279c-18-37-32-41-45-31 2 19 17 36 45 45"
        fill="#f0ba9d"
      />
      <rect
        x="438"
        y="87"
        width="105"
        height="34"
        rx="17"
        fill="#fffdf9"
        opacity=".88"
      />
      <text
        x="490"
        y="109"
        textAnchor="middle"
        fontFamily="sans-serif"
        fontSize="13"
        fontWeight="700"
        fill="#496074"
      >
        Chậm mà chắc ✦
      </text>
    </svg>
  );
}

export function PageShell({ children, active }) {
  return (
    <div className="marketing-shell">
      <PublicHeader active={active} />
      <div id="main-content">{children}</div>
      <PublicFooter />
    </div>
  );
}
