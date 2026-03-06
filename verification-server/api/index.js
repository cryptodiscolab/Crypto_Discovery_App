const express = require('express');
const cors = require('cors');
const verifyRoutes = require('../routes/verify.routes');
const userRoutes = require('../routes/user.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// NEW: Security Middleware - API Secret Header Authentication
app.use((req, res, next) => {
    const config = require('../config');
    const apiSecret = config.security.apiSecret;

    // Skip auth for health check and telegram webhook
    if (req.path === '/api/verify/health' || req.path === '/' || req.path === '/api/webhook/telegram') {
        return next();
    }

    if (!apiSecret) {
        if (config.server.nodeEnv === 'production') {
            console.error('❌ CRITICAL SECURITY ERROR: API_SECRET is not configured in production!');
            return res.status(500).json({
                success: false,
                error: 'Server configuration error: Security key missing',
            });
        }
        console.warn('⚠️ WARNING: API_SECRET is not configured. Server is running in insecure mode (Development only).');
        return next();
    }

    const providedSecret = req.headers['x-api-secret'];
    const isCron = req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;

    if (isCron) return next(); // Allow Vercel Cron automatically

    if (!providedSecret || providedSecret !== apiSecret) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized: Invalid or missing X-API-SECRET header',
        });
    }
    next();
});

// --- NEW: Cron Jobs Handler ---
app.use('/api/cron/:job', async (req, res) => {
    const job = req.params.job;
    try {
        const handler = require(`./cron/${job}.js`);
        if (typeof handler === 'function') {
            return await handler(req, res);
        }
        res.status(500).json({ error: `Handler for job ${job} is not a function` });
    } catch (err) {
        console.error(`[Cron Error] Job ${job} not found:`, err.message);
        res.status(404).json({ error: `Job ${job} not found` });
    }
});

// 🚀 Rate Limiting: Prevent Neynar/Twitter API spam
const requestCounts = new Map();
const LIMIT = 10; // requests per minute
const WINDOW = 60 * 1000;

app.use('/api/verify', (req, res, next) => {
    // Health check bypass
    if (req.path === '/health') return next();

    const identifiers = [
        req.headers['x-forwarded-for'],
        req.socket.remoteAddress,
        req.body?.userAddress
    ].filter(Boolean);

    const id = identifiers[0] || 'default';
    const now = Date.now();
    const data = requestCounts.get(id) || { count: 0, reset: now + WINDOW };

    if (now > data.reset) {
        data.count = 0;
        data.reset = now + WINDOW;
    }

    data.count++;
    requestCounts.set(id, data);

    if (data.count > LIMIT) {
        return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded. Please wait 1 minute before verifying more tasks.',
            retryAfter: Math.ceil((data.reset - now) / 1000)
        });
    }
    next();
});

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/verify', verifyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/tasks', userRoutes); // /api/tasks/verify is handled in userRoutes

// --- NEW: Telegram Webhook Handler ---
app.post('/api/webhook/telegram', async (req, res) => {
    try {
        const handler = require('./webhook/telegram.js');
        await handler(req, res);
    } catch (err) {
        console.error('[Webhook Error] Endpoint error:', err.message);
        res.status(500).json({ error: 'Webhook execution failed' });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'DailyApp Verification Server',
        version: '1.0.0',
        endpoints: {
            farcaster: [
                'POST /api/verify/farcaster/follow',
                'POST /api/verify/farcaster/like',
                'POST /api/verify/farcaster/recast',
                'POST /api/verify/farcaster/quote',
                'POST /api/verify/farcaster/comment',
            ],
            twitter: [
                'POST /api/verify/twitter/follow',
                'POST /api/verify/twitter/like',
                'POST /api/verify/twitter/retweet',
                'POST /api/verify/twitter/quote',
                'POST /api/verify/twitter/comment',
            ],
            user: [
                'POST /api/user/sync',
                'POST /api/tasks/verify',
            ],
            health: 'GET /api/verify/health',
        },
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
    });
});

// Export for Vercel serverless
module.exports = app;

// Start server if not in Vercel environment
if (process.env.NODE_ENV !== 'production') {
    const config = require('../config');
    const PORT = config.server.port || 3000;

    app.listen(PORT, () => {
        console.log(`🚀 Verification server running on port ${PORT}`);
        console.log(`📍 Health check: http://localhost:${PORT}/api/verify/health`);
    });
}
