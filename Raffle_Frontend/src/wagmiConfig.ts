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

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || '';
if (!projectId) console.warn('[wagmi] VITE_REOWN_PROJECT_ID is empty — WalletConnect may not work.');

// PROTOCOL COMPLIANT WALLET ORDER (Rule 4)
const connectors = connectorsForWallets(
    [
        {
            groupName: 'Recommended',
            wallets: [
                (opts) => coinbaseWallet({
                    ...opts,
                    preference: 'smartWalletOnly'
                } as any),
                metaMaskWallet,
                rainbowWallet,
                walletConnectWallet,
                rabbyWallet,
                bitgetWallet,
                ...(import.meta.env.DEV ? [() => ({
                    id: 'mock',
                    name: 'Mock Wallet',
                    iconUrl: 'https://avatars.githubusercontent.com/u/106669223?v=4',
                    iconBackground: '#fff',
                    createConnector: (details: any) => mock({
                        accounts: [import.meta.env.VITE_DEV_WALLET || ''],
                    }),
                })] : []),
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
    multiInjectedProviderDiscovery: true, // EIP-6963 support
    transports: {
        [base.id]: fallback([
            http(import.meta.env.VITE_BASE_RPC_URL),
            http('https://mainnet.base.org'),
            http('https://base.meowrpc.com'),
        ]),
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
