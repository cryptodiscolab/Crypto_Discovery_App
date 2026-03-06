const { ethers } = require('ethers');
const config = require('../config');
const neynarService = require('./neynar.service');
const twitterService = require('./twitter.service');
const supabaseService = require('./supabase.service');

// Smart contract ABI (only the functions we need)
const CONTRACT_ABI = [
    'function markTaskAsVerified(address user, uint256 taskId) external',
    'function hasRole(bytes32 role, address account) external view returns (bool)',
    'event TaskVerified(address indexed user, uint256 indexed taskId, uint256 timestamp)',
];

// VERIFIER_ROLE hash (keccak256("VERIFIER_ROLE"))
const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('VERIFIER_ROLE'));

class VerificationService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
        this.wallet = new ethers.Wallet(config.blockchain.verifierPrivateKey, this.provider);
        this.contract = new ethers.Contract(
            config.blockchain.contractAddress,
            CONTRACT_ABI,
            this.wallet
        );

        // Verification cache (in production, use Redis)
        this.cache = new Map();

        // Twitter Linkages migrated to Supabase Database (Rule: 1 Twitter : 1 Wallet)
    }

    /**
     * Verify cryptographic signature (SIWE)
     * @param {string} address - Expected signer address
     * @param {string} signature - Hex signature
     * @param {string} message - Original message
     * @returns {boolean}
     */
    verifySignature(address, signature, message) {
        if (!address || !signature || !message) return false;
        try {
            const recoveredAddress = ethers.verifyMessage(message, signature);
            if (recoveredAddress.toLowerCase() !== address.toLowerCase()) return false;

            // Replay protection: Check timestamp in message (Format: "Verify ... Time: ISOString" OR "Timestamp: Number")
            const timeMatch = message.match(/(?:Time|Timestamp):\s*(.+)$/m);
            if (!timeMatch) return false;

            const msgTime = new Date(timeMatch[1]).getTime();
            if (isNaN(msgTime)) return false;

            const diff = Math.abs(Date.now() - msgTime);
            if (diff > 10 * 60 * 1000) { // 10 minutes window
                console.warn(`[SIWE] Signature expired. Diff: ${diff}ms`);
                return false;
            }

            return true;
        } catch (error) {
            console.error('[SIWE] Signature verification error:', error.message);
            return false;
        }
    }

    /**
     * Verify and store Twitter-to-Wallet linkage
     * @param {string} userId - Twitter User ID
     * @param {string} userAddress - Wallet address
     * @param {string} verificationCode - Code from the tweet
     * @returns {Promise<boolean>}
     */
    async linkTwitter(userId, userAddress, verificationCode) {
        const isLinked = await twitterService.verifyLinkage(userId, userAddress, verificationCode);
        if (isLinked) {
            // Persist to Database (Identity Lock)
            const twitterUser = await twitterService.getUserById(userId);
            const username = twitterUser?.username || 'unknown';

            await supabaseService.linkTwitterAccount(userAddress, userId, username);

            // Auto-fill profile details from Twitter for better UX
            if (twitterUser) {
                const displayName = (twitterUser.name || '').substring(0, 50);
                const bio = (twitterUser.description || '').substring(0, 160);
                const rawPfp = twitterUser.profile_image_url || '';
                const highResPfp = rawPfp.replace('_normal', '_400x400').substring(0, 500);

                await supabaseService.client
                    .from('user_profiles')
                    .update({
                        display_name: displayName,
                        pfp_url: highResPfp,
                        bio: bio
                    })
                    .eq('wallet_address', userAddress.toLowerCase());
            }

            return true;
        }
        return false;
    }

    /**
     * Verify Farcaster task
     * @param {string} platform - 'farcaster'
     * @param {string} action - 'follow', 'like', 'recast', 'quote', 'comment'
     * @param {number} fid - User's Farcaster ID
     * @param {Object} params - Action-specific parameters
     * @returns {Promise<boolean>}
     */
    async verifyFarcasterTask(action, fid, params) {
        try {
            let verified = false;

            switch (action) {
                case 'follow':
                    verified = await neynarService.verifyFollow(fid, params.targetFid);
                    break;
                case 'like':
                    verified = await neynarService.verifyLikeCast(fid, params.castHash);
                    break;
                case 'recast':
                    verified = await neynarService.verifyRecast(fid, params.castHash);
                    break;
                case 'quote':
                    verified = await neynarService.verifyQuote(fid, params.castHash);
                    break;
                case 'comment':
                    verified = await neynarService.verifyComment(fid, params.castHash);
                    break;
                default:
                    throw new Error(`Unknown Farcaster action: ${action}`);
            }

            return verified;
        } catch (error) {
            console.error('Error verifying Farcaster task:', error);
            throw error;
        }
    }

    /**
     * Verify TikTok task (Trust-Based/Manual for now)
     * @param {string} action - 'follow', 'like', 'comment', 'repost'
     * @param {string} tiktokId - User's TikTok ID/Handle
     * @param {Object} params - Action-specific parameters
     * @returns {Promise<boolean>}
     */
    async verifyTikTokTask(action, tiktokId, params) {
        try {
            console.log(`[Verification] TikTok ${action} for ${tiktokId} - Trust-Based Verification`);
            // TODO: Integrate TikTok API when available
            return true;
        } catch (error) {
            console.error('Error verifying TikTok task:', error);
            throw error;
        }
    }

    /**
     * Verify Instagram task (Trust-Based/Manual for now)
     * @param {string} action - 'follow', 'like', 'comment', 'repost'
     * @param {string} instagramId - User's Instagram ID/Handle
     * @param {Object} params - Action-specific parameters
     * @returns {Promise<boolean>}
     */
    async verifyInstagramTask(action, instagramId, params) {
        try {
            console.log(`[Verification] Instagram ${action} for ${instagramId} - Trust-Based Verification`);
            // TODO: Integrate Instagram Basic Display/Graph API when available
            return true;
        } catch (error) {
            console.error('Error verifying Instagram task:', error);
            throw error;
        }
    }

    /**
     * Verify Twitter task
     * @param {string} action - 'follow', 'like', 'retweet', 'quote', 'comment'
     * @param {string} userId - User's Twitter ID
     * @param {Object} params - Action-specific parameters
     * @returns {Promise<boolean>}
     */
    async verifyTwitterTask(action, userId, params) {
        try {
            let verified = false;

            switch (action) {
                case 'follow':
                    verified = await twitterService.verifyFollow(userId, params.targetUserId);
                    break;
                case 'like':
                    verified = await twitterService.verifyLike(userId, params.tweetId);
                    break;
                case 'retweet':
                    verified = await twitterService.verifyRetweet(userId, params.tweetId);
                    break;
                case 'quote':
                    verified = await twitterService.verifyQuote(userId, params.tweetId);
                    break;
                case 'comment':
                    verified = await twitterService.verifyComment(userId, params.tweetId);
                    break;
                default:
                    throw new Error(`Unknown Twitter action: ${action}`);
            }

            return verified;
        } catch (error) {
            console.error('Error verifying Twitter task:', error);
            throw error;
        }
    }

    /**
     * Mark task as verified on smart contract
     * @param {string} userAddress - User's wallet address
     * @param {number} taskId - Task ID
     * @returns {Promise<Object>} Transaction receipt
     */
    async markTaskAsVerified(userAddress, taskId) {
        try {
            // Check if verifier has the correct role
            const hasRole = await this.contract.hasRole(VERIFIER_ROLE, this.wallet.address);
            if (!hasRole) {
                throw new Error('Verifier does not have VERIFIER_ROLE');
            }

            // Send transaction to mark task as verified
            const tx = await this.contract.markTaskAsVerified(userAddress, taskId);
            console.log(`Transaction sent: ${tx.hash}`);

            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`Task verified on-chain. Gas used: ${receipt.gasUsed.toString()}`);

            return {
                success: true,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
            };
        } catch (error) {
            console.error('Error marking task as verified:', error);
            throw error;
        }
    }

    /**
     * Complete verification flow
     * @param {Object} params - Verification parameters
     * @returns {Promise<Object>}
     */
    async verifyAndMarkTask(params) {
        const { platform, action, userAddress, taskId, socialId, actionParams, signature, message } = params;

        try {
            // ── ZERO TRUST FIX: Cryptographic Verification ──
            if (!this.verifySignature(userAddress, signature, message)) {
                return {
                    success: false,
                    error: '[Security] Cryptographic verification failed. Please re-sign the verification request.'
                };
            }

            // Check cache first
            const cacheKey = `${userAddress}-${taskId}`;
            if (this.cache.has(cacheKey)) {
                return { success: false, error: 'Task already verified' };
            }

            // NEW: Full-Stack Sync Anti-Cheat Guard
            const taskData = await supabaseService.getTaskById(taskId);
            if (!taskData) {
                return { success: false, error: 'Task not found in database' };
            }

            if (taskData.target_id) {
                const alreadyClaimed = await supabaseService.hasAlreadyClaimedTarget(
                    userAddress,
                    platform,
                    action,
                    taskData.target_id
                );
                if (alreadyClaimed) {
                    return {
                        success: false,
                        error: `[Security] Anti-Cheat: You have already claimed XP for target "${taskData.target_id}" on a different task.`
                    };
                }
            }

            let verified = false;

            // Verify based on platform
            if (platform === 'farcaster') {
                // NEW: Security Check - Verify wallet-to-FID linkage
                const isLinked = await neynarService.verifyWalletLinkage(socialId, userAddress);
                if (!isLinked) {
                    return {
                        success: false,
                        error: `Security Error: Wallet ${userAddress} is not linked to Farcaster ID ${socialId}`,
                    };
                }
                verified = await this.verifyFarcasterTask(action, socialId, actionParams);
            } else if (platform === 'twitter') {
                // NEW: Security Check - Verify wallet-to-Twitter linkage via Database (Identity Lock)
                const { data: profile } = await supabaseService.client
                    .from('user_profiles')
                    .select('twitter_id')
                    .eq('wallet_address', userAddress.toLowerCase())
                    .single();

                if (!profile?.twitter_id || profile.twitter_id !== socialId) {
                    return {
                        success: false,
                        error: `Security Error: Wallet ${userAddress} is not linked to Twitter ID ${socialId}. Please verify your profile first.`,
                        requiresLinkage: true,
                        linkagePlatform: 'twitter'
                    };
                }
                verified = await this.verifyTwitterTask(action, socialId, actionParams);
            } else if (platform === 'tiktok') {
                // Identity Lock Check: TikTok
                const { data: profile } = await supabaseService.client
                    .from('user_profiles')
                    .select('tiktok_username')
                    .eq('wallet_address', userAddress.toLowerCase())
                    .single();

                if (!profile?.tiktok_username || profile.tiktok_username !== socialId) {
                    return {
                        success: false,
                        error: `Security Error: Wallet ${userAddress} is not linked to TikTok Handle ${socialId}.`,
                        requiresLinkage: true,
                        linkagePlatform: 'tiktok'
                    };
                }
                verified = await this.verifyTikTokTask(action, socialId, actionParams);
            } else if (platform === 'instagram') {
                // Identity Lock Check: Instagram
                const { data: profile } = await supabaseService.client
                    .from('user_profiles')
                    .select('instagram_username')
                    .eq('wallet_address', userAddress.toLowerCase())
                    .single();

                if (!profile?.instagram_username || profile.instagram_username !== socialId) {
                    return {
                        success: false,
                        error: `Security Error: Wallet ${userAddress} is not linked to Instagram Handle ${socialId}.`,
                        requiresLinkage: true,
                        linkagePlatform: 'instagram'
                    };
                }
                verified = await this.verifyInstagramTask(action, socialId, actionParams);
            } else {
                throw new Error(`Unknown platform: ${platform}`);
            }

            if (!verified) {
                return {
                    success: false,
                    error: `Verification failed: ${action} not completed`,
                };
            }

            // --- AUTOFILL PROFILE ON SUCCESSFUL VERIFICATION ---
            if (socialId) {
                try {
                    // Cek jika profil di database masih memiliki data dasar yang kosong
                    const { data: dbProfile } = await supabaseService.client
                        .from('user_profiles')
                        .select('display_name, pfp_url, bio')
                        .eq('wallet_address', userAddress.toLowerCase())
                        .single();

                    if (!dbProfile?.display_name || !dbProfile?.pfp_url) {
                        let socialUser = null;

                        if (platform === 'twitter') {
                            socialUser = await twitterService.getUserById(socialId);
                        } else if (platform === 'farcaster') {
                            const fcUser = await neynarService.getUserByFid(socialId);
                            if (fcUser) {
                                socialUser = {
                                    name: fcUser.display_name,
                                    username: fcUser.username,
                                    description: fcUser.profile?.bio?.text,
                                    profile_image_url: fcUser.pfp_url
                                };
                            }
                        }

                        if (socialUser) {
                            // Apply length limits from rule 8.8
                            const displayName = (dbProfile?.display_name || socialUser.name || '').substring(0, 50);
                            const username = (socialUser.username || '').substring(0, 30);
                            const bio = (dbProfile?.bio || socialUser.description || '').substring(0, 160);
                            const rawPfp = dbProfile?.pfp_url || socialUser.profile_image_url || '';

                            // High-res fallback for Twitter, Farcaster usually provides good ones
                            const finalPfp = platform === 'twitter'
                                ? rawPfp.replace('_normal', '_400x400').substring(0, 500)
                                : rawPfp.substring(0, 500);

                            await supabaseService.client
                                .from('user_profiles')
                                .update({
                                    display_name: displayName,
                                    username: username,
                                    pfp_url: finalPfp,
                                    bio: bio
                                })
                                .eq('wallet_address', userAddress.toLowerCase());

                            console.log(`[Verification] Profile auto-filled from ${platform} for ${userAddress}`);
                        }
                    }
                } catch (afErr) {
                    console.error('[VerificationService] Autofill failed:', afErr.message);
                }
            }

            // 1. Mark as verified on blockchain (Contract uses numeric ID)
            // If taskId is UUID, we might need a mapping. 
            // For now, assume taskId is the numeric ID for contract.
            const contractResult = await this.markTaskAsVerified(userAddress, taskId);

            // 2. Record claim in Supabase (Database uses UUID)
            // We'll pass the payload's taskId (if it's UUID) or look it up.
            // For resilience, we wrap DB write in try-catch to not fail the whole req if on-chain succeeded.
            let dbResult = { success: false };
            try {
                // If the frontend sends 'dbTaskId' in params, use it. Otherwise use taskId.
                const uuidToUse = params.dbTaskId || taskId;
                dbResult = await supabaseService.recordClaim(
                    userAddress,
                    uuidToUse,
                    params.xpEarned || 0, // Fallback if not provided
                    platform,
                    action,
                    taskData.target_id // NEW: Pass target_id for double-check & logging
                );

                // Update Neynar Score if available
                if (platform === 'farcaster' && socialId) {
                    const user = await neynarService.getUserByFid(socialId);
                    if (user && user.active_status) {
                        await supabaseService.updateUserScore(userAddress, user.active_status === 'active' ? 100 : 50);
                    }
                }
            } catch (dbErr) {
                console.error('[VerificationService] Database logging failed after on-chain success:', dbErr.message);
                // We still return success: true because on-chain part worked.
                dbResult.error = 'On-chain verified, but DB logging failed: ' + dbErr.message;
            }

            return {
                success: true,
                verified: true,
                txHash: contractResult.txHash,
                blockNumber: contractResult.blockNumber,
                dbStatus: dbResult.success ? 'synced' : 'pending',
                dbError: dbResult.error
            };
        } catch (error) {
            console.error('Error in verification flow:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Clear cache (call periodically)
     */
    clearCache() {
        this.cache.clear();
    }
}

module.exports = new VerificationService();
