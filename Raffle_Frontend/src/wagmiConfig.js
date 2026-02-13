import { createConfig, http, fallback } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
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
                coinbaseWallet, // Taruh paling atas biar jadi Raja!
                metaMaskWallet,
                bitgetWallet,
                walletConnectWallet
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
            http(`https://base-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`),
            http('https://sepolia.base.org'),
        ]),
    },
    ssr: false,
});
