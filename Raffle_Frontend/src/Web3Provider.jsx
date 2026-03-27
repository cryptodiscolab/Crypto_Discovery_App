import { useState, useEffect, lazy } from 'react';

// Lazy load the heavy provider
const LazyWeb3Wallet = lazy(() => import('./components/LazyWeb3Provider'));

export function Web3Provider({ children }) {
  const [isMounted, setIsMounted] = useState(false);

  // Ensure we only render Web3 providers on the client side
  useEffect(() => {
    setIsMounted(true);
    
    // Conflict Sentinel: Detect and attempt to resolve window.ethereum traps
    if (typeof window !== 'undefined') {
      const descriptor = Object.getOwnPropertyDescriptor(window, 'ethereum');
      
      // Check if it's trapped as a read-only getter
      if (descriptor && descriptor.get && !descriptor.set) {
        console.warn(
          '%c[WalletConflict] Warning: Multiple wallet extensions detected.',
          'color: #ff9800; font-weight: bold; font-size: 14px;'
        );
        
        if (descriptor.configurable) {
          try {
            // Attempt to break the trap if configurable
            Object.defineProperty(window, 'ethereum', {
              value: window.ethereum, // Keep the current provider if one exists
              writable: true,
              configurable: true,
              enumerable: true
            });
            console.log('%c[WalletConflict] Resolved: Provider slot is now writable.', 'color: #4ade80; font-weight: bold;');
          } catch (e) {
            console.error('[WalletConflict] Failed to resolve trap:', e);
          }
        } else {
          console.error(
            '[WalletConflict] CRITICAL: window.ethereum is locked as read-only and NOT configurable. ' +
            'This will cause MetaMask and other legacy extensions to fail. ' +
            'Please disable conflicting extensions like Coinbase Wallet if you experience issues.'
          );
        }
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
