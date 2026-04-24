import { createConfig, http, fallback } from 'wagmi';
import { mock, baseAccount } from 'wagmi/connectors';
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
                (opts) => coinbaseWallet({
                    ...opts,
                    preference: 'smartWalletOnly'
                }),
                metaMaskWallet,
                rainbowWallet,
                walletConnectWallet,
                rabbyWallet,
                bitgetWallet,
                () => ({
                    id: 'mock',
                    name: 'Mock Wallet',
                    iconUrl: 'https://avatars.githubusercontent.com/u/106669223?v=4',
                    iconBackground: '#fff',
                    createConnector: (details) => mock({
                        accounts: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'],
                    }),
                }),
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
    connectors: [
        ...connectors,
        mock({
            accounts: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'],
            features: {
                reconnect: true,
            },
        })
    ],
    multiInjectedProviderDiscovery: true, // EIP-6963 support
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
