import { useAccount, useBalance, useChainId } from 'wagmi';
import { useMemo } from 'react';

export interface TokenInfo {
    symbol: string;
    name: string;
    address: `0x${string}` | undefined;
    decimals: number;
    icon?: string;
}

export const ALLOWED_TOKENS: Record<number, TokenInfo[]> = {
    8453: [
        { symbol: 'ETH', name: 'Ethereum', address: undefined, decimals: 18, icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' },
        { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
        { symbol: 'DEGEN', name: 'Degen', address: '0x4ed4e862860bed51a9570b96d89a2e17694a5a90', decimals: 18, icon: 'https://basescan.org/token/images/degen_32.png' },
        { symbol: 'WETH', name: 'Wrapped Ether', address: '0x4200000000000000000000000000000000000006', decimals: 18, icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' }
    ],
    84532: [
        { symbol: 'ETH', name: 'Ethereum', address: undefined, decimals: 18, icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' },
        { symbol: 'USDC', name: 'USD Coin', address: '0x036cbd53842c5426634e7929541ec2318f3dcf7e', decimals: 6, icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
        { symbol: 'WETH', name: 'Wrapped Ether', address: '0x4200000000000000000000000000000000000006', decimals: 18, icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' }
    ]
};

export function useTokenBalances() {
    const { address } = useAccount();
    const chainId = useChainId();
    
    const tokens = useMemo(() => {
        return ALLOWED_TOKENS[chainId] || ALLOWED_TOKENS[8453];
    }, [chainId]);

    // This is a bit inefficient as it creates multiple hooks in a loop if we were to do it that way,
    // but since the list is small and static, we can define them explicitly or use a more advanced multicall hook.
    // For now, let's just fetch ETH and USDC as primary ones, or use a custom multicall.
    
    // Actually, wagmi hooks must be called at the top level. 
    // We'll fetch them individually for the common ones.
    
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
        return [
            { ...tokens.find(t => t.symbol === 'ETH'), balance: eth.data, isLoading: eth.isLoading },
            { ...tokens.find(t => t.symbol === 'USDC'), balance: usdc.data, isLoading: usdc.isLoading },
            { ...tokens.find(t => t.symbol === 'WETH'), balance: weth.data, isLoading: weth.isLoading },
            ...(chainId === 8453 ? [{ ...tokens.find(t => t.symbol === 'DEGEN'), balance: degen.data, isLoading: degen.isLoading }] : [])
        ].filter(t => t.symbol);
    }, [eth.data, eth.isLoading, usdc.data, usdc.isLoading, weth.data, weth.isLoading, degen.data, degen.isLoading, tokens, chainId]);

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
