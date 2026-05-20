import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as Sentry from "@sentry/node";
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types.js';
import { getEnv } from './constants.js';

// In‑memory store for rate limiting (auto-pruned periodically)
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();
const LIMIT = 60; // Max 60 requests per window
const WINDOW_MS = 60 * 1000; // 1 minute window

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitCache.entries()) {
        if (now > value.resetTime) {
            rateLimitCache.delete(key);
        }
    }
}, WINDOW_MS);

/**
 * Higher-order function wrapper to inject Observability (Sentry), 
 * Rate-Limiting, and Replay-Attack Guard.
 */
type MiddlewareHandler = (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown;

export function withMiddleware(handler: MiddlewareHandler) {
    return async (req: VercelRequest, res: VercelResponse) => {
        // Initialize Sentry inside serverless execution context
        const sentryDsn = getEnv('SENTRY_DSN');
        if (sentryDsn) {
            Sentry.init({
                dsn: sentryDsn,
                tracesSampleRate: 1.0,
                environment: process.env.NODE_ENV || 'development',
            });
        }

        // 1. IP-BASED RATE LIMITING
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
        const now = Date.now();
        const clientData = rateLimitCache.get(ip) || { count: 0, resetTime: now + WINDOW_MS };
        
        if (now > clientData.resetTime) {
            clientData.count = 1;
            clientData.resetTime = now + WINDOW_MS;
        } else {
            clientData.count++;
        }
        rateLimitCache.set(ip, clientData);

        if (clientData.count > LIMIT) {
            return res.status(429).json({ success: false, error: 'Too many requests - rate limit exceeded' });
        }

        // 2. REPLAY ATTACK GUARD (For payloads carrying tx_hash)
        if (req.body && typeof req.body === 'object' && 'tx_hash' in req.body) {
            const txHash = String(req.body.tx_hash).trim().toLowerCase();
            if (txHash && txHash.startsWith('0x')) {
                const supabaseUrl = getEnv('VITE_SUPABASE_URL', getEnv('NEXT_PUBLIC_SUPABASE_URL', getEnv('SUPABASE_URL')));
                const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', getEnv('SUPABASE_SECRET_KEY'));
                
                if (supabaseUrl && supabaseKey) {
                    const supabase = createClient<Database>(supabaseUrl, supabaseKey);
                    // Check if this tx_hash has already been used/processed in activity logs
                    const { data: existingLog } = await supabase
                        .from('user_activity_logs')
                        .select('id')
                        .eq('tx_hash', txHash)
                        .maybeSingle();

                    if (existingLog) {
                        return res.status(400).json({ success: false, error: 'Transaction hash already processed (Replay Guard)' });
                    }
                }
            }
        }

        try {
            await handler(req, res);
        } catch (err: unknown) {
            console.error('[Middleware Captured Error]:', err);
            if (sentryDsn) {
                Sentry.captureException(err);
            }
            const sanitizedMessage = err instanceof Error ? err.message : String(err);
            res.status(500).json({ 
                success: false, 
                error: process.env.NODE_ENV === 'development' ? sanitizedMessage : 'Internal Server Error' 
            });
        }
    };
}
