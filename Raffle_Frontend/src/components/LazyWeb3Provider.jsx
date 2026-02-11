import { config } from '../wagmiConfig';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';

// Instantiate outside component to prevent re-creation
const queryClient = new QueryClient();

export default function LazyWeb3Provider({ children }) {
    // STRICTLY NO HOOKS HERE. Just render the tree.
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme()}
                    modalSize="compact"
                >
                    {/* Relative positioning here helps with z-index stacking context */}
                    <div className="relative min-h-screen bg-slate-950 text-slate-50">
                        {children}
                    </div>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
