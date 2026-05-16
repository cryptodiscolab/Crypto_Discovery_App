import React from 'react'
import ReactDOM from 'react-dom/client'
import '@rainbow-me/rainbowkit/styles.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// 🛡️ Global & Buffer Polyfill (Surgical Fix for Web3)
import { Buffer } from 'buffer';
(window as unknown).global = window;
(window as unknown).Buffer = Buffer;
(window as unknown).process = (window as unknown).process || { env: {} };

// Global fetch interceptor removed — API secret is handled server-side only

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
