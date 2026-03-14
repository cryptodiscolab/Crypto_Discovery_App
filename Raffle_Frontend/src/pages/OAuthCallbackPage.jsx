/**
 * OAuthCallbackPage — Handles OAuth redirect from Supabase Auth.
 * This page is opened in a popup by useOAuth.js.
 * It reads the hash fragment from Supabase implicit grant, extracts the user,
 * and sends the result back to the opener window via postMessage.
 */
export function OAuthCallbackPage() {
    // Parse from both hash and search params (Supabase vs PKCE vs Implicit)
    const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
    const searchParams = new URLSearchParams(window.location.search);
    
    const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
    const errorCode = hashParams.get('error_code') || searchParams.get('error') || searchParams.get('error_code');
    const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');

    if (errorCode || (!accessToken && !searchParams.get('code'))) {
        window.opener?.postMessage({
            type: 'OAUTH_ERROR',
            error: errorDescription || 'OAuth authorization failed'
        }, window.location.origin);
        window.close();
        return null;
    }

    // Decode the JWT user from access_token (no SDK needed here to keep it light)
    try {
        if (accessToken) {
            const payload = JSON.parse(atob(accessToken.split('.')[1]));
            const provider = hashParams.get('provider_token') || searchParams.get('provider') || 'google';

            window.opener?.postMessage({
                type: 'OAUTH_SUCCESS',
                provider,
                user: {
                    id: payload.sub,
                    email: payload.email,
                    user_metadata: payload.user_metadata || {}
                }
            }, window.location.origin);
        } else {
            // If we have a 'code' (PKCE), we might need to handle it differently, 
            // but usually Supabase handles the exchange and provides the token in a follow-up redirect or via the client.
            // For now, we assume the SDK handles the redirections and we mostly get access_tokens.
            console.warn('[OAuthCallback] Received code but no access_token. PKCE flow initiated?');
        }
    } catch (e) {
        console.error('[OAuthCallback] Parse error:', e);
        window.opener?.postMessage({
            type: 'OAUTH_ERROR',
            error: 'Failed to parse OAuth token'
        }, window.location.origin);
    }

    window.close();
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0B0E14', color: '#fff', fontFamily: 'sans-serif' }}>
            <p>Completing sign-in... you may close this window.</p>
        </div>
    );
}

export default OAuthCallbackPage;
