import '@rainbow-me/rainbowkit/styles.css';
import '@coinbase/onchainkit/styles.css';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider, createConfig, http, fallback } from 'wagmi';
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
      preference: 'all', // Ensure MetaMask/Rainbow users can login
    }),
  ],
  transports: {
    // 3. Robust RPC Fallback (Alchemy -> Public) - Aggressive Mode
    [base.id]: fallback([
      http(import.meta.env.VITE_BASE_RPC_URL || (import.meta.env.VITE_ALCHEMY_API_KEY ? `https://base-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}` : null)),
      http('https://mainnet.base.org'),
    ]),
    [baseSepolia.id]: fallback([
      http(import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || (import.meta.env.VITE_ALCHEMY_API_KEY ? `https://base-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}` : null)),
      http('https://sepolia.base.org'),
    ]),
  },
  ssr: false,
  reconnectOnMount: true,
});

const queryClient = new QueryClient();

export function Web3Provider({ children }) {
  const [mounted, setMounted] = useState(false);

  // Prevent Hydration Error & Validate Keys
  useEffect(() => {
    setMounted(true);

    // API KEY Validation
    if (!import.meta.env.VITE_ONCHAINKIT_API_KEY) {
      console.error('CRITICAL: OnchainKit API Key is missing!');
    }
    if (!import.meta.env.VITE_ALCHEMY_API_KEY) {
      console.warn('WARNING: Alchemy API Key is missing. Falling back to Public RPC.');
    }
  }, []);

  if (!mounted) return null;

  const onchainKitApiKey = import.meta.env.VITE_ONCHAINKIT_API_KEY;

  // Debug API Key
  if (!onchainKitApiKey) {
    console.warn("VITE_ONCHAINKIT_API_KEY is missing! Using fallback or restricted mode.");
  }

  // 4. Provider Alignment: OnchainKitProvider -> WagmiProvider -> QueryClientProvider
  return (
    <OnchainKitProvider
      apiKey={onchainKitApiKey}
      chain={base}
      config={{
        appearance: {
          name: 'Crypto Disco',
          logo: 'https://crypto-discovery-app.vercel.app/favicon.ico',
          mode: 'dark',
        },
        wallet: {
          display: 'handle',
          isStandalone: false, // Ensure app opens in wallet browser on mobile
        },
        appDomain: 'crypto-discovery-app.vercel.app'
      }}
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
