import React from 'react'
import ReactDOM from 'react-dom/client'
import '@rainbow-me/rainbowkit/styles.css'
import '../node_modules/@fortawesome/fontawesome-free/css/all.min.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import * as Sentry from '@sentry/react';

// ── Sentry Error Tracking (browser/React SDK) ─────────────────────────────────
// VITE_SENTRY_DSN must be set in Vercel environment variables (never commit the real DSN).
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.05,   // 5% of sessions in production
    replaysOnErrorSampleRate: 1.0,    // 100% when an error occurs
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION ?? 'local',
  });
}

// 🛡️ Global & Buffer Polyfill (Surgical Fix for Web3)
import { Buffer } from 'buffer';
(window as unknown as Record<string, unknown>).global = window;
(window as unknown as Record<string, unknown>).Buffer = Buffer;
(window as unknown as Record<string, unknown>).process = (window as unknown as Record<string, unknown>).process || { env: {} };

// Global fetch interceptor removed — API secret is handled server-side only

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
