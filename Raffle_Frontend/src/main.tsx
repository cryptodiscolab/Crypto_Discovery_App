import React from 'react'
import ReactDOM from 'react-dom/client'
import '@rainbow-me/rainbowkit/styles.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// 🛡️ Global & Buffer Polyfill (Surgical Fix for Web3)
import { Buffer } from 'buffer';
window.global = window;
window.Buffer = Buffer;
window.process = window.process || { env: {} };

// 🛡️ Global Fetch Interceptor (Fix 401 Unauthorized)
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    let [resource, config] = args;
    const url = typeof resource === 'string' ? resource : resource?.url;

    // Check if the request is targeting our backend verification server API
    if (url && (url.startsWith('/api') || url.includes(import.meta.env.VITE_VERIFY_SERVER_URL))) {
        const apiSecret = import.meta.env.VITE_VERIFY_API_SECRET || 'disco-secure-api-key';
        
        config = config || {};
        const headers = new Headers(config.headers || {});
        
        if (!headers.has('x-api-secret')) {
            headers.set('x-api-secret', apiSecret);
        }
        
        config.headers = headers;
    }
    
    return originalFetch(resource, config);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
