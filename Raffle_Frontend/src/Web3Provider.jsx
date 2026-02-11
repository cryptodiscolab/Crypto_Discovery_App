import { Suspense, lazy } from 'react';

// Lazy load the heavy provider
const LazyWeb3Wallet = lazy(() => import('./components/LazyWeb3Provider'));

export function Web3Provider({ children }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-50">
        <div className="w-12 h-12 border-t-2 border-indigo-500 rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Initializing Wallet Core...</p>
      </div>
    }>
      <LazyWeb3Wallet>
        {children}
      </LazyWeb3Wallet>
    </Suspense>
  );
}

// Preload the Web3 bundle when the browser is idle
// This ensures it's ready before the user even clicks "Connect"
if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
  requestIdleCallback(() => {
    import('./components/LazyWeb3Provider');
  });
}
