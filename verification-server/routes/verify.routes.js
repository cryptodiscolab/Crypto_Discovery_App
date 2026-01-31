const express = require('express');
const verificationService = require('../services/verification.service');

const router = express.Router();

/**
 * Verify Farcaster follow task
 * POST /api/verify/farcaster/follow
 * Body: { userAddress, taskId, fid, targetFid }
 */
router.post('/farcaster/follow', async (req, res) => {
    try {
        const { userAddress, taskId, fid, targetFid } = req.body;

        if (!userAddress || !taskId || !fid || !targetFid) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, taskId, fid, targetFid',
            });
        }

        const result = await verificationService.verifyAndMarkTask({
            platform: 'farcaster',
            action: 'follow',
            userAddress,
            taskId: parseInt(taskId),
            socialId: parseInt(fid),
            actionParams: { targetFid: parseInt(targetFid) },
        });

        res.json(result);
    } catch (error) {
        console.error('Error in Farcaster follow verification:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Verify Farcaster like task
 * POST /api/verify/farcaster/like
 * Body: { userAddress, taskId, fid, castHash }
 */
router.post('/farcaster/like', async (req, res) => {
    try {
        const { userAddress, taskId, fid, castHash } = req.body;

        if (!userAddress || !taskId || !fid || !castHash) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, taskId, fid, castHash',
            });
        }

        const result = await verificationService.verifyAndMarkTask({
            platform: 'farcaster',
            action: 'like',
            userAddress,
            taskId: parseInt(taskId),
            socialId: parseInt(fid),
            actionParams: { castHash },
        });

        res.json(result);
    } catch (error) {
        console.error('Error in Farcaster like verification:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Verify Farcaster recast task
 * POST /api/verify/farcaster/recast
 * Body: { userAddress, taskId, fid, castHash }
 */
router.post('/farcaster/recast', async (req, res) => {
    try {
        const { userAddress, taskId, fid, castHash } = req.body;

        if (!userAddress || !taskId || !fid || !castHash) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, taskId, fid, castHash',
            });
        }

        const result = await verificationService.verifyAndMarkTask({
            platform: 'farcaster',
            action: 'recast',
            userAddress,
            taskId: parseInt(taskId),
            socialId: parseInt(fid),
            actionParams: { castHash },
        });

        res.json(result);
    } catch (error) {
        console.error('Error in Farcaster recast verification:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Verify Farcaster quote task
 * POST /api/verify/farcaster/quote
 * Body: { userAddress, taskId, fid, castHash }
 */
router.post('/farcaster/quote', async (req, res) => {
    try {
        const { userAddress, taskId, fid, castHash } = req.body;

        if (!userAddress || !taskId || !fid || !castHash) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, taskId, fid, castHash',
            });
        }

        const result = await verificationService.verifyAndMarkTask({
            platform: 'farcaster',
            action: 'quote',
            userAddress,
            taskId: parseInt(taskId),
            socialId: parseInt(fid),
            actionParams: { castHash },
        });

        res.json(result);
    } catch (error) {
        console.error('Error in Farcaster quote verification:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Verify Farcaster comment task
 * POST /api/verify/farcaster/comment
 * Body: { userAddress, taskId, fid, castHash }
 */
router.post('/farcaster/comment', async (req, res) => {
    try {
        const { userAddress, taskId, fid, castHash } = req.body;

        if (!userAddress || !taskId || !fid || !castHash) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, taskId, fid, castHash',
            });
        }

        const result = await verificationService.verifyAndMarkTask({
            platform: 'farcaster',
            action: 'comment',
            userAddress,
            taskId: parseInt(taskId),
            socialId: parseInt(fid),
            actionParams: { castHash },
        });

        res.json(result);
    } catch (error) {
        console.error('Error in Farcaster comment verification:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Verify Twitter follow task
 * POST /api/verify/twitter/follow
 * Body: { userAddress, taskId, userId, targetUserId }
 */
router.post('/twitter/follow', async (req, res) => {
    try {
        const { userAddress, taskId, userId, targetUserId } = req.body;

        if (!userAddress || !taskId || !userId || !targetUserId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, taskId, userId, targetUserId',
            });
        }

        const result = await verificationService.verifyAndMarkTask({
            platform: 'twitter',
            action: 'follow',
            userAddress,
            taskId: parseInt(taskId),
            socialId: userId,
            actionParams: { targetUserId },
        });

        res.json(result);
    } catch (error) {
        console.error('Error in Twitter follow verification:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Verify Twitter like task
 * POST /api/verify/twitter/like
 * Body: { userAddress, taskId, userId, tweetId }
 */
router.post('/twitter/like', async (req, res) => {
    try {
        const { userAddress, taskId, userId, tweetId } = req.body;

        if (!userAddress || !taskId || !userId || !tweetId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, taskId, userId, tweetId',
            });
        }

        const result = await verificationService.verifyAndMarkTask({
            platform: 'twitter',
            action: 'like',
            userAddress,
            taskId: parseInt(taskId),
            socialId: userId,
            actionParams: { tweetId },
        });

        res.json(result);
    } catch (error) {
        console.error('Error in Twitter like verification:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Verify Twitter retweet task
 * POST /api/verify/twitter/retweet
 * Body: { userAddress, taskId, userId, tweetId }
 */
router.post('/twitter/retweet', async (req, res) => {
    try {
        const { userAddress, taskId, userId, tweetId } = req.body;

        if (!userAddress || !taskId || !userId || !tweetId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, taskId, userId, tweetId',
            });
        }

        const result = await verificationService.verifyAndMarkTask({
            platform: 'twitter',
            action: 'retweet',
            userAddress,
            taskId: parseInt(taskId),
            socialId: userId,
            actionParams: { tweetId },
        });

        res.json(result);
    } catch (error) {
        console.error('Error in Twitter retweet verification:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Verify Twitter quote task
 * POST /api/verify/twitter/quote
 * Body: { userAddress, taskId, userId, tweetId }
 */
router.post('/twitter/quote', async (req, res) => {
    try {
        const { userAddress, taskId, userId, tweetId } = req.body;

        if (!userAddress || !taskId || !userId || !tweetId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, taskId, userId, tweetId',
            });
        }

        const result = await verificationService.verifyAndMarkTask({
            platform: 'twitter',
            action: 'quote',
            userAddress,
            taskId: parseInt(taskId),
            socialId: userId,
            actionParams: { tweetId },
        });

        res.json(result);
    } catch (error) {
        console.error('Error in Twitter quote verification:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Verify Twitter comment task
 * POST /api/verify/twitter/comment
 * Body: { userAddress, taskId, userId, tweetId }
 */
router.post('/twitter/comment', async (req, res) => {
    try {
        const { userAddress, taskId, userId, tweetId } = req.body;

        if (!userAddress || !taskId || !userId || !tweetId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, taskId, userId, tweetId',
            });
        }

        const result = await verificationService.verifyAndMarkTask({
            platform: 'twitter',
            action: 'comment',
            userAddress,
            taskId: parseInt(taskId),
            socialId: userId,
            actionParams: { tweetId },
        });

        res.json(result);
    } catch (error) {
        console.error('Error in Twitter comment verification:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Link Twitter account to wallet address
 * POST /api/verify/twitter/link
 * Body: { userId, userAddress, verificationCode }
 */
router.post('/twitter/link', async (req, res) => {
    try {
        const { userId, userAddress, verificationCode } = req.body;

        if (!userId || !userAddress || !verificationCode) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, userAddress, verificationCode',
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
                activeStatus: user.active_status, // Indicator for Neynar Score/Activity
                powerUser: user.power_user,      // Reputation indicator
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

module.exports = router;
