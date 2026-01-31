const express = require('express');
const cors = require('cors');
const verifyRoutes = require('../routes/verify.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// NEW: Security Middleware - API Secret Header Authentication
app.use((req, res, next) => {
    const config = require('../config');
    const apiSecret = config.security.apiSecret;

    // Skip auth for health check
    if (req.path === '/api/verify/health' || req.path === '/') {
        return next();
    }

    if (!apiSecret) {
        console.warn('⚠️ WARNING: API_SECRET is not configured. Server is running in insecure mode.');
        return next();
    }

    const providedSecret = req.headers['x-api-secret'];
    if (providedSecret !== apiSecret) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized: Invalid or missing X-API-SECRET header',
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
