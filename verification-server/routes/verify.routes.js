const express = require('express');
const verificationService = require('../services/verification.service');

const router = express.Router();

// ══════════════════════════════════════════════════════════
// SPECIAL ROUTES (non-wildcard, must be defined FIRST)
// ══════════════════════════════════════════════════════════

/**
 * Link Twitter account to wallet address
 * POST /api/verify/twitter/link
 * Body: { userId, userAddress, verificationCode, signature, message }
 */
router.post('/twitter/link', async (req, res) => {
    try {
        const { userId, userAddress, verificationCode, signature, message } = req.body;

        if (!userId || !userAddress || !verificationCode || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, userAddress, verificationCode, signature, message',
            });
        }

        // ── Security Check: Verify that the person requesting the link owns the wallet ──
        if (!verificationService.verifySignature(userAddress, signature, message)) {
            return res.status(401).json({
                success: false,
                error: '[Security] Cryptographic verification failed. Linkage requires a valid signature.',
            });
        }

        const success = await verificationService.linkTwitter(userId, userAddress, verificationCode);

        if (success) {
            res.json({
                success: true,
                message: `Twitter ID ${userId} successfully linked to ${userAddress}`,
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Linkage verification failed. Ensure your tweet contains your wallet address and the verification code.',
            });
        }
    } catch (error) {
        console.error('Error in Twitter linkage:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Get Farcaster user details including Neynar Score/Reputation
 * GET /api/verify/farcaster/user/:fid
 */
router.get('/farcaster/user/:fid', async (req, res) => {
    try {
        const { fid } = req.params;
        const neynarService = require('../services/neynar.service');
        const user = await neynarService.getUserByFid(parseInt(fid));

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found on Farcaster',
            });
        }

        res.json({
            success: true,
            user: {
                fid: user.fid,
                username: user.username,
                displayName: user.display_name,
                pfp: user.pfp_url,
                followerCount: user.follower_count,
                followingCount: user.following_count,
                activeStatus: user.active_status,
                powerUser: user.power_user,
                verifiedAddresses: user.verified_addresses,
            }
        });
    } catch (error) {
        console.error('Error fetching Farcaster user info:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Health check endpoint
 * GET /api/verify/health
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Verification server is running',
        timestamp: new Date().toISOString(),
    });
});

// ══════════════════════════════════════════════════════════
// WILDCARD VERIFICATION ROUTES (Unified Pattern)
// All social task verification follows the same pipeline:
//   1. Validate required fields per platform
//   2. Call verificationService.verifyAndMarkTask()
//   3. On-chain XP (markTaskAsVerified) + DB record (recordClaim)
// ══════════════════════════════════════════════════════════

/**
 * Helper: Extract socialId and actionParams from request body based on platform
 */
function extractPlatformParams(platform, action, body) {
    switch (platform) {
        case 'farcaster': {
            const { fid, targetFid, castHash } = body;
            if (!fid) return { error: 'Missing required field: fid' };

            // Determine required params based on action
            if (action === 'follow' && !targetFid) return { error: 'Missing required field: targetFid' };
            if (['like', 'recast', 'quote', 'comment'].includes(action) && !castHash) {
                return { error: `Missing required field: castHash for action "${action}"` };
            }

            return {
                socialId: parseInt(fid),
                actionParams: {
                    targetFid: targetFid ? parseInt(targetFid) : undefined,
                    castHash: castHash || undefined,
                }
            };
        }

        case 'twitter': {
            const { userId, targetUserId, tweetId } = body;
            if (!userId) return { error: 'Missing required field: userId' };

            if (action === 'follow' && !targetUserId) return { error: 'Missing required field: targetUserId' };
            if (['like', 'retweet', 'quote', 'comment'].includes(action) && !tweetId) {
                return { error: `Missing required field: tweetId for action "${action}"` };
            }

            return {
                socialId: userId,
                actionParams: {
                    targetUserId: targetUserId || undefined,
                    tweetId: tweetId || undefined,
                }
            };
        }

        case 'tiktok': {
            const { tiktokHandle } = body;
            if (!tiktokHandle) return { error: 'Missing required field: tiktokHandle' };
            // Spread remaining body fields as actionParams for future extensibility
            const { userAddress: _u, taskId: _t, signature: _s, message: _m, tiktokHandle: _h, dbTaskId: _d, xpEarned: _x, ...rest } = body;
            return { socialId: tiktokHandle, actionParams: rest };
        }

        case 'instagram': {
            const { instagramHandle } = body;
            if (!instagramHandle) return { error: 'Missing required field: instagramHandle' };
            const { userAddress: _u, taskId: _t, signature: _s, message: _m, instagramHandle: _h, dbTaskId: _d, xpEarned: _x, ...rest } = body;
            return { socialId: instagramHandle, actionParams: rest };
        }

        default:
            return { error: `Unsupported platform: ${platform}` };
    }
}

/**
 * Unified Farcaster verification
 * POST /api/verify/farcaster/:action
 * Supports: follow, like, recast, quote, comment
 */
router.post('/farcaster/:action', async (req, res) => {
    try {
        const { action } = req.params;
        const { userAddress, taskId, dbTaskId, xpEarned, signature, message } = req.body;

        if (!userAddress || !taskId || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, taskId, signature, message',
            });
        }

        const params = extractPlatformParams('farcaster', action, req.body);
        if (params.error) {
            return res.status(400).json({ success: false, error: params.error });
        }

        const result = await verificationService.verifyAndMarkTask({
            platform: 'farcaster',
            action,
            userAddress,
            taskId: isNaN(taskId) ? taskId : parseInt(taskId),
            dbTaskId,
            xpEarned: parseInt(xpEarned || 0),
            socialId: params.socialId,
            actionParams: params.actionParams,
            signature,
            message
        });

        res.json(result);
    } catch (error) {
        console.error(`Error in Farcaster ${req.params.action} verification:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Unified Twitter verification
 * POST /api/verify/twitter/:action
 * Supports: follow, like, retweet, quote, comment
 * NOTE: /twitter/link is handled above (specific route takes priority over wildcard)
 */
router.post('/twitter/:action', async (req, res) => {
    try {
        const { action } = req.params;
        const { userAddress, taskId, dbTaskId, xpEarned, signature, message } = req.body;

        if (!userAddress || !taskId || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, taskId, signature, message',
            });
        }

        const params = extractPlatformParams('twitter', action, req.body);
        if (params.error) {
            return res.status(400).json({ success: false, error: params.error });
        }

        const result = await verificationService.verifyAndMarkTask({
            platform: 'twitter',
            action,
            userAddress,
            taskId: isNaN(taskId) ? taskId : parseInt(taskId),
            dbTaskId,
            xpEarned: parseInt(xpEarned || 0),
            socialId: params.socialId,
            actionParams: params.actionParams,
            signature,
            message
        });

        res.json(result);
    } catch (error) {
        console.error(`Error in Twitter ${req.params.action} verification:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Unified TikTok verification
 * POST /api/verify/tiktok/:action
 * Supports: follow, like, comment, repost, share, duet, etc.
 */
router.post('/tiktok/:action', async (req, res) => {
    try {
        const { action } = req.params;
        const { userAddress, taskId, signature, message } = req.body;

        if (!userAddress || !taskId || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, taskId, signature, message',
            });
        }

        const params = extractPlatformParams('tiktok', action, req.body);
        if (params.error) {
            return res.status(400).json({ success: false, error: params.error });
        }

        const result = await verificationService.verifyAndMarkTask({
            platform: 'tiktok',
            action,
            userAddress,
            taskId: parseInt(taskId),
            socialId: params.socialId,
            actionParams: params.actionParams,
            signature,
            message
        });

        res.json(result);
    } catch (error) {
        console.error(`Error in TikTok ${req.params.action} verification:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Unified Instagram verification
 * POST /api/verify/instagram/:action
 * Supports: follow, like, comment, repost, share, etc.
 */
router.post('/instagram/:action', async (req, res) => {
    try {
        const { action } = req.params;
        const { userAddress, taskId, signature, message } = req.body;

        if (!userAddress || !taskId || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, taskId, signature, message',
            });
        }

        const params = extractPlatformParams('instagram', action, req.body);
        if (params.error) {
            return res.status(400).json({ success: false, error: params.error });
        }

        const result = await verificationService.verifyAndMarkTask({
            platform: 'instagram',
            action,
            userAddress,
            taskId: parseInt(taskId),
            socialId: params.socialId,
            actionParams: params.actionParams,
            signature,
            message
        });

        res.json(result);
    } catch (error) {
        console.error(`Error in Instagram ${req.params.action} verification:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
