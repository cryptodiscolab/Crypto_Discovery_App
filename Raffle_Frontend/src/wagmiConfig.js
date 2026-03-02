import { createConfig, http, fallback } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
// IMPORT WAJIB DARI RAINBOWKIT:
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
    metaMaskWallet,
    coinbaseWallet,
    rainbowWallet,
    walletConnectWallet,
    rabbyWallet,
    bitgetWallet
} from '@rainbow-me/rainbowkit/wallets';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || '5ae6de312908f2d0cd512576920b78cd';

// PROTOCOL COMPLIANT WALLET ORDER (Rule 4)
const connectors = connectorsForWallets(
    [
        {
            groupName: 'Recommended',
            wallets: [
                metaMaskWallet,
                (opts) => coinbaseWallet({
                    ...opts,
                    preference: 'all'
                }),
                rainbowWallet,
                walletConnectWallet,
                rabbyWallet,
                bitgetWallet,
            ],
        },
    ],
    {
        appName: 'Crypto Disco',
        projectId,
    }
);

export const config = createConfig({
    chains: [baseSepolia],
    connectors, // Pakai connector yang udah dibungkus RainbowKit
    transports: {
        [baseSepolia.id]: fallback([
            http(`/api/rpc?chainId=${baseSepolia.id}`),
            http('https://sepolia.base.org'),
        ]),
    },
    ssr: false,
});
