import { useEffect, useState } from 'react';

/**
 * Hook to detect the current execution environment.
 * Context A: Farcaster Client (Warpcast)
 * Context B: Base App (Coinbase Wallet MiniKit)
 * Context C: Standard Browser
 */
export function useEnvironment() {
    const [env, setEnv] = useState({
        isFarcaster: false,
        isBaseApp: false,
        isBrowser: true,
        isReady: false
    });

    useEffect(() => {
        const detect = async () => {
            // 1. Detect Farcaster (Frame v2)
            // frame-sdk injection usually happens on window.frame
            const isFarcaster = !!(window && (window).frame || navigator.userAgent.includes('Farcaster'));

            // 2. Detect Base App (Coinbase Wallet)
            // OnchainKit/Coinbase Wallet injection
            const isBaseApp = !!(window && (window).coinbaseWalletExtension || navigator.userAgent.includes('CoinbaseWallet'));

            setEnv({
                isFarcaster,
                isBaseApp,
                isBrowser: !isFarcaster && !isBaseApp,
                isReady: true
            });
        };

        detect();
    }, []);

    return env;
}
