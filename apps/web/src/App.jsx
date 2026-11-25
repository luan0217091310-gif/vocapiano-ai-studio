import { lazy, Suspense } from "react";
import PracticeStudio from "./PracticeStudio.jsx";
import { readProductState } from "./productStore.js";
import { AccountPage, OnboardingPage } from "./pages/AccountPages.jsx";
import { ResetPasswordPage, VerifyEmailPage } from "./pages/AuthExtraPages.jsx";
import { ForbiddenPage, NotFoundPage } from "./pages/ErrorPages.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import {
  AdminPage,
  ApiDocsPage,
  CommunityPage,
  ContactPage,
  DashboardPage,
  GamesPage,
  InfoPage,
  LibraryPage,
  PricingPage,
  ProfilePage,
  StudioB2BPage,
} from "./pages/ProductPages.jsx";
import { applyMeta } from "./seo.js";

// Trang Demo 3D kéo theo three.js (~600 KB): tách chunk, chỉ tải khi mở trang.
const Demo3DPage = lazy(() =>
  import("./pages/product/Demo3DPage.jsx").then((m) => ({
    default: m.Demo3DPage,
  })),
);
const Loading = () => <div className="route-loading">Đang tải…</div>;

const redirect = (to, message) => {
  location.replace(to);
  return <div className="route-loading">{message}</div>;
};

/** Route cần đăng nhập; `role="admin"` thì cần thêm quyền quản trị. */
function Protected({ children, role }) {
  const { account, onboarding } = readProductState();
  const next = encodeURIComponent(location.pathname + location.search);
  if (!account)
    return redirect(`/login?next=${next}`, "Đang mở không gian học của bạn…");
  if (role && account.role !== role) return <ForbiddenPage />;
  if (
    !onboarding?.complete &&
    location.pathname !== "/onboarding" &&
    account.role !== "admin"
  )
    return redirect(`/onboarding?next=${next}`, "Đang cá nhân hóa hành trình…");
  return children;
}

const ROUTES = {
  "/": () => <LandingPage />,
  "/login": () => <AccountPage mode="login" />,
  "/register": () => <AccountPage mode="register" />,
  "/forgot-password": () => <AccountPage mode="forgot" />,
  "/reset-password": () => <ResetPasswordPage />,
  "/verify-email": () => <VerifyEmailPage />,
  "/library": () => <LibraryPage />,
  "/games": () => <GamesPage />,
  "/community": () => <CommunityPage />,
  "/pricing": () => <PricingPage />,
  "/demo-3d": () => (
    <Suspense fallback={<Loading />}>
      <Demo3DPage />
    </Suspense>
  ),
  "/help": () => <InfoPage kind="help" />,
  "/about": () => <InfoPage kind="about" />,
  "/privacy": () => <InfoPage kind="privacy" />,
  "/terms": () => <InfoPage kind="terms" />,
  "/contact": () => <ContactPage />,
  "/api-docs": () => <ApiDocsPage />,
  "/studio-b2b": () => (
    <Protected>
      <StudioB2BPage />
    </Protected>
  ),
  // ?try=1: tập thử không cần tài khoản (khách, học sinh dưới 16 tuổi) — tiến độ chỉ lưu trên máy.
  "/studio": () =>
    !readProductState().account &&
    new URLSearchParams(location.search).get("try") === "1" ? (
      <PracticeStudio />
    ) : (
      <Protected>
        <PracticeStudio />
      </Protected>
    ),
  "/onboarding": () => (
    <Protected>
      <OnboardingPage />
    </Protected>
  ),
  "/dashboard": () => (
    <Protected>
      <DashboardPage />
    </Protected>
  ),
  "/profile": () => (
    <Protected>
      <ProfilePage />
    </Protected>
  ),
  "/admin": () => (
    <Protected role="admin">
      <AdminPage />
    </Protected>
  ),
};

export default function App() {
  const path = location.pathname.replace(/\/$/, "") || "/";
  applyMeta(path);
  const page = ROUTES[path];
  return page ? page() : <NotFoundPage />;
}
