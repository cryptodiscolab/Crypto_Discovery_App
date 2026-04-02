/**
 * OAuthCallbackPage — Handles OAuth redirect from Supabase Auth (v3.41.0).
 *
 * Supabase now defaults to PKCE flow which does NOT include access_token in the hash.
 * Instead, it sends a `code` param that must be exchanged via the SDK.
 * This page handles BOTH implicit (hash) and PKCE (code) flows.
 *
 * Opened in a popup by useOAuth.js — posts result back via postMessage.
 */
import { useEffect, useState } from 'react';

export function OAuthCallbackPage() {
    const [status, setStatus] = useState('Processing...');

    useEffect(() => {
        async function processOAuth() {
            const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
            const searchParams = new URLSearchParams(window.location.search);

            const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
            const code = searchParams.get('code');
            const errorCode = hashParams.get('error_code') || searchParams.get('error') || searchParams.get('error_code');
            const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');

            // ─── Error case ───────────────────────────────────────────────────────
            if (errorCode) {
                setStatus('Authentication error. Closing...');
                window.opener?.postMessage({
                    type: 'OAUTH_ERROR',
                    error: errorDescription || errorCode || 'OAuth authorization failed'
                }, window.location.origin);
                setTimeout(() => window.close(), 1500);
                return;
            }

            // Detect provider from URL (Supabase includes it as query param or hash)
            const providerFromHash = hashParams.get('provider_token') ? 'google' : null;
            const providerFromSearch = searchParams.get('provider') || null;

            // ─── Flow 1: Implicit Grant (access_token in hash) ────────────────────
            if (accessToken) {
                try {
                    const payload = JSON.parse(atob(accessToken.split('.')[1]));
                    const provider = providerFromHash || providerFromSearch || payload.app_metadata?.provider || 'google';

                    window.opener?.postMessage({
                        type: 'OAUTH_SUCCESS',
                        provider,
                        user: {
                            id: payload.sub,
                            email: payload.email,
                            user_metadata: payload.user_metadata || {}
                        }
                    }, window.location.origin);
                    setStatus('Sign-in complete! Closing...');
                } catch (e) {
                    console.error('[OAuthCallback] Token parse error:', e);
                    window.opener?.postMessage({
                        type: 'OAUTH_ERROR',
                        error: 'Failed to parse OAuth token'
                    }, window.location.origin);
                }
                setTimeout(() => window.close(), 800);
                return;
            }

            // ─── Flow 2: PKCE Code Exchange (Supabase default since v2.39) ────────
            if (code) {
                setStatus('Completing sign-in...');
                try {
                    const { supabase } = await import('../lib/supabaseClient');

                    // Exchange code for session — Supabase SDK handles PKCE verification
                    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

                    if (exchangeError) throw exchangeError;

                    const user = data?.user;
                    if (!user) throw new Error('No user returned from OAuth exchange');

                    // Detect provider from user metadata
                    const appProvider = user.app_metadata?.provider || 'google';
                    const provider = providerFromSearch || (appProvider === 'twitter' ? 'twitter' : appProvider);

                    window.opener?.postMessage({
                        type: 'OAUTH_SUCCESS',
                        provider,
                        user: {
                            id: user.id,
                            email: user.email,
                            user_metadata: user.user_metadata || {}
                        }
                    }, window.location.origin);
                    setStatus('Sign-in complete! Closing...');
                } catch (e) {
                    console.error('[OAuthCallback] PKCE exchange error:', e);
                    window.opener?.postMessage({
                        type: 'OAUTH_ERROR',
                        error: e.message || 'OAuth code exchange failed'
                    }, window.location.origin);
                }
                setTimeout(() => window.close(), 800);
                return;
            }

            // ─── Fallback: No code or access_token ────────────────────────────────
            // Might be invoked directly in the same tab (not popup) — check session
            try {
                const { supabase } = await import('../lib/supabaseClient');
                const { data: sessionData } = await supabase.auth.getSession();
                const user = sessionData?.session?.user;

                if (user) {
                    const provider = user.app_metadata?.provider || 'google';
                    window.opener?.postMessage({
                        type: 'OAUTH_SUCCESS',
                        provider,
                        user: {
                            id: user.id,
                            email: user.email,
                            user_metadata: user.user_metadata || {}
                        }
                    }, window.location.origin);
                    setStatus('Sign-in complete!');
                } else {
                    window.opener?.postMessage({
                        type: 'OAUTH_ERROR',
                        error: 'No session or code found after OAuth redirect'
                    }, window.location.origin);
                    setStatus('Authentication incomplete. Please try again.');
                }
            } catch (e) {
                window.opener?.postMessage({
                    type: 'OAUTH_ERROR',
                    error: e.message || 'Session retrieval failed'
                }, window.location.origin);
            }
            setTimeout(() => window.close(), 1500);
        }

        processOAuth();
    }, []);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: '#0B0E14',
            color: '#fff',
            fontFamily: 'sans-serif',
            gap: '12px'
        }}>
            <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid #6366f1',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
            }} />
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>{status}</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

export default OAuthCallbackPage;
