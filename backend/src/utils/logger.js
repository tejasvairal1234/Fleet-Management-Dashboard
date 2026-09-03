const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = process.env.LOG_LEVEL || "info";

function formatMsg(level, msg, meta) {
  const ts = new Date().toISOString();
  const metaStr = meta ? " " + JSON.stringify(meta) : "";
  return `[${ts}] [${level.toUpperCase()}] ${msg}${metaStr}`;
}

function log(level, msg, meta) {
  if (LOG_LEVELS[level] <= LOG_LEVELS[currentLevel]) {
    const formatted = formatMsg(level, msg, meta);
    if (level === "error") console.error(formatted);
    else console.log(formatted);
  }
}

const logger = {
  error: (msg, meta) => log("error", msg, meta),
  warn:  (msg, meta) => log("warn",  msg, meta),
  info:  (msg, meta) => log("info",  msg, meta),
  debug: (msg, meta) => log("debug", msg, meta),
};

module.exports = logger;
