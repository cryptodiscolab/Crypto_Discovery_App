import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { NeynarContextProvider } from "@neynar/react"; // Hapus Theme import
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { useState, useEffect } from 'react';

const config = getDefaultConfig({
  appName: 'NFT Raffle',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "PROJECT_ID_PLACEHOLDER",
  chains: [base, baseSepolia],
  ssr: false,
});

const queryClient = new QueryClient();

export function Web3Provider({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={import.meta.env.VITE_ONCHAINKIT_API_KEY || "API_KEY_PLACEHOLDER"}
          chain={baseSepolia}
        >
          <RainbowKitProvider
            theme={darkTheme()} // Pake default dark theme RainbowKit
            modalSize="compact"
          >
            {/* FIX: Ganti theme jadi string "dark", jangan pake object Enum */}
            <NeynarContextProvider
              settings={{
                clientId: import.meta.env.VITE_NEYNAR_CLIENT_ID || "CLIENT_ID_PLACEHOLDER",
                defaultTheme: "dark",
                eventsCallbacks: {},
              }}
            >
              <div className="min-h-screen bg-slate-950 text-slate-50">
                {children}
              </div>
            </NeynarContextProvider>
          </RainbowKitProvider>
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
