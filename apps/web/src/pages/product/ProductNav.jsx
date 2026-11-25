import {
  Building2,
  Compass,
  Headphones,
  LayoutDashboard,
  Music2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { readProductState } from "../../productStore.js";
import NotificationBell from "../../components/NotificationBell.jsx";
import { isLoggedIn } from "../../api/client.js";
import { Brand } from "../Shared.jsx";
import { t } from "../../i18n/index.js";

export function ProductNav({ active }) {
  const account = readProductState().account;
  const initial = (account?.name || account?.email || "V")
    .replace(/^\[Mẫu\]\s*/, "")[0]
    ?.toUpperCase();
  const hasB2b = account?.plan === "studio" || account?.role === "admin";
  return (
    <>
      <header className="product-nav">
        <Brand />
        <nav aria-label="Điều hướng sản phẩm">
          <a
            className={active === "dashboard" ? "active" : ""}
            href="/dashboard"
          >
            {t("nav.dashboard")}
          </a>
          <a className={active === "library" ? "active" : ""} href="/library">
            {t("nav.library")}
          </a>
          <a className={active === "games" ? "active" : ""} href="/games">
            Trò chơi
          </a>
          <a
            className={active === "community" ? "active" : ""}
            href="/community"
          >
            Cộng đồng
          </a>
          <a className={active === "pricing" ? "active" : ""} href="/pricing">
            {t("nav.plans")}
          </a>
          <a className={active === "demo3d" ? "active" : ""} href="/demo-3d">
            {t("nav.demo3d")}
          </a>
          {hasB2b && (
            <a
              className={active === "studioB2b" ? "active" : ""}
              href="/studio-b2b"
            >
              {t("nav.studioB2b")}
            </a>
          )}
          {account?.role === "admin" && (
            <a className={active === "admin" ? "active" : ""} href="/admin">
              <ShieldCheck size={15} /> {t("nav.admin")}
            </a>
          )}
        </nav>
        <div className="product-nav-right">
          <a className="product-help" href="/help">
            <Headphones size={16} /> {t("nav.help")}
          </a>
          {account && isLoggedIn() && <NotificationBell />}
          <a
            className="product-user"
            href="/profile"
            aria-label="Hồ sơ và cài đặt"
          >
            {initial}
          </a>
        </div>
      </header>
      <nav
        className="mobile-bottom-nav"
        aria-label="Điều hướng nhanh trên điện thoại"
      >
        <a className={active === "dashboard" ? "active" : ""} href="/dashboard">
          <LayoutDashboard size={18} />
          <span>{t("nav.dashboard")}</span>
        </a>
        <a className={active === "library" ? "active" : ""} href="/library">
          <Compass size={18} />
          <span>{t("nav.library")}</span>
        </a>
        <a className="mobile-nav-studio" href="/studio">
          <Music2 size={18} />
          <span>Phòng luyện</span>
        </a>
        <a className={active === "pricing" ? "active" : ""} href="/pricing">
          <Sparkles size={18} />
          <span>{t("nav.plans")}</span>
        </a>
        {account?.role === "admin" ? (
          <a className={active === "admin" ? "active" : ""} href="/admin">
            <ShieldCheck size={18} />
            <span>{t("nav.admin")}</span>
          </a>
        ) : hasB2b ? (
          <a
            className={active === "studioB2b" ? "active" : ""}
            href="/studio-b2b"
          >
            <Building2 size={18} />
            <span>{t("nav.studioB2b")}</span>
          </a>
        ) : (
          <a className={active === "profile" ? "active" : ""} href="/profile">
            <Headphones size={18} />
            <span>Hồ sơ</span>
          </a>
        )}
      </nav>
    </>
  );
}
