// Khối gamification trên Dashboard: cấp độ/XP, huy hiệu, mục tiêu tuần cá nhân, checklist làm quen.
import {
  Award,
  CheckCircle2,
  Circle,
  Flame,
  Lock,
  Play,
  Target,
  Trophy,
} from "lucide-react";
import { useEffect, useState } from "react";
import { commerce } from "../api/client.js";
import { BADGE_CATALOG } from "./badges.js";
import { readProductState, updateProductState } from "../productStore.js";
import { t } from "../i18n/index.js";

export function LevelCard({ progress }) {
  const xp = progress.totals.xp;
  const level = progress.level;
  const floor = 50 * (level - 1) ** 2;
  const ceil = 50 * level ** 2;
  const pct = Math.round(((xp - floor) / (ceil - floor)) * 100);
  return (
    <article className="gm-card gm-level">
      <div className="gm-level-head">
        <span className="gm-chip">
          <Flame size={15} /> {progress.streak.current} ngày liên tiếp
        </span>
        <span className="gm-muted">Kỷ lục {progress.streak.best} ngày</span>
      </div>
      <strong className="gm-level-num">Cấp {level}</strong>
      <div
        className="gm-bar"
        role="progressbar"
        aria-valuemin={floor}
        aria-valuemax={ceil}
        aria-valuenow={xp}
        aria-label="XP tới cấp tiếp theo"
      >
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="gm-muted">
        {xp} XP · còn {ceil - xp} XP lên cấp {level + 1}
      </span>
      {!progress.streak.practicedToday && (
        <p className="gm-nudge">Tập một lượt hôm nay để giữ chuỗi ngày nhé!</p>
      )}
    </article>
  );
}

export function BadgesCard({ progress }) {
  const earned = new Map(progress.badges.map((b) => [b.id, b]));
  return (
    <article className="gm-card">
      <h3>
        <Award size={17} /> Huy hiệu ({earned.size}/{BADGE_CATALOG.length})
      </h3>
      <ul className="gm-badges">
        {BADGE_CATALOG.map((b) => {
          const got = earned.get(b.id);
          return (
            <li
              key={b.id}
              className={got ? "earned" : ""}
              title={b.description}
            >
              <span className="gm-badge-icon" aria-hidden="true">
                {got ? <Trophy size={18} /> : <Lock size={16} />}
              </span>
              <strong>{b.title}</strong>
              <small>
                {got
                  ? `Đạt ${new Date(got.earnedAt).toLocaleDateString("vi-VN")}`
                  : b.description}
              </small>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

const GOALS = [30, 60, 90, 150];

/** Thứ Hai của tuần chứa ngày `day` (YYYY-MM-DD, giờ VN). */
const mondayOf = (day) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

/**
 * Mục tiêu tuần cá nhân (thay bảng xếp hạng: D-30 / AP-3 — không so sánh người học với nhau).
 * Thanh tiến độ phút tập + chuỗi ngày + 6 huy hiệu + nút tiếp tục bài gần nhất.
 */
export function WeeklyGoalCard({ progress, sessions, lastLesson, today }) {
  const [goal, setGoal] = useState(
    () => readProductState().weeklyGoalMin ?? 60,
  );
  useEffect(() => {
    commerce
      .weeklyGoal()
      .then((g) => {
        if (g?.minutes && GOALS.includes(g.minutes)) {
          setGoal(g.minutes);
          updateProductState({ weeklyGoalMin: g.minutes });
        }
      })
      .catch(() => {});
  }, []);
  const monday = mondayOf(today);
  const prevMonday = mondayOf(
    new Date(new Date(`${monday}T00:00:00Z`).getTime() - 86400_000)
      .toISOString()
      .slice(0, 10),
  );
  const sum = (from, to) =>
    Math.round(
      sessions
        .filter((s) => s.day >= from && (!to || s.day < to))
        .reduce((n, s) => n + (s.durationS ?? 0), 0) / 60,
    );
  const done = sum(monday);
  const lastWeek = sum(prevMonday, monday);
  const pct = Math.min(100, Math.round((done / goal) * 100));
  const earned = new Set((progress?.badges ?? []).map((b) => b.id));
  const streak = progress?.streak ?? { current: 0, best: 0 };
  return (
    <article className="gm-card gx-goal">
      <div className="gx-goal-head">
        <div>
          <span className="gx-kicker">
            <Target size={13} /> {t("db.goalKicker")}
          </span>
          <h3>{t("db.goalTitle", { done, goal })}</h3>
        </div>
        <label className="gx-goal-select">
          {t("db.goalEdit")}
          <select
            value={goal}
            onChange={(e) => {
              const v = Number(e.target.value);
              setGoal(v);
              updateProductState({ weeklyGoalMin: v });
              commerce.setWeeklyGoal(v, 3).catch(() => {});
            }}
          >
            {GOALS.map((g) => (
              <option key={g} value={g}>
                {g} {t("db.goalPerWeek")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="gm-bar gx-goal-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(done, goal)}
        aria-label={t("db.goalTitle", { done, goal })}
      >
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className="gm-muted">
        {done >= goal ? t("db.goalDone") : t("db.goalLeft", { n: goal - done })}{" "}
        · {t("db.lastWeek", { n: lastWeek })}
      </p>
      <div className="gx-goal-row">
        <span className="gm-chip">
          <Flame size={15} /> {t("db.streak", { n: streak.current })}
        </span>
        <span className="gm-muted">{t("db.best", { n: streak.best })}</span>
        <span className="gm-muted">
          {streak.practicedToday ? t("db.todayOk") : t("db.today")}
        </span>
      </div>
      <ul
        className="gx-goal-badges"
        aria-label={t("db.badges", { n: earned.size, t: BADGE_CATALOG.length })}
      >
        {BADGE_CATALOG.map((b) => (
          <li
            key={b.id}
            className={earned.has(b.id) ? "earned" : ""}
            title={`${b.title} — ${b.description}`}
          >
            {earned.has(b.id) ? <Trophy size={16} /> : <Lock size={14} />}
            <span>{b.title}</span>
          </li>
        ))}
      </ul>
      <div className="gx-goal-foot">
        <a
          className="button button-primary"
          href={`/studio?lesson=${encodeURIComponent(lastLesson)}`}
        >
          <Play size={15} fill="currentColor" /> {t("db.continue")}
        </a>
        <small className="gm-muted">{t("db.compareNote")}</small>
      </div>
    </article>
  );
}

export function ChecklistCard({
  account,
  onboarding,
  progress,
  favorites,
  viewed3d,
}) {
  const steps = [
    ["Tạo tài khoản", true],
    ["Xác minh email", account?.emailVerified],
    ["Hoàn tất khảo sát đầu vào", onboarding?.complete],
    ["Lưu một bài yêu thích", favorites > 0],
    ["Hoàn thành lượt luyện đầu tiên", progress?.totals.sessions > 0],
    ["Xem tay mẫu 3D", viewed3d],
  ];
  const done = steps.filter(([, ok]) => ok).length;
  if (done === steps.length) return null;
  return (
    <article className="gm-card">
      <h3>
        Bắt đầu với VocaVerse · {done}/{steps.length}
      </h3>
      <ul className="gm-check">
        {steps.map(([label, ok]) => (
          <li key={label} className={ok ? "done" : ""}>
            {ok ? <CheckCircle2 size={16} /> : <Circle size={16} />} {label}
          </li>
        ))}
      </ul>
    </article>
  );
}
