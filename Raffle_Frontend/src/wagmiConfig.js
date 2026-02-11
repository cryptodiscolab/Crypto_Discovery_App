import { createConfig, http, fallback } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || '5ae6de312908f2d0cd512576920b78cd';

export const config = createConfig({
    appName: 'Crypto Disco',
    projectId,
    chains: [base, baseSepolia],
    connectors: [
        injected(),
        walletConnect({ projectId }),

    ],
    transports: {
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
