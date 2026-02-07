import '@rainbow-me/rainbowkit/styles.css';
import '@coinbase/onchainkit/styles.css';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { OnchainKitProvider } from '@coinbase/onchainkit';

// 1. Explicit Chain & ID Logic
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || '5ae6de312908f2d0cd512576920b78cd';

// 2. Simplify Config (Wagmi createConfig)
const config = createConfig({
  appName: 'Crypto Disco',
  projectId,
  chains: [base, baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: 'Crypto Disco',
      preference: 'smartWalletOnly',
    }),
  ],
  transports: {
    // 3. RPC Fix with Fallback
    [base.id]: http(import.meta.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org'),
    [baseSepolia.id]: http(import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
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

  // 4. Provider Alignment: OnchainKitProvider -> WagmiProvider -> QueryClientProvider
  return (
    <OnchainKitProvider
      apiKey={import.meta.env.VITE_ONCHAINKIT_API_KEY}
      chain={base}
    >
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
    </OnchainKitProvider>
  );
}
