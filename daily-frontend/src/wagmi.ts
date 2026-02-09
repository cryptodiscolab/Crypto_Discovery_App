import { http, createConfig } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
    chains: [baseSepolia],
    connectors: [
        coinbaseWallet({
            appName: 'Crypto Disco Daily',
            preference: 'smartWalletOnly'
        }),
    ],
    transports: {
        [baseSepolia.id]: http('https://sepolia.base.org'),
    },
});
