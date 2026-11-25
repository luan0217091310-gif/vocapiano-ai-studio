// Logger theo cấp độ, xuất JSON một dòng. LOG_LEVEL = debug | info | warn | error | silent.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export function createLogger(level = process.env.LOG_LEVEL ?? "info") {
  const min = LEVELS[level] ?? LEVELS.info;
  const log = (lvl, msg, extra) => {
    if (LEVELS[lvl] < min) return;
    const line = JSON.stringify({
      t: new Date().toISOString(),
      level: lvl,
      msg,
      ...extra,
    });
    (lvl === "error" || lvl === "warn" ? process.stderr : process.stdout).write(
      line + "\n",
    );
  };
  return {
    debug: (m, e) => log("debug", m, e),
    info: (m, e) => log("info", m, e),
    warn: (m, e) => log("warn", m, e),
    error: (m, e) => log("error", m, e),
  };
}
