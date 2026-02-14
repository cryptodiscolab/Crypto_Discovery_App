
import { useState, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { verifyMessage } from 'viem';
import { ensureUserProfile } from '../dailyAppLogic';

/**
 * Hook for Lightweight SIWE Authentication
 * Optimized for performance on low-end devices.
 */
export function useSIWE() {
    const { address, chain } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [session, setSession] = useState(null);

    // 1. Generate SIWE Message (Standard Format with Custom Statement)
    // Memoized to prevent unnecessary re-calculations
    const createSIWEMessage = useCallback((address, chainId, nonce, fid = null) => {
        const domain = "crypto-discovery-app.vercel.app";
        const origin = "https://crypto-discovery-app.vercel.app";
        const statement = "Sign in to Crypto Disco to verify identity and access revenue sharing features.";
        const issuedAt = new Date().toISOString();
        const expirationTime = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24 hours

        // Resources list
        const resources = [
            `uri:${origin}`,
            `chain_id:${chainId}`,
            `nonce:${nonce}`,
            `issued_at:${issuedAt}`,
            `expiration_time:${expirationTime}`
        ];

        if (fid) {
            resources.push(`farcaster://fid/${fid}`);
        }

        // Manual string construction for maximum control and performance
        const resourceLines = resources.map(r => `- ${r}`).join('\n');

        const message = `${domain} wants you to sign in with your Ethereum account:
${address}

${statement}

URI: ${origin}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}
Expiration Time: ${expirationTime}
Resources:
${resourceLines}`;

        return message;
    }, []);

    // 2. Generate Unique Nonce (8-12 alphanumeric characters)
    const generateNonce = () => {
        return Math.random().toString(36).substring(2, 12);
    };

    // 3. Main Sign-In Function
    const signIn = useCallback(async (fid = null) => {
        if (!address || !chain) {
            setError("Wallet not connected");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const chainId = chain.id;
            const nonce = generateNonce();
            const message = createSIWEMessage(address, chainId, nonce, fid);

            // Trigger Wallet Signature
            const signature = await signMessageAsync({ message });

            // Verify Signature (Client-side fast check, ideally redundant with server check)
            const valid = await verifyMessage({
                address,
                message,
                signature,
            });

            if (!valid) throw new Error("Signature verification failed");

            const userSession = {
                address,
                chainId,
                signedAt: Date.now(),
                signature
            };

            // Synchronize with SignatureGuard storage requirement
            const authStatus = {
                wallet: address,
                status: 'AUTHENTICATED',
                method: 'SIWE'
            };
            localStorage.setItem('crypto_disco_auth_status', JSON.stringify(authStatus));
            setSession(userSession);

            // Ensure User Profile Exists
            await ensureUserProfile(address);



            return userSession;

        } catch (err) {
            console.error("SIWE Error:", err);
            setError(err.message || "Sign-in failed");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [address, chain, signMessageAsync, createSIWEMessage]);

    // 4. Logout
    const logout = useCallback(() => {
        setSession(null);
        setError(null);
    }, []);

    return {
        signIn,
        logout,
        session,
        isLoading,
        error,
        isAuthenticated: !!session,
    };
}
