import { createConfig, http, fallback } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
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

const activeChainId = parseInt(import.meta.env.VITE_CHAIN_ID || '8453');
const activeChain = activeChainId === 84532 ? baseSepolia : base;

export const config = createConfig({
    chains: [base, baseSepolia],
    connectors,
    transports: {
        [base.id]: http(import.meta.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org'),
        [baseSepolia.id]: fallback([
            http(import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
            http('https://sepolia.base.org'),
        ]),
    },
    batch: {
        multicall: false,
    },
    pollingInterval: 12000, 
    ssr: false,
});
