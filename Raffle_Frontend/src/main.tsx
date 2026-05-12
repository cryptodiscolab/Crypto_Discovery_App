import React from 'react'
import ReactDOM from 'react-dom/client'
import '@rainbow-me/rainbowkit/styles.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// 🛡️ Global & Buffer Polyfill (Surgical Fix for Web3)
import { Buffer } from 'buffer';
(window as any).global = window;
(window as any).Buffer = Buffer;
(window as any).process = (window as any).process || { env: {} };

// Global fetch interceptor removed — API secret is handled server-side only

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
