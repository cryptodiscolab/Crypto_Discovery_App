import { useState, useEffect } from 'react';
import { config } from '../wagmiConfig';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';

const queryClient = new QueryClient();

export default function LazyWeb3Provider({ children }) {
    const [isClient, setIsClient] = useState(false);

    // Ensure wallet providers only mount on client side
    useEffect(() => {
        setIsClient(true);
    }, []);

    // During SSR, return children without wallet providers
    if (!isClient) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-50">
                {children}
            </div>
        );
    }

    // Client-side only: render full Web3 stack (WITHOUT OnchainKitProvider)
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    appInfo={{
                        appName: 'Crypto Disco',
                        learnMoreUrl: 'https://crypto-discovery-app.vercel.app',
                    }}
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
