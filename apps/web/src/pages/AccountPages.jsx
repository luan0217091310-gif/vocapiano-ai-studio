import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Keyboard,
  Music2,
  Piano,
  Sparkles,
  Wind,
} from "lucide-react";
import { readProductState } from "../productStore.js";
import {
  api,
  login,
  register as registerAccount,
  saveOnboarding,
} from "../api/client.js";
import { toast } from "../ui/index.jsx";
import { Brand } from "./Shared.jsx";

/** Chỉ chấp nhận đường dẫn nội bộ cho ?next= (chống open redirect). */
export function safeNext(fallback = "/dashboard") {
  const requested = new URLSearchParams(location.search).get("next");
  return requested?.startsWith("/") &&
    !requested.startsWith("//") &&
    !requested.includes("\\")
    ? requested
    : fallback;
}

const FIELD_LABEL = {
  email: "Email",
  password: "Mật khẩu",
  displayName: "Tên hiển thị",
};

export function AccountPage({ mode = "login" }) {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const register = mode === "register";
  const forgot = mode === "forgot";

  // Kiểm ngay khi rời ô nhập, báo lỗi bằng tiếng Việt ngay dưới ô.
  function checkField(event) {
    const { name, value, form } = event.target;
    if (!name) return;
    let err = "";
    if (
      name === "email" &&
      value &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
    )
      err = "Email chưa đúng định dạng.";
    if (
      name === "password" &&
      register &&
      value &&
      (value.length < 8 || !/[A-Za-z]/.test(value) || !/\d/.test(value))
    )
      err = "Mật khẩu cần ít nhất 8 ký tự, có cả chữ và số.";
    if (name === "confirm" && value && value !== form.elements.password.value)
      err = "Hai mật khẩu chưa trùng nhau.";
    setFieldErrors((f) => ({ ...f, [name]: err }));
  }

  async function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    setMessage("");
    if (register && !data.get("age16")) {
      setFieldErrors((f) => ({
        ...f,
        age16: "Bạn cần xác nhận từ đủ 16 tuổi để tạo tài khoản.",
      }));
      return;
    }
    if (register && data.get("password") !== data.get("confirm")) {
      setFieldErrors((f) => ({
        ...f,
        confirm: "Hai mật khẩu chưa trùng nhau.",
      }));
      return;
    }
    setBusy(true);
    try {
      if (forgot) {
        await api.post("/auth/forgot-password", { email });
        setMessage(
          "Nếu email đã đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu trong vài phút.",
        );
        return;
      }
      if (register) {
        await registerAccount(
          email,
          String(data.get("password")),
          String(data.get("displayName") ?? "").trim(),
          Boolean(data.get("age16")),
        );
        toast.success("Đã tạo tài khoản. Kiểm tra email để xác minh nhé!");
      } else {
        await login(email, String(data.get("password")));
      }
      const next = safeNext();
      const { onboarding, account } = readProductState();
      window.location.href =
        register || (!onboarding?.complete && account?.role !== "admin")
          ? `/onboarding?next=${encodeURIComponent(next)}`
          : next;
    } catch (err) {
      if (err.details)
        setFieldErrors(
          Object.fromEntries(
            Object.entries(err.details).map(([k, v]) => [
              k,
              `${FIELD_LABEL[k] ?? k} ${v}.`,
            ]),
          ),
        );
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Brand light />
        <div className="auth-visual-copy">
          <span className="section-kicker">MỖI NGƯỜI CÓ MỘT NHỊP RIÊNG</span>
          <h1>Âm nhạc bắt đầu từ điều bạn muốn chơi.</h1>
          <p>
            Một không gian nhẹ nhàng để bạn lắng nghe, thử sức và tìm thấy tiến
            bộ của mình.
          </p>
        </div>
        <div className="auth-orbit">
          <div className="auth-note note-a">♪</div>
          <div className="auth-note note-b">♩</div>
          <div className="auth-note note-c">♫</div>
          <div className="auth-keyboard">
            {Array.from({ length: 17 }, (_, i) => (
              <i
                key={i}
                className={[1, 4, 6, 9, 12, 14].includes(i) ? "black" : ""}
              />
            ))}
          </div>
          <div className="auth-quote">
            <Sparkles size={17} />
            <span>
              “Chậm mà chắc.
              <br />
              Từng nốt một.”
            </span>
          </div>
        </div>
        <span className="auth-visual-footer">VOCAVERSE · PRACTICE STUDIO</span>
      </section>
      <section className="auth-form-side">
        <a className="back-home" href="/">
          <ArrowLeft size={15} /> Trang chủ
        </a>
        <div className="auth-form-wrap">
          <span className="section-kicker">
            {forgot
              ? "KHÔI PHỤC TÀI KHOẢN"
              : register
                ? "BẮT ĐẦU HÀNH TRÌNH"
                : "CHÀO MỪNG BẠN TRỞ LẠI"}
          </span>
          <h2>
            {forgot
              ? "Đặt lại mật khẩu"
              : register
                ? "Tạo không gian học."
                : "Tiếp tục từ nốt nhạc trước."}
          </h2>
          <p className="auth-intro">
            {forgot
              ? "Nhập email để nhận hướng dẫn khôi phục."
              : register
                ? "Tạo tài khoản để lưu tiến độ, chuỗi ngày luyện tập và huy hiệu trên mọi thiết bị."
                : "Đăng nhập để tiếp tục lộ trình của bạn."}
          </p>
          <form
            className="auth-form"
            onSubmit={submit}
            onBlur={checkField}
            noValidate
          >
            {register && (
              <label>
                Tên hiển thị
                <input
                  name="displayName"
                  required
                  maxLength={60}
                  autoComplete="nickname"
                  placeholder="Tên hiện trên hồ sơ của bạn"
                  className={fieldErrors.displayName ? "vv-input-invalid" : ""}
                  aria-invalid={Boolean(fieldErrors.displayName)}
                />
                {fieldErrors.displayName && (
                  <span className="vv-field-error">
                    {fieldErrors.displayName}
                  </span>
                )}
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="ban@email.com"
                className={fieldErrors.email ? "vv-input-invalid" : ""}
                aria-invalid={Boolean(fieldErrors.email)}
              />
              {fieldErrors.email && (
                <span className="vv-field-error">{fieldErrors.email}</span>
              )}
            </label>
            {!forgot && (
              <label>
                Mật khẩu
                <div className="password-input">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete={
                      register ? "new-password" : "current-password"
                    }
                    placeholder={
                      register
                        ? "Ít nhất 8 ký tự, có chữ và số"
                        : "Mật khẩu của bạn"
                    }
                    className={fieldErrors.password ? "vv-input-invalid" : ""}
                    aria-invalid={Boolean(fieldErrors.password)}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <span className="vv-field-error">{fieldErrors.password}</span>
                )}
              </label>
            )}
            {register && (
              <label>
                Nhập lại mật khẩu
                <input
                  name="confirm"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu"
                  className={fieldErrors.confirm ? "vv-input-invalid" : ""}
                  aria-invalid={Boolean(fieldErrors.confirm)}
                />
                {fieldErrors.confirm && (
                  <span className="vv-field-error">{fieldErrors.confirm}</span>
                )}
              </label>
            )}
            {register && (
              <div className="gx-age">
                <label className="gx-check">
                  <input
                    type="checkbox"
                    name="age16"
                    required
                    aria-invalid={Boolean(fieldErrors.age16)}
                    aria-describedby="gx-age-help"
                    onChange={() =>
                      setFieldErrors((f) => ({ ...f, age16: "" }))
                    }
                  />
                  <span>
                    Tôi xác nhận từ đủ 16 tuổi và đồng ý{" "}
                    <a href="/terms">Điều khoản</a>,{" "}
                    <a href="/privacy">Chính sách bảo mật</a>.
                  </span>
                </label>
                {fieldErrors.age16 && (
                  <span className="vv-field-error" role="alert">
                    {fieldErrors.age16}
                  </span>
                )}
                <p id="gx-age-help" className="gx-age-kid">
                  Dưới 16 tuổi?{" "}
                  <a href="/studio?try=1&lesson=PN01">
                    Luyện ngay không cần tài khoản
                  </a>{" "}
                  — tiến độ lưu trên máy này, không thu thập thông tin cá nhân.
                </p>
              </div>
            )}
            {!register && !forgot && (
              <div className="form-between">
                <span className="auth-hint">
                  Phiên đăng nhập được giữ 30 ngày.
                </span>
                <a href="/forgot-password">Quên mật khẩu?</a>
              </div>
            )}
            {message && (
              <p className="form-message" role="status">
                {message}
              </p>
            )}
            <button
              className="button button-primary auth-submit"
              type="submit"
              disabled={busy}
            >
              {busy
                ? "Đang xử lý…"
                : forgot
                  ? "Gửi liên kết đặt lại"
                  : register
                    ? "Tạo tài khoản"
                    : "Đăng nhập"}
              <ArrowRight size={16} />
            </button>
          </form>
          <div className="auth-divider">
            <span />
            hoặc
            <span />
          </div>
          <button
            className="social-demo"
            disabled
            title="Đăng nhập ngoài chưa được kết nối"
          >
            <span className="google-mark">G</span> Tiếp tục với Google{" "}
            <small>Sắp tích hợp</small>
          </button>
          <p className="auth-switch">
            {register ? "Bạn đã có hồ sơ?" : "Chưa có hồ sơ?"}{" "}
            <a href={register ? "/login" : "/register"}>
              {register ? "Đăng nhập" : "Tạo tài khoản miễn phí"}
            </a>
          </p>
          <div className="demo-notice">
            <Keyboard size={16} />
            <span>
              <strong>Tài khoản dùng thử (dữ liệu mẫu):</strong>{" "}
              hocvien@vocaverse.demo · plus@vocaverse.demo ·
              admin@vocaverse.demo, mật khẩu VocaDemo2026.
            </span>
          </div>
        </div>
        <span className="auth-legal">
          Tiếp tục đồng nghĩa bạn đã đọc <a href="/terms">điều khoản bản thử</a>{" "}
          và <a href="/privacy">chính sách quyền riêng tư bản thử</a>.
        </span>
      </section>
    </main>
  );
}

const OPTIONS = {
  instrument: [
    { id: "piano", label: "Piano", detail: "Bàn phím và MIDI", Icon: Piano },
    {
      id: "sao_truc",
      label: "Sáo trúc",
      detail: "Hơi thở và thế bấm",
      Icon: Wind,
    },
  ],
  level: [
    { id: "new", label: "Mới bắt đầu", detail: "Mình chưa đọc được bản nhạc" },
    {
      id: "basic",
      label: "Đã biết cơ bản",
      detail: "Mình chơi được vài giai điệu",
    },
    {
      id: "returning",
      label: "Đang quay lại",
      detail: "Mình muốn luyện đều hơn",
    },
  ],
  device: [
    { id: "midi", label: "Đàn có USB-MIDI", detail: "Kết nối đàn tương thích" },
    {
      id: "mic",
      label: "Đàn cơ / sáo",
      detail: "Chấm trực tiếp qua Micro trên thiết bị (<30ms)",
    },
    {
      id: "virtual",
      label: "Chưa có nhạc cụ",
      detail: "Dùng bàn phím ảo trong demo",
    },
  ],
  time: [
    { id: "10", label: "10 phút", detail: "Bắt đầu thật nhẹ" },
    { id: "15", label: "15 phút", detail: "Một thói quen vừa đủ" },
    { id: "30", label: "30 phút", detail: "Dành thời gian đào sâu" },
  ],
};
const STEP_LABELS = ["Nhạc cụ", "Trình độ", "Thiết bị", "Mục tiêu"];

export function OnboardingPage() {
  const saved = readProductState().onboarding ?? {};
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({
    instrument: saved.instrument ?? "piano",
    level: saved.level ?? "new",
    device: saved.device ?? "virtual",
    time: saved.time ?? "15",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const field = ["instrument", "level", "device", "time"][step];
  async function finish(skipped = false) {
    setBusy(true);
    setError("");
    try {
      await saveOnboarding({
        ...values,
        ...(skipped ? { skipped: true } : {}),
      });
      window.location.href = skipped ? "/dashboard" : safeNext();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <main className="onboarding-page">
      <header className="onboard-header">
        <Brand />
        <a
          href="/dashboard"
          onClick={(e) => {
            e.preventDefault();
            finish(true);
          }}
        >
          Bỏ qua <ArrowRight size={14} />
        </a>
      </header>
      <div className="onboard-layout">
        <aside className="onboard-aside">
          <span className="section-kicker">CÁ NHÂN HÓA HÀNH TRÌNH</span>
          <h1>Mình sẽ bắt đầu từ đâu?</h1>
          <p>
            Chỉ vài lựa chọn để VocaVerse gợi ý không gian học phù hợp với bạn.
          </p>
          <div className="onboard-steps">
            {STEP_LABELS.map((label, index) => (
              <div
                key={label}
                className={
                  index === step ? "current" : index < step ? "done" : ""
                }
              >
                <span>
                  {index < step ? <Check size={14} /> : `0${index + 1}`}
                </span>
                {label}
              </div>
            ))}
          </div>
          <small>Bạn có thể đổi các lựa chọn này sau.</small>
        </aside>
        <section className="onboard-card">
          <div className="onboard-progress">
            <span style={{ width: `${(step + 1) * 25}%` }} />
          </div>
          <div className="onboard-card-inner">
            <span className="section-kicker">BƯỚC {step + 1} / 4</span>
            <h2>
              {
                [
                  "Bạn muốn học nhạc cụ nào?",
                  "Bạn đang ở chặng nào?",
                  "Bạn đang có thiết bị gì?",
                  "Mỗi ngày bạn muốn dành bao lâu?",
                ][step]
              }
            </h2>
            <p>
              {
                [
                  "Hãy chọn một nhạc cụ để bắt đầu.",
                  "Không có câu trả lời đúng hay sai.",
                  "Bạn có thể đổi cách kết nối sau.",
                  "Một mục tiêu nhỏ đều đặn cũng rất tốt.",
                ][step]
              }
            </p>
            <div
              className={`choice-list ${field === "instrument" ? "instrument-choice" : ""}`}
            >
              {OPTIONS[field].map(({ id, label, detail, Icon }) => (
                <button
                  key={id}
                  className={`choice-option ${values[field] === id ? "selected" : ""}`}
                  onClick={() => setValues((v) => ({ ...v, [field]: id }))}
                >
                  <span className="choice-icon">
                    {Icon ? (
                      <Icon size={19} />
                    ) : id === "10" ? (
                      <span>10</span>
                    ) : id === "15" ? (
                      <span>15</span>
                    ) : (
                      <span>30</span>
                    )}
                  </span>
                  <span>
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </span>
                  <i>{values[field] === id && <Check size={14} />}</i>
                </button>
              ))}
            </div>
            {field === "level" && (
              <div
                className="gm-nudge"
                style={{ marginTop: 12 }}
                role="region"
                aria-label="Gợi ý xếp trình độ nhanh"
              >
                <strong>Thử xếp trình độ 30 giây (Tùy chọn):</strong> Bạn có đọc
                được chuỗi 4 nốt <code>Đô4 – Rê4 – Mi4 – Sol4</code> trên khuông
                khóa Sol không?{" "}
                <button
                  type="button"
                  className="button button-quiet"
                  style={{ minHeight: 32, padding: "4px 10px", marginLeft: 6 }}
                  onClick={() => setValues((v) => ({ ...v, level: "basic" }))}
                >
                  Đọc được → Vào Cấp 2 (Cơ bản)
                </button>{" "}
                <button
                  type="button"
                  className="button button-quiet"
                  style={{ minHeight: 32, padding: "4px 10px", marginLeft: 4 }}
                  onClick={() => setValues((v) => ({ ...v, level: "new" }))}
                >
                  Chưa quen → Vào Cấp 1 (Nhập môn)
                </button>
              </div>
            )}
            {error && (
              <p role="alert" className="form-message">
                {error}
              </p>
            )}
            <div className="onboard-actions">
              {step > 0 && (
                <button
                  className="button button-quiet"
                  onClick={() => setStep(step - 1)}
                >
                  <ArrowLeft size={15} /> Quay lại
                </button>
              )}
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => (step < 3 ? setStep(step + 1) : finish())}
              >
                {step < 3 ? "Tiếp tục" : "Hoàn tất thiết lập"}
                <ArrowRight size={15} />
              </button>
            </div>
            <div className="onboard-privacy">
              <Music2 size={14} /> Lựa chọn được lưu vào tài khoản của bạn.
            </div>
          </div>
        </section>
      </div>
      <footer className="onboard-footer">
        VocaVerse · Bản trải nghiệm cá nhân hóa
      </footer>
    </main>
  );
}
