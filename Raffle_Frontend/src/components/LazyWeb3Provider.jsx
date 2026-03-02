import { config } from '../wagmiConfig';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, useAccount } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { baseSepolia } from 'wagmi/chains';

// Instantiate outside component to prevent re-creation
const queryClient = new QueryClient();

// Rule 8: useAccount MUST be called inside the Provider to detect changes globally
function GlobalAccountDetector() {
    useAccount();
    return null;
}

export default function LazyWeb3Provider({ children }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme()}
                    modalSize="compact"
                    initialChain={baseSepolia}
                >
                    <GlobalAccountDetector />
                    <div className="min-h-screen bg-slate-950 text-slate-50">
                        {children}
                    </div>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
