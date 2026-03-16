import { useState, useEffect, lazy } from 'react';

// Lazy load the heavy provider
const LazyWeb3Wallet = lazy(() => import('./components/LazyWeb3Provider'));

export function Web3Provider({ children }) {
  const [isMounted, setIsMounted] = useState(false);

  // Ensure we only render Web3 providers on the client side
  useEffect(() => {
    setIsMounted(true);
    
    // Conflict Sentinel: Detect if window.ethereum is trapped as a getter
    if (typeof window !== 'undefined') {
      const descriptor = Object.getOwnPropertyDescriptor(window, 'ethereum');
      if (descriptor && descriptor.get && !descriptor.set) {
        console.warn(
          '%c[WalletConflict] Warning: Multiple wallet extensions detected.',
          'color: #ff9800; font-weight: bold; font-size: 14px;'
        );
        console.log(
          'One or more extensions have locked "window.ethereum" as read-only. ' +
          'Crypto Disco has enabled EIP-6963 Discovery to bypass this conflict. ' +
          'If you cannot connect, please try disabling one of your wallet extensions.'
        );
      }
    }
  }, []);

  // During SSR or initial render, show loading state
  if (!isMounted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-50">
        <div className="w-12 h-12 border-t-2 border-indigo-500 rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Initializing Wallet Core...</p>
      </div>
    );
  }

  // Client-side only: render the actual Web3 providers
  return (
    <LazyWeb3Wallet>
      {children}
    </LazyWeb3Wallet>
  );
}

// Preload the Web3 bundle when the browser is idle
// This ensures it's ready before the user even clicks "Connect"
if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
  requestIdleCallback(() => {
    import('./components/LazyWeb3Provider');
  });
}
