import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { NeynarContextProvider, Theme } from "@neynar/react";
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { useState, useEffect } from 'react';

// Wagmi Config
const config = getDefaultConfig({
  appName: 'NFT Raffle',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "",
  chains: [base, baseSepolia],
  ssr: false,
});

const queryClient = new QueryClient();

// Move settings outside to prevent re-creation
const neynarSettings = {
  clientId: import.meta.env.VITE_NEYNAR_CLIENT_ID || "",
  defaultTheme: Theme.Dark,
  eventsCallbacks: {
    // Empty for testing per request to debug Error #31
    onAuthSuccess: () => { },
    onSignout: () => { },
  },
};

export function Web3Provider({ children }) {
  const [mounted, setMounted] = useState(false);

  // Debugging API Key availability
  if (import.meta.env.DEV) {
    console.log("OnchainKit API Key:", import.meta.env.VITE_ONCHAINKIT_API_KEY ? "Present" : "Missing/Undefined");
  }

  // Prevent Hydration Errors
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={import.meta.env.VITE_ONCHAINKIT_API_KEY || ""}
          chain={baseSepolia} // Set to base for production
        >
          <RainbowKitProvider
            theme={darkTheme({
              accentColor: '#3b82f6',
              accentColorForeground: 'white',
              borderRadius: 'large',
              fontStack: 'system',
            })}
            modalSize="compact"
          >
            <NeynarContextProvider settings={neynarSettings}>
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
