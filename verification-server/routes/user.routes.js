const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase.service');
const verificationService = require('../services/verification.service');

/**
 * Sync User Profile
 * POST /api/user/sync
 * Body: { wallet_address, signature, message, fid? }
 *
 * Zero-Trust Standard: Frontend signs a message → backend verifies signature → upserts user_profiles.
 */
router.post('/sync', async (req, res) => {
    try {
        const { wallet_address, signature, message, fid } = req.body;

        if (!wallet_address || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: wallet_address, signature, message',
            });
        }

        // 🔐 Cryptographic verification (Zero Trust)
        if (!verificationService.verifySignature(wallet_address, signature, message)) {
            return res.status(401).json({
                success: false,
                error: '[Security] Signature verification failed. Request rejected.',
            });
        }

        const normalizedWallet = wallet_address.toLowerCase();

        // Upsert user profile via SERVICE_ROLE (backend only)
        const profile = await supabaseService.syncUserProfile(normalizedWallet, fid);

        res.json({ success: true, profile });
    } catch (error) {
        console.error('[UserRoutes] /sync error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Award Task XP
 * POST /api/tasks/verify
 * Body: { wallet_address, signature, message, task_id, xp_reward }
 *
 * Called by awardTaskXP() in dailyAppLogic.js after on-chain task completion.
 */
router.post('/tasks/verify', async (req, res) => {
    try {
        const { wallet_address, signature, message, task_id, xp_reward } = req.body;

        if (!wallet_address || !signature || !message || !task_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: wallet_address, signature, message, task_id',
            });
        }

        // 🔐 Cryptographic verification (Zero Trust)
        if (!verificationService.verifySignature(wallet_address, signature, message)) {
            return res.status(401).json({
                success: false,
                error: '[Security] Signature verification failed. XP not awarded.',
            });
        }

        const normalizedWallet = wallet_address.toLowerCase();
        const xpToAward = parseInt(xp_reward || 0);

        // Award XP via Supabase SERVICE_ROLE
        const result = await supabaseService.awardXP(normalizedWallet, task_id, xpToAward);

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[UserRoutes] /tasks/verify error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
