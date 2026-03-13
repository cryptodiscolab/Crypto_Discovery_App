/**
 * OAuthCallbackPage — Handles OAuth redirect from Supabase Auth.
 * This page is opened in a popup by useOAuth.js.
 * It reads the hash fragment from Supabase implicit grant, extracts the user,
 * and sends the result back to the opener window via postMessage.
 */
export function OAuthCallbackPage() {
    const params = new URLSearchParams(window.location.hash.replace('#', '?'));
    const accessToken = params.get('access_token');
    const errorCode = params.get('error_code');
    const errorDescription = params.get('error_description');

    if (errorCode || !accessToken) {
        window.opener?.postMessage({
            type: 'OAUTH_ERROR',
            error: errorDescription || 'OAuth authorization failed'
        }, window.location.origin);
        window.close();
        return null;
    }

    // Decode the JWT user from access_token (no SDK needed — pure decode)
    try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const provider = params.get('provider_token') ? 'twitter' : 'google';

        window.opener?.postMessage({
            type: 'OAUTH_SUCCESS',
            provider,
            user: {
                id: payload.sub,
                email: payload.email,
                user_metadata: payload.user_metadata || {}
            }
        }, window.location.origin);
    } catch (e) {
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
