import { createConfig, http, fallback } from 'wagmi';
import { baseSepolia, base } from 'wagmi/chains';
// IMPORT WAJIB DARI RAINBOWKIT:
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
    coinbaseWallet,
    metaMaskWallet,
    bitgetWallet,
    rabbyWallet,
    walletConnectWallet
} from '@rainbow-me/rainbowkit/wallets';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || '5ae6de312908f2d0cd512576920b78cd';

// KITA SUSUN URUTAN DOMPETNYA DI SINI
const connectors = connectorsForWallets(
    [
        {
            groupName: 'Recommended',
            wallets: [
                (opts) => coinbaseWallet({
                    ...opts,
                    preference: 'all'
                }),
                metaMaskWallet,
                bitgetWallet,
                rabbyWallet,
                walletConnectWallet,
            ],
        },
    ],
    {
        appName: 'Crypto Disco',
        projectId,
    }
);

export const config = createConfig({
    chains: [base, baseSepolia],
    connectors, // Pakai connector yang udah dibungkus RainbowKit
    transports: {
        [base.id]: fallback([
            http(`/api/rpc?chainId=${base.id}`),
            http('https://mainnet.base.org'),
        ]),
        [baseSepolia.id]: fallback([
            http(`/api/rpc?chainId=${baseSepolia.id}`),
            http('https://sepolia.base.org'),
        ]),
    },
    ssr: false,
});
