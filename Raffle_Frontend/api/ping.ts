import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    const debug = req.query?.debug === '1';
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

    // Auth gate for debug mode: require CRON_SECRET bearer (server-only secret)
    let debugAuthorized = false;
    if (debug) {
        const cronSecret = process.env.CRON_SECRET || '';
        const authHeader = req.headers.authorization;
        debugAuthorized = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
    }

    const response: Record<string, unknown> = {
        message: 'Pong!',
        time: new Date().toISOString(),
    };

    // In non-production OR with valid debug auth, expose more.
    if (debug && (debugAuthorized || !isProduction)) {
        response.node_version = process.version;
        response.env_keys = Object.keys(process.env).filter(k =>
            k.includes('SUPABASE') || k.includes('SECRET') || k.includes('VITE')
        );
    }

    res.status(200).json(response);
}
