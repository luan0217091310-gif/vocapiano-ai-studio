// Bảng giá v2: 4 lựa chọn B2C (Miễn phí, Khởi động 49k, Plus, Sáng lập) + 1 B2B (Phòng đàn Studio).
// Thanh toán VietQR qua CheckoutModal; ô nhập mã quà tặng/combo; cam kết hoàn tiền & báo trước gia hạn.
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  Layers,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { track } from "../../api/client.js";
import { readProductState } from "../../productStore.js";
import { CheckoutModal, RedeemBox } from "../../ui/commerce.jsx";
import { t } from "../../i18n/index.js";
import { PageShell } from "../Shared.jsx";
import { B2B_PLAN, PLANS_V2, savingPct, vnd, vndShort } from "./commerce.js";

const PLUS_CYCLES = ["month", "quarter", "year"];
const MONTHS = { month: 1, quarter: 3, year: 12 };

function Price({ amount, cycle }) {
  if (amount === 0)
    return (
      <strong className="gx-price">
        0 đ <small>/ {t("pr.c.forever")}</small>
      </strong>
    );
  return (
    <strong className="gx-price">
      {vndShort(amount)} <small>/ {t(`pr.c.${cycle}`)}</small>
    </strong>
  );
}

export function PricingPage() {
  const account = readProductState().account;
  const [plusCycle, setPlusCycle] = useState("year");
  const [checkout, setCheckout] = useState(null);
  useEffect(() => track("pricing.view"), []);

  function buy(plan, cycle) {
    track("upgrade.click", { path: "/pricing", plan, cycle });
    if (!account) {
      location.href = `/register?next=${encodeURIComponent("/pricing")}`;
      return;
    }
    const amount = PLANS_V2.find((p) => p.id === plan).cycles[cycle];
    setCheckout({
      plan,
      cycle,
      title: `${t(`pr.${plan}`)} · ${vnd(amount)}/${t(`pr.c.${cycle}`)}`,
    });
  }

  return (
    <PageShell active="pricing">
      <main className="pricing-page gx-pricing vv-page-enter">
        <header
          className="vv-page-hero"
          style={{ marginBottom: 24, textAlign: "left" }}
        >
          <div>
            <span className="section-kicker">{t("pr.kicker")}</span>
            <h1>{t("pr.title")}</h1>
            <p>{t("pr.desc")}</p>
            <div className="vv-page-hero-pills">
              <span className="vv-page-hero-pill">
                ✓ Học thử miễn phí 8 bài đầu không cần thẻ
              </span>
              <span className="vv-page-hero-pill">
                ✓ Mở khóa 284+ bài học, Tay mẫu 3D & Nhập nhạc AI
              </span>
              <span className="vv-page-hero-pill">
                ✓ Thanh toán VietQR kích hoạt tức thì
              </span>
              <span className="vv-page-hero-pill">
                ✓ Cam kết hoàn tiền 7 ngày minh bạch
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a
              className="button button-primary"
              href="/studio?try=1&lesson=TS01&inst=piano&diff=medium"
            >
              Trải nghiệm Phòng luyện trước khi mua <ArrowRight size={15} />
            </a>
            <a
              className="button button-quiet"
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "#f8fafc",
                borderColor: "rgba(255,255,255,0.24)",
              }}
              href="#studio"
            >
              Xem Gói Trường học B2B
            </a>
          </div>
        </header>

        {/* Tóm tắt trực quan giá trị nhận được khi đăng ký dịch vụ */}
        <section
          aria-label="Giá trị cốt lõi khi mua gói học VocaVerse"
          style={{ marginBottom: 28 }}
        >
          <div className="vv-bento-grid">
            <article className="vv-bento-card">
              <div className="vv-bento-head teal">
                <span className="vv-bento-icon">
                  <Layers size={20} />
                </span>
                <div>
                  <span className="vv-bento-badge">
                    DÀNH CHO NGƯỜI HỌC CÁ NHÂN &amp; PHỤ HUYNH
                  </span>
                  <h3>
                    Mở khóa toàn bộ Lộ trình Đàn Piano &amp; Sáo trúc C5 (284+
                    bài)
                  </h3>
                </div>
              </div>
              <div className="vv-bento-body">
                <ul className="vv-bento-list">
                  <li>
                    <Check size={15} />
                    <span>
                      Không giới hạn lượt chấm điểm cao độ &amp; nhịp qua Micro
                      / MIDI (&lt; 15ms)
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      Xem góc camera Tay mẫu 3D cận ngón đã kiểm chứng sư phạm (
                      <code>Verified-T1</code>)
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      Chơi trọn bài 36 ca khúc 20 ô nhịp (5 đoạn) ở cả 3 độ khó
                      Dễ · Vừa · Khó
                    </span>
                  </li>
                </ul>
              </div>
            </article>
            <article className="vv-bento-card">
              <div className="vv-bento-head gold">
                <span className="vv-bento-icon amber">
                  <Upload size={20} />
                </span>
                <div>
                  <span className="vv-bento-badge">
                    CÔNG CỤ AI &amp; QUẢN TRỊ LỚP HỌC B2B
                  </span>
                  <h3>
                    Chuyển Nhạc AI Tự Động, 6 Trò Chơi Học Thuật &amp; Phòng Đàn
                    Trường Nhạc
                  </h3>
                </div>
              </div>
              <div className="vv-bento-body">
                <ul className="vv-bento-list">
                  <li>
                    <Check size={15} />
                    <span>
                      Nhập Link hoặc tệp MP3/WAV/MIDI/MusicXML tự sinh bản nhạc
                      Piano &amp; Sáo C5
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      Hỏi đáp Gia sư AI theo từng ô nhịp (24 thẻ{" "}
                      <code>kb://</code>) &amp; lưu Sổ tay cá nhân
                    </span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>
                      Gói Phòng đàn B2B (<strong>39.000đ/ghế/tháng</strong>):
                      quản lý danh sách lớp CSV và xuất báo cáo
                    </span>
                  </li>
                </ul>
              </div>
            </article>
          </div>
        </section>

        <div className="gx-plans">
          {PLANS_V2.map((p) => {
            const cycle =
              p.id === "plus" ? plusCycle : Object.keys(p.cycles)[0];
            const amount = p.cycles[cycle];
            const current = account?.plan === p.id;
            return (
              <article
                key={p.id}
                className={`gx-plan ${p.id === "plus" ? "popular" : ""} ${p.badge ? "founder" : ""}`}
              >
                {p.id === "plus" && (
                  <span className="gx-ribbon">{t("pr.popular")}</span>
                )}
                {p.badge && (
                  <span className="gx-ribbon gold">
                    <Sparkles size={13} /> {t("pr.founderBadge")}
                  </span>
                )}
                <h2>{t(`pr.${p.id}`)}</h2>
                <p className="gx-plan-desc">{t(`pr.${p.id}Desc`)}</p>
                {p.id === "plus" && (
                  <div
                    className="gx-cycle"
                    role="group"
                    aria-label="Chu kỳ thanh toán Plus"
                  >
                    {PLUS_CYCLES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={plusCycle === c}
                        className={plusCycle === c ? "active" : ""}
                        onClick={() => setPlusCycle(c)}
                      >
                        {t(`pr.cycle${c[0].toUpperCase()}${c.slice(1)}`)}
                      </button>
                    ))}
                  </div>
                )}
                <Price amount={amount} cycle={cycle} />
                <small className="gx-price-sub">
                  {p.id === "plus" && cycle !== "month"
                    ? `${t("pr.perMonth", { v: vndShort(Math.round(amount / MONTHS[cycle] / 1000) * 1000) })} · ${t("pr.save", { n: savingPct(cycle) })}`
                    : p.id === "founder"
                      ? t("pr.perMonth", {
                          v: vndShort(Math.round(amount / 12 / 1000) * 1000),
                        })
                      : " "}
                </small>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>
                      <Check size={15} aria-hidden="true" /> {t(`pr.${f}`)}
                    </li>
                  ))}
                </ul>
                {current ? (
                  <button className="button button-quiet" disabled>
                    {t("pr.current")}
                  </button>
                ) : p.id === "free" ? (
                  <a
                    className="button button-quiet"
                    href={account ? "/dashboard" : "/studio?try=1&lesson=PN01"}
                  >
                    {account ? t("pr.enter") : t("pr.startFree")}{" "}
                    <ArrowRight size={15} />
                  </a>
                ) : (
                  <button
                    type="button"
                    className={`button ${p.id === "plus" || p.badge ? "button-primary" : "button-quiet"}`}
                    onClick={() => buy(p.id, cycle)}
                  >
                    {p.id === "starter"
                      ? t("pr.buyStarter")
                      : p.id === "founder"
                        ? t("pr.buyFounder")
                        : t("pr.buy")}{" "}
                    <ArrowRight size={15} />
                  </button>
                )}
              </article>
            );
          })}
        </div>

        <section className="gx-b2b" id="studio" aria-labelledby="gx-b2b-title">
          <span className="gx-b2b-icon">
            <Building2 size={26} />
          </span>
          <div>
            <span className="gx-kicker">B2B</span>
            <h2 id="gx-b2b-title">{t("pr.studio")}</h2>
            <p>{t("pr.studioDesc")}</p>
            <ul>
              {B2B_PLAN.features.map((f) => (
                <li key={f}>
                  <Check size={15} aria-hidden="true" /> {t(`pr.${f}`)}
                </li>
              ))}
            </ul>
          </div>
          <div className="gx-b2b-price">
            <strong className="gx-price">
              {vndShort(B2B_PLAN.perSeatMonth)} <small>{t("pr.perSeat")}</small>
            </strong>
            <a className="button button-primary" href="/contact?topic=b2b">
              {t("pr.b2bCta")} <ArrowRight size={15} />
            </a>
            {account?.plan === "studio" && (
              <a className="text-link" href="/studio-b2b">
                {t("pr.b2bPortal")} <ArrowRight size={14} />
              </a>
            )}
          </div>
        </section>

        <RedeemBox loggedIn={Boolean(account)} />

        <section className="gx-promise" aria-labelledby="gx-promise-title">
          <ShieldCheck size={24} />
          <div>
            <h2 id="gx-promise-title">{t("pr.refundTitle")}</h2>
            <ul>
              <li>{t("pr.refund1")}</li>
              <li>{t("pr.refund2")}</li>
              <li>{t("pr.refund3")}</li>
            </ul>
            <small>{t("pr.refundLaw")}</small>
          </div>
        </section>

        <p className="pricing-footnote">{t("pr.footnote")}</p>

        <section className="pricing-faq gx-faq" aria-labelledby="faq-title">
          <h2 id="faq-title">{t("pr.faqTitle")}</h2>
          {[1, 2, 3].map((n) => (
            <details key={n}>
              <summary>{t(`pr.q${n}`)}</summary>
              <p>{t(`pr.a${n}`)}</p>
            </details>
          ))}
        </section>
      </main>
      <CheckoutModal
        open={Boolean(checkout)}
        plan={checkout?.plan}
        cycle={checkout?.cycle}
        title={checkout?.title}
        onClose={() => setCheckout(null)}
      />
    </PageShell>
  );
}
