import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

import { http } from 'wagmi';

// Setup Config Minimalis
const config = getDefaultConfig({
  appName: 'Crypto Disco',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(import.meta.env.VITE_BASE_RPC_URL),
    [baseSepolia.id]: http(import.meta.env.VITE_BASE_SEPOLIA_RPC_URL),
  },
  ssr: false,
});

const queryClient = new QueryClient();

export function Web3Provider({ children }) {
  const [mounted, setMounted] = useState(false);

  // Prevent Hydration Error
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme()}
          modalSize="compact"
        >
          {/* Kita pasang div container biasa dulu */}
          <div className="min-h-screen bg-slate-950 text-slate-50">
            {children}
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
