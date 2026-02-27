import { config } from '../wagmiConfig';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { baseSepolia, base } from 'wagmi/chains';
import { OnchainKitProvider } from '@coinbase/onchainkit';

const queryClient = new QueryClient();

export default function LazyWeb3Provider({ children }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <OnchainKitProvider
                    apiKey={import.meta.env.VITE_ONCHAINKIT_API_KEY}
                    chain={base} // Default to base mainnet
                >
                    <RainbowKitProvider
                        theme={darkTheme()}
                        modalSize="compact"
                        initialChain={base}
                    >
                        <div className="min-h-screen bg-slate-950 text-slate-50">
                            {children}
                        </div>
                    </RainbowKitProvider>
                </OnchainKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
