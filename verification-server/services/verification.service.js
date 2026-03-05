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

        // Linked accounts storage (in production, use a Database/Redis)
        this.twitterLinkages = new Map();
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
            this.twitterLinkages.set(userId, userAddress.toLowerCase());
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
                // NEW: Security Check - Verify wallet-to-Twitter linkage
                const linkedAddress = this.twitterLinkages.get(socialId);
                if (!linkedAddress || linkedAddress !== userAddress.toLowerCase()) {
                    return {
                        success: false,
                        error: `Security Error: Wallet ${userAddress} is not linked to Twitter ID ${socialId}. Please verify your profile first.`,
                        requiresLinkage: true,
                        linkagePlatform: 'twitter'
                    };
                }
                verified = await this.verifyTwitterTask(action, socialId, actionParams);
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
            if (platform === 'twitter' && socialId) {
                try {
                    // Cek jika profil di database masih kosong menggunakan backend-to-backend atau local lookup
                    const { data: dbProfile } = await supabaseService.client
                        .from('user_profiles')
                        .select('display_name, pfp_url, bio')
                        .eq('wallet_address', userAddress.toLowerCase())
                        .single();

                    if (!dbProfile?.display_name || !dbProfile?.pfp_url) {
                        const twitterUser = await twitterService.getUserById(socialId);
                        if (twitterUser) {
                            // Replace 'normal' size with high-res '400x400' if possible
                            const highResPfp = twitterUser.profile_image_url ? twitterUser.profile_image_url.replace('_normal', '_400x400') : null;

                            await supabaseService.client
                                .from('user_profiles')
                                .update({
                                    display_name: dbProfile?.display_name || twitterUser.name,
                                    username: twitterUser.username,
                                    pfp_url: dbProfile?.pfp_url || highResPfp,
                                    bio: dbProfile?.bio || twitterUser.description || ''
                                })
                                .eq('wallet_address', userAddress.toLowerCase());
                            console.log(`[Verification] Profile autofilled from Twitter for ${userAddress}`);
                        }
                    }
                } catch (afErr) {
                    console.error('[VerificationService] Autofill failed, continuing process:', afErr.message);
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
                    action
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
