import { useState, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import toast from 'react-hot-toast';

const _SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const _SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type OAuthProvider = 'google' | 'x';

type OAuthUser = {
    id: string;
    email?: string;
    user_metadata?: {
        full_name?: string;
        name?: string;
        avatar_url?: string;
        picture?: string;
        user_name?: string;
        preferred_username?: string;
        provider_id?: string;
    };
};

type OAuthResultPayload = {
    type?: string;
    provider?: string;
    user?: OAuthUser;
    error?: string;
};

const OAUTH_RESULT_CHANNEL = 'crypto-disco-oauth-result';
const OAUTH_RESULT_KEY = 'crypto-disco:oauth:result';

const getProviderResultKey = (provider: OAuthProvider) => `${OAUTH_RESULT_KEY}:${provider}`;

const isProviderMatch = (requestedProvider: OAuthProvider, responseProvider?: string) => {
    if (!responseProvider) return true;
    const normalized = responseProvider.toLowerCase().trim();
    if (requestedProvider === 'x') return normalized === 'x' || normalized === 'twitter';
    return normalized === requestedProvider;
};

const parseOAuthResult = (value: unknown): OAuthResultPayload | null => {
    if (!value) return null;
    if (typeof value === 'string') {
        try {
            return parseOAuthResult(JSON.parse(value));
        } catch {
            return null;
        }
    }
    if (typeof value !== 'object') return null;
    const payload = value as OAuthResultPayload;
    if (payload.type !== 'OAUTH_SUCCESS' && payload.type !== 'OAUTH_ERROR') return null;
    return payload;
};

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
    const [linkedGoogle, setLinkedGoogle] = useState<{ email: string; id: string } | null>(null);
    const [linkedX, setLinkedX] = useState<{ username: string; id: string } | null>(null);

    /**
     * Internal: Call the Supabase OAuth sign-in popup.
     * Uses Supabase SDK to handle PKCE/State coordination automatically.
     */
    const openSupabaseOAuth = useCallback(async (provider: OAuthProvider): Promise<OAuthUser> => {
        const { supabase } = await import('../lib/supabaseClient');

        const redirectTo = `${window.location.origin}/oauth-callback`;

        // Use SDK to get the authorization URL.
        // skipBrowserRedirect: true prevents it from redirecting the current tab.
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo,
                skipBrowserRedirect: true,
            },
        });

        if (error) throw error;
        if (!data.url) throw new Error('Failed to generate OAuth URL');

        // Open in popup window
        const popup = window.open(data.url, `${provider}_oauth`, 'width=600,height=700,scrollbars=yes');
        if (!popup) throw new Error('OAuth popup was blocked by the browser');

        return new Promise((resolve, reject) => {
            let resolved = false;
            let timeout: ReturnType<typeof setTimeout> | null = null;
            const providerResultKey = getProviderResultKey(provider);
            let channel: BroadcastChannel | null = null;

            const cleanup = () => {
                window.removeEventListener('message', handleMessage);
                window.removeEventListener('storage', handleStorage);
                if (channel) {
                    channel.close();
                    channel = null;
                }
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
            };

            const handleOAuthResult = (value: unknown) => {
                const payload = parseOAuthResult(value);
                if (!payload || resolved) return;
                // Provider alias matching: Supabase OAuth 2.0 uses 'x'; legacy sessions may report 'twitter'.
                const msgProvider = payload.provider;
                const providerMatch = isProviderMatch(provider, msgProvider);

                if (payload.type === 'OAUTH_SUCCESS' && providerMatch && payload.user) {
                    resolved = true;
                    cleanup();
                    try { localStorage.removeItem(providerResultKey); localStorage.removeItem(OAUTH_RESULT_KEY); } catch { /* ignore storage errors */ }
                    resolve(payload.user);
                } else if (payload.type === 'OAUTH_ERROR' && providerMatch) {
                    resolved = true;
                    cleanup();
                    try { localStorage.removeItem(providerResultKey); localStorage.removeItem(OAUTH_RESULT_KEY); } catch { /* ignore storage errors */ }
                    reject(new Error(payload.error || 'OAuth failed'));
                }
            };

            const handleMessage = (event: MessageEvent) => {
                // Security check: Only trust messages from our own origin
                if (event.origin !== window.location.origin) return;
                handleOAuthResult(event.data);
            };

            const handleStorage = (event: StorageEvent) => {
                if (event.key !== providerResultKey && event.key !== OAUTH_RESULT_KEY) return;
                handleOAuthResult(event.newValue);
            };

            try { localStorage.removeItem(providerResultKey); localStorage.removeItem(OAUTH_RESULT_KEY); } catch { /* ignore storage errors */ }
            window.addEventListener('message', handleMessage);
            window.addEventListener('storage', handleStorage);
            if ('BroadcastChannel' in window) {
                channel = new BroadcastChannel(OAUTH_RESULT_CHANNEL);
                channel.onmessage = (event) => handleOAuthResult(event.data);
            }

            // COOP Compatibility Fix:
            // Do not poll popup.closed: Chromium can report true prematurely when OAuth redirects
            // cross-origin, which makes an active X authorization window look user-closed.
            // Rely on callback postMessage/localStorage/BroadcastChannel and a bounded timeout instead.
            timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    try { localStorage.removeItem(providerResultKey); localStorage.removeItem(OAUTH_RESULT_KEY); } catch { /* ignore storage errors */ }
                    reject(new Error('OAuth timeout: No response received from popup after 5 minutes. Please try again.'));
                    try { popup.close(); } catch (e) { /* ignore isolation errors */ }
                }
            }, 300000); // 5 minutes
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

            // Get session token (Zero-Trust)
            const { supabase } = await import('../lib/supabaseClient');
            const { data: { session } } = await supabase.auth.getSession();
            const oauthToken = session?.access_token;

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
                    oauth_token: oauthToken,
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

            setLinkedGoogle({ email: oauthUser.email || '', id: oauthUser.id || '' });
            toast.success(`Google linked: ${oauthUser.email}`, { id: tid, duration: 5000 });
            return { success: true, email: oauthUser.email };

        } catch (err: unknown) {
            console.error('[linkGoogle]', err);
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(msg || 'Google link failed', { id: tid });
            return { success: false, error: msg };
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
            const oauthUser = await openSupabaseOAuth('x');

            const twitterUsername = oauthUser.user_metadata?.user_name || oauthUser.user_metadata?.preferred_username;
            const twitterId = oauthUser.user_metadata?.provider_id || oauthUser.id;

            // Get session token (Zero-Trust)
            const { supabase } = await import('../lib/supabaseClient');
            const { data: { session } } = await supabase.auth.getSession();
            const oauthToken = session?.access_token;

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
                    oauth_token: oauthToken,
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

            setLinkedX({ username: twitterUsername || '', id: twitterId || '' });
            toast.success(`X linked: @${twitterUsername}`, { id: tid, duration: 5000 });
            return { success: true, username: twitterUsername };

        } catch (err: unknown) {
            console.error('[linkX]', err);
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(msg || 'X link failed', { id: tid });
            return { success: false, error: msg };
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
