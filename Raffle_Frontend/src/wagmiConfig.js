import { createConfig, http, fallback } from 'wagmi';
import { baseSepolia, base } from 'wagmi/chains';
// IMPORT WAJIB DARI RAINBOWKIT:
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
    coinbaseWallet,
    metaMaskWallet,
    bitgetWallet,
    walletConnectWallet
} from '@rainbow-me/rainbowkit/wallets';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || '5ae6de312908f2d0cd512576920b78cd';

// KITA SUSUN URUTAN DOMPETNYA DI SINI
const connectors = connectorsForWallets(
    [
        {
            groupName: 'Recommended',
            wallets: [
                coinbaseWallet({
                    projectId,
                    appName: 'Crypto Disco',
                    preference: 'all' // Support Smart Wallet + Extension
                }),
                metaMaskWallet({ projectId }),
                bitgetWallet({ projectId }),
                walletConnectWallet({ projectId })
            ],
        },
    ],
    {
        appName: 'Crypto Disco',
        projectId,
        // METADATA WAJIB BUAT DEEP LINK MOBILE:
        appDescription: 'Crypto Discovery App on Base',
        appUrl: 'https://y-app.vercel.app',
        appIcon: 'https://y-app.vercel.app/og-image.png',
    }
);

export const config = createConfig({
    chains: [base, baseSepolia],
    connectors, // Pakai connector yang udah dibungkus RainbowKit
    transports: {
        [base.id]: fallback([
            http(`https://base-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`),
            http('https://mainnet.base.org'),
        ]),
        [baseSepolia.id]: fallback([
            http(`https://base-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`),
            http('https://sepolia.base.org'),
        ]),
    },
    ssr: false,
});
