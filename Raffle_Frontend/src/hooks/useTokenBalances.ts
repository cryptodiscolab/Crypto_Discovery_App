import { useAccount, useBalance, useChainId } from 'wagmi';
import { useEffect, useMemo, useState } from 'react';

export interface TokenInfo {
    symbol: string;
    name: string;
    address: `0x${string}` | undefined;
    decimals: number;
    icon?: string;
}

// Native zero-address constant - the only hardcoded primitive needed.
const NATIVE_ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Fallback tokens (used only when backend is unreachable). Backend `allowed_tokens` is the source of truth.
const FALLBACK_TOKENS: Record<number, TokenInfo[]> = {
    8453: [
        { symbol: 'ETH', name: 'Ethereum', address: undefined, decimals: 18, icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' },
        { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
        { symbol: 'WETH', name: 'Wrapped Ether', address: '0x4200000000000000000000000000000000000006', decimals: 18, icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' }
    ],
    84532: [
        { symbol: 'ETH', name: 'Ethereum', address: undefined, decimals: 18, icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' },
        { symbol: 'USDC', name: 'USD Coin', address: '0x036cbd53842c5426634e7929541ec2318f3dcf7e', decimals: 6, icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
        { symbol: 'WETH', name: 'Wrapped Ether', address: '0x4200000000000000000000000000000000000006', decimals: 18, icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' }
    ]
};

// Public for backwards compatibility — represents the static fallback list.
export const ALLOWED_TOKENS: Record<number, TokenInfo[]> = FALLBACK_TOKENS;

interface BackendToken {
    address: string;
    chain_id: number;
    decimals: number;
    symbol: string;
    is_active?: boolean | null;
}

function backendTokensToInfoList(rows: BackendToken[], chainId: number): TokenInfo[] {
    const filtered = rows.filter(r => r.chain_id === chainId && r.is_active !== false);
    const tokens: TokenInfo[] = [
        // Native ETH always present (not stored in DB)
        { symbol: 'ETH', name: 'Ethereum', address: undefined, decimals: 18 }
    ];
    for (const r of filtered) {
        const addr = (r.address || '').toLowerCase();
        if (!addr || addr === NATIVE_ZERO_ADDRESS) continue; // skip placeholders for native
        tokens.push({
            symbol: r.symbol,
            name: r.symbol,
            address: addr as `0x${string}`,
            decimals: r.decimals
        });
    }
    return tokens;
}

export function useTokenBalances() {
    const { address } = useAccount();
    const chainId = useChainId();
    const [backendTokens, setBackendTokens] = useState<TokenInfo[] | null>(null);

    // Load whitelisted tokens from backend; fall back to static list on failure
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/user-bundle?action=get-point-settings');
                if (!res.ok) throw new Error(`status ${res.status}`);
                const data = await res.json();
                const rows: BackendToken[] = data?.settings?.allowed_tokens || data?.allowed_tokens || [];
                if (Array.isArray(rows) && rows.length > 0 && !cancelled) {
                    setBackendTokens(backendTokensToInfoList(rows, chainId));
                }
            } catch {
                // swallow — useMemo below will use fallback
            }
        })();
        return () => { cancelled = true; };
    }, [chainId]);

    const tokens = useMemo(() => {
        if (backendTokens && backendTokens.length > 0) return backendTokens;
        return FALLBACK_TOKENS[chainId] || FALLBACK_TOKENS[8453];
    }, [chainId, backendTokens]);

    const eth = useBalance({ address });

    const usdc = useBalance({
        address,
        token: tokens.find(t => t.symbol === 'USDC')?.address
    });

    const degen = useBalance({
        address,
        token: tokens.find(t => t.symbol === 'DEGEN')?.address
    });

    const weth = useBalance({
        address,
        token: tokens.find(t => t.symbol === 'WETH')?.address
    });

    const balances = useMemo(() => {
        const ethToken = tokens.find(t => t.symbol === 'ETH');
        const usdcToken = tokens.find(t => t.symbol === 'USDC');
        const wethToken = tokens.find(t => t.symbol === 'WETH');
        const degenToken = tokens.find(t => t.symbol === 'DEGEN');
        return [
            ethToken && { ...ethToken, balance: eth.data, isLoading: eth.isLoading },
            usdcToken && { ...usdcToken, balance: usdc.data, isLoading: usdc.isLoading },
            wethToken && { ...wethToken, balance: weth.data, isLoading: weth.isLoading },
            degenToken && { ...degenToken, balance: degen.data, isLoading: degen.isLoading }
        ].filter((t): t is NonNullable<typeof t> => Boolean(t && t.symbol));
    }, [eth.data, eth.isLoading, usdc.data, usdc.isLoading, weth.data, weth.isLoading, degen.data, degen.isLoading, tokens]);

    return {
        balances,
        isLoading: eth.isLoading || usdc.isLoading || weth.isLoading || degen.isLoading,
        refetch: () => {
            eth.refetch();
            usdc.refetch();
            weth.refetch();
            degen.refetch();
        }
    };
}
