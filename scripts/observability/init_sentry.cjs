// scripts/observability/init_sentry.cjs
const Sentry = require("@sentry/node");
const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV || "development",
  });
  console.log("✅ Sentry initialized");
} else {
  console.warn("⚠️ Sentry DSN not configured – observability disabled");
}
