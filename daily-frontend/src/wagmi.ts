import { http, createConfig } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { coinbaseWallet, injected, metaMask } from 'wagmi/connectors';

export const config = createConfig({
    chains: [baseSepolia],
    connectors: [
        coinbaseWallet({
            appName: 'Crypto Disco Daily',
            preference: 'smartWalletOnly'
        }),
        injected({ target: 'bitgetWallet' }),
        metaMask(), // Rabby often intercepts the metaMask provider
        injected() // Fallback generic injected browser wallet
    ],
    ssr: true,
    transports: {
        [baseSepolia.id]: http('https://sepolia.base.org'),
    },
});
