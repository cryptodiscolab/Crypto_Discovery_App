const express = require('express');
const cors = require('cors');
const verifyRoutes = require('../routes/verify.routes');
const userRoutes = require('../routes/user.routes');
const adminRoutes = require('../routes/admin.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// NEW: Security Middleware - API Secret Header Authentication
app.use((req, res, next) => {
    const config = require('../config');
    const apiSecret = config.security.apiSecret;
    const nodeEnv = config.server.nodeEnv || 'development';

    // Skip auth for health check, root, and telegram webhook
    const publicPaths = ['/api/verify/health', '/', '/api/webhook/telegram'];
    if (publicPaths.includes(req.path)) {
        return next();
    }

    // 1. Production Guard: Strict enforcement
    if (nodeEnv === 'production' && !apiSecret) {
        console.error('❌ CRITICAL SECURITY ALERT: API_SECRET is missing in production environment!');
        return res.status(500).json({
            success: false,
            error: '[Security] Server configuration error: API_SECRET is required.',
        });
    }

    // 2. Secret Verification
    const providedSecret = req.headers['x-api-secret'];
    const isCron = req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;

    if (isCron) return next();

    if (apiSecret && providedSecret !== apiSecret) {
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

// 🚀 Robust Rate Limiting: Protection against platform API exhaustion
const requestCounts = new Map();
const LIMIT = 15; // Increased slightly for UX
const WINDOW = 60 * 1000;

app.use('/api/verify', (req, res, next) => {
    // Health check bypass
    if (req.path === '/health') return next();

    // Multi-layer identifier (IP + Wallet)
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const wallet = req.body?.userAddress?.toLowerCase();
    const id = wallet || ip || 'anonymous';

    const now = Date.now();
    const data = requestCounts.get(id) || { count: 0, reset: now + WINDOW };

    if (now > data.reset) {
        data.count = 0;
        data.reset = now + WINDOW;
    }

    data.count++;
    requestCounts.set(id, data);

    if (data.count > LIMIT) {
        const waitSeconds = Math.ceil((data.reset - now) / 1000);
        console.warn(`[Security] Rate limit triggered for ID: ${id}. Waiting ${waitSeconds}s`);
        return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded. Please wait a moment to prevent social platform spam.',
            retryAfter: waitSeconds
        });
    }
    next();
});

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// 🛠️ RECONSTRUCTED: Missing Identity & Task Bundle Endpoints
app.get('/api/user-bundle', async (req, res) => {
    try {
        const { userAddress } = req.query;
        if (!userAddress) return res.status(400).json({ error: 'Missing userAddress' });
        
        const supabaseService = require('../services/supabase.service');
        const profile = await supabaseService.client
            .from('user_profiles')
            .select('*')
            .eq('wallet_address', userAddress.toLowerCase())
            .maybeSingle();
            
        res.json({ success: true, profile: profile.data, timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/tasks-bundle', async (req, res) => {
    try {
        const supabaseService = require('../services/supabase.service');
        const { data: tasks } = await supabaseService.client
            .from('daily_tasks')
            .select('*')
            .eq('is_active', true);
            
        res.json({ success: true, tasks: tasks || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/is-admin', async (req, res) => {
    const { userAddress } = req.query;
    const admins = (process.env.VITE_ADMIN_WALLETS || '').toLowerCase().split(',');
    const isAdmin = admins.includes(userAddress?.toLowerCase());
    res.json({ isAdmin });
});

// Routes
app.use('/api/verify', verifyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/tasks', userRoutes); // /api/tasks/verify is handled in userRoutes
app.use('/api/admin', adminRoutes);

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
