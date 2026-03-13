import { useState, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import toast from 'react-hot-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * useOAuth — Hook to link Google or X (Twitter) OAuth identity to the connected wallet.
 *
 * Flow:
 *  1. User connects wallet (handled by wagmi / SIWE — upstream)
 *  2. User clicks "Connect Google" or "Connect X" → OAuth popup opens via Supabase Auth
 *  3. After redirect, Supabase returns user identity (id, email, pfp)
 *  4. Hook signs a message with the wallet, then calls POST /api/user-bundle?action=sync-oauth
 *  5. Backend verifies signature + Sybil lock → saves google_id / twitter_id to user_profiles
 *
 * Compliance:
 *  - Zero-Trust: No direct DB write from frontend
 *  - Zero-Hardcode: All XP/settings dynamic from backend
 *  - Identity Lock: 1 OAuth account : 1 wallet (enforced server-side)
 */
export function useOAuth() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [isLinking, setIsLinking] = useState(false);
    const [linkedGoogle, setLinkedGoogle] = useState(null);
    const [linkedX, setLinkedX] = useState(null);

    /**
     * Internal: Call the Supabase OAuth sign-in popup via redirects.
     * Uses Supabase REST API's implicit grant (no SDK needed — keeps bundle slim).
     */
    const openSupabaseOAuth = useCallback(async (provider) => {
        if (!SUPABASE_URL) throw new Error('Supabase URL not configured');

        const redirectTo = `${window.location.origin}/oauth-callback`;
        const oauthUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}&response_type=token`;

        // Open in popup window
        const popup = window.open(oauthUrl, `${provider}_oauth`, 'width=600,height=700,scrollbars=yes');

        return new Promise((resolve, reject) => {
            let resolved = false;

            const handleMessage = (event) => {
                if (event.origin !== window.location.origin) return;
                if (event.data?.type === 'OAUTH_SUCCESS' && event.data?.provider === provider) {
                    resolved = true;
                    window.removeEventListener('message', handleMessage);
                    clearInterval(pollClose);
                    resolve(event.data.user);
                } else if (event.data?.type === 'OAUTH_ERROR') {
                    resolved = true;
                    window.removeEventListener('message', handleMessage);
                    clearInterval(pollClose);
                    reject(new Error(event.data.error || 'OAuth failed'));
                }
            };

            window.addEventListener('message', handleMessage);

            // Poll for popup close (user cancelled)
            const pollClose = setInterval(() => {
                if (popup?.closed && !resolved) {
                    resolved = true;
                    clearInterval(pollClose);
                    window.removeEventListener('message', handleMessage);
                    reject(new Error('OAuth popup closed by user'));
                }
            }, 500);
        });
    }, []);

    /**
     * linkGoogle — Open Google OAuth popup, then bind identity to wallet.
     */
    const linkGoogle = useCallback(async () => {
        if (!address) {
            toast.error('Connect your wallet first');
            return;
        }

        setIsLinking(true);
        const tid = toast.loading('Opening Google sign-in...');

        try {
            // 1. OAuth popup
            const oauthUser = await openSupabaseOAuth('google');

            // 2. Sign wallet message (Zero-Trust)
            const timestamp = new Date().toISOString();
            const message = `Link Google Account to Wallet\nWallet: ${address}\nGoogle: ${oauthUser.email}\nTimestamp: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            toast.loading('Syncing identity...', { id: tid });

            // 3. Send to backend
            const res = await fetch('/api/user-bundle', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    action: 'sync-oauth',
                    wallet_address: address,
                    signature,
                    message,
                    provider: 'google',
                    oauth_data: {
                        google_id: oauthUser.id,
                        google_email: oauthUser.email,
                        name: oauthUser.user_metadata?.full_name || oauthUser.user_metadata?.name,
                        pfp_url: oauthUser.user_metadata?.avatar_url || oauthUser.user_metadata?.picture
                    }
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Sync failed');

            setLinkedGoogle({ email: oauthUser.email, id: oauthUser.id });
            toast.success(`Google linked: ${oauthUser.email}`, { id: tid, duration: 5000 });
            return { success: true, email: oauthUser.email };

        } catch (err) {
            console.error('[linkGoogle]', err);
            toast.error(err.message || 'Google link failed', { id: tid });
            return { success: false, error: err.message };
        } finally {
            setIsLinking(false);
        }
    }, [address, signMessageAsync, openSupabaseOAuth]);

    /**
     * linkX — Open X (Twitter) OAuth popup, then bind identity to wallet.
     */
    const linkX = useCallback(async () => {
        if (!address) {
            toast.error('Connect your wallet first');
            return;
        }

        setIsLinking(true);
        const tid = toast.loading('Opening X sign-in...');

        try {
            // 1. OAuth popup
            const oauthUser = await openSupabaseOAuth('twitter');

            const twitterUsername = oauthUser.user_metadata?.user_name || oauthUser.user_metadata?.preferred_username;
            const twitterId = oauthUser.user_metadata?.provider_id || oauthUser.id;

            // 2. Sign wallet message (Zero-Trust)
            const timestamp = new Date().toISOString();
            const message = `Link X Account to Wallet\nWallet: ${address}\nX: @${twitterUsername}\nTimestamp: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            toast.loading('Syncing identity...', { id: tid });

            // 3. Send to backend
            const res = await fetch('/api/user-bundle', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    action: 'sync-oauth',
                    wallet_address: address,
                    signature,
                    message,
                    provider: 'x',
                    oauth_data: {
                        twitter_id: twitterId,
                        twitter_username: twitterUsername,
                        name: oauthUser.user_metadata?.name,
                        pfp_url: oauthUser.user_metadata?.avatar_url || oauthUser.user_metadata?.picture
                    }
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Sync failed');

            setLinkedX({ username: twitterUsername, id: twitterId });
            toast.success(`X linked: @${twitterUsername}`, { id: tid, duration: 5000 });
            return { success: true, username: twitterUsername };

        } catch (err) {
            console.error('[linkX]', err);
            toast.error(err.message || 'X link failed', { id: tid });
            return { success: false, error: err.message };
        } finally {
            setIsLinking(false);
        }
    }, [address, signMessageAsync, openSupabaseOAuth]);

    return {
        linkGoogle,
        linkX,
        isLinking,
        linkedGoogle,
        linkedX
    };
}
