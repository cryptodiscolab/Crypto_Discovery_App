const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase.service');
const verificationService = require('../services/verification.service');

/**
 * Admin Sync Task Batch
 * POST /api/admin/tasks/sync
 * Body: { wallet_address, signature, message, tasks: [...] }
 * 
 * Syncs on-chain tasks with Supabase after successful contract transaction.
 */
router.post('/sync', async (req, res) => {
    try {
        const { wallet_address, signature, message, tasks, action, tx_hash } = req.body;

        if (!wallet_address || !signature || !message) {
            return res.status(400).json({ success: false, error: 'Missing security credentials' });
        }

        // 🔐 Zero Trust verification (Admin Only)
        if (!verificationService.verifySignature(wallet_address, signature, message)) {
            return res.status(401).json({ success: false, error: '[Security] Admin signature verification failed' });
        }

        // Verify Admin Privilege
        const admins = [
            '0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B'.toLowerCase(),
            '0x455DF75735d2a18c26f0AfDefa93217B60369fe5'.toLowerCase()
        ];
        if (!admins.includes(wallet_address.toLowerCase())) {
            return res.status(403).json({ success: false, error: '[Security] Unauthorized: Admin only' });
        }

        // Action Branching
        if (action === 'SYNC_ECONOMY') {
            console.log(`[AdminSync] Token Price Update: ${tx_hash}`);
            return res.json({ success: true, message: 'Economy sync logged' });
        }

        if (action === 'AUDIT_GOVERNANCE') {
            console.log(`[AdminSync] Governance Audit: ${req.body.governor_action}`);
            return res.json({ success: true, message: 'Audit log recorded' });
        }

        // Default: Sync Tasks
        if (!tasks || !Array.isArray(tasks)) {
            return res.status(400).json({ success: false, error: 'No tasks provided for sync' });
        }

        // 🔄 Normalize Schema (Dashboard reward_points -> DB xp_reward)
        const normalizedTasks = tasks.map(task => ({
            platform: task.platform,
            action_type: task.action_type,
            title: task.title,
            description: task.title, // Backup for legacy
            link: task.link,
            target_id: task.target_id,
            xp_reward: task.reward_points || task.xp_reward, // Support both
            min_tier: task.min_tier,
            requires_verification: task.requires_verification,
            is_active: true
        }));

        console.log(`[AdminSync] Syncing ${normalizedTasks.length} tasks from TX: ${tx_hash}`);
        const result = await supabaseService.syncTaskBatch(normalizedTasks);

        res.json({ success: true, count: normalizedTasks.length, result });
    } catch (error) {
        console.error('[AdminSync] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
