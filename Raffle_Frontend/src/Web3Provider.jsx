import { config } from './wagmiConfig';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { useEffect, useState } from 'react';

const queryClient = new QueryClient();

export function Web3Provider({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (!import.meta.env.VITE_ALCHEMY_API_KEY) {
      console.warn('WARNING: Alchemy API Key is missing. Falling back to Public RPC.');
    }
  }, []);

  if (!mounted) return null;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme()}
          modalSize="compact"
        >
          <div className="min-h-screen bg-slate-950 text-slate-50">
            {children}
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
