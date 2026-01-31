const { NeynarAPIClient } = require('@neynar/nodejs-sdk');
const config = require('../config');

class NeynarService {
    constructor() {
        if (!config.neynar.apiKey) {
            throw new Error('NEYNAR_API_KEY is not configured');
        }
        this.client = new NeynarAPIClient(config.neynar.apiKey);
    }

    /**
     * Verify if a user follows another user on Farcaster
     * @param {number} fid - User's Farcaster ID
     * @param {number} targetFid - Target user's Farcaster ID to check if followed
     * @returns {Promise<boolean>}
     */
    async verifyFollow(fid, targetFid) {
        try {
            // Get user's following list
            const response = await this.client.fetchUserFollowing(fid, {
                limit: 100,
            });

            // Check if target is in following list
            const isFollowing = response.users.some(user => user.fid === targetFid);

            return isFollowing;
        } catch (error) {
            console.error('Error verifying Farcaster follow:', error);
            throw new Error(`Failed to verify follow: ${error.message}`);
        }
    }

    /**
     * Verify if a user liked a specific cast
     * @param {number} fid - User's Farcaster ID
     * @param {string} castHash - Hash of the cast to check
     * @returns {Promise<boolean>}
     */
    async verifyLikeCast(fid, castHash) {
        try {
            // Get cast reactions
            const response = await this.client.fetchCastReactions(castHash, {
                limit: 100,
            });

            // Check if user liked the cast
            const hasLiked = response.reactions.some(
                reaction => reaction.user.fid === fid && reaction.reaction_type === 'like'
            );

            return hasLiked;
        } catch (error) {
            console.error('Error verifying Farcaster like:', error);
            throw new Error(`Failed to verify like: ${error.message}`);
        }
    }

    /**
     * Verify if a user recasted a specific cast
     * @param {number} fid - User's Farcaster ID
     * @param {string} castHash - Hash of the cast to check
     * @returns {Promise<boolean>}
     */
    async verifyRecast(fid, castHash) {
        try {
            // Get cast reactions
            const response = await this.client.fetchCastReactions(castHash, {
                limit: 100,
            });

            // Check if user recasted
            const hasRecasted = response.reactions.some(
                reaction => reaction.user.fid === fid && reaction.reaction_type === 'recast'
            );

            return hasRecasted;
        } catch (error) {
            console.error('Error verifying Farcaster recast:', error);
            throw new Error(`Failed to verify recast: ${error.message}`);
        }
    }

    /**
     * Verify if a user quoted a specific cast
     * @param {number} fid - User's Farcaster ID
     * @param {string} castHash - Hash of the cast to check
     * @returns {Promise<boolean>}
     */
    async verifyQuote(fid, castHash) {
        try {
            // Get user's recent casts
            const response = await this.client.fetchCastsForUser(fid, {
                limit: 50,
            });

            // Check if any cast is a quote of the target cast
            const hasQuoted = response.casts.some(cast => {
                return cast.parent_hash === castHash && cast.text && cast.text.length > 0;
            });

            return hasQuoted;
        } catch (error) {
            console.error('Error verifying Farcaster quote:', error);
            throw new Error(`Failed to verify quote: ${error.message}`);
        }
    }

    /**
     * Verify if a user commented on a specific cast
     * @param {number} fid - User's Farcaster ID
     * @param {string} castHash - Hash of the cast to check
     * @returns {Promise<boolean>}
     */
    async verifyComment(fid, castHash) {
        try {
            // Get cast replies
            const response = await this.client.fetchAllCastsInThread(castHash);

            // Check if user has replied to the cast
            const hasCommented = response.casts.some(
                cast => cast.author.fid === fid && cast.parent_hash === castHash
            );

            return hasCommented;
        } catch (error) {
            console.error('Error verifying Farcaster comment:', error);
            throw new Error(`Failed to verify comment: ${error.message}`);
        }
    }

    /**
     * Get user info by FID
     * @param {number} fid - Farcaster ID
     * @returns {Promise<Object>}
     */
    async getUserByFid(fid) {
        try {
            const response = await this.client.fetchBulkUsers([fid]);
            return response.users[0] || null;
        } catch (error) {
            console.error('Error fetching Farcaster user:', error);
            return null;
        }
    }

    /**
     * Verify if a wallet address is linked to a Farcaster ID
     * @param {number} fid - Farcaster ID
     * @param {string} walletAddress - Wallet address to check
     * @returns {Promise<boolean>}
     */
    async verifyWalletLinkage(fid, walletAddress) {
        try {
            const user = await this.getUserByFid(fid);
            if (!user) return false;

            const normalizedAddress = walletAddress.toLowerCase();

            // Check custody address
            if (user.custody_address && user.custody_address.toLowerCase() === normalizedAddress) {
                return true;
            }

            // Check verified addresses (connected wallets)
            if (user.verified_addresses && user.verified_addresses.eth_addresses) {
                return user.verified_addresses.eth_addresses.some(
                    addr => addr.toLowerCase() === normalizedAddress
                );
            }

            return false;
        } catch (error) {
            console.error('Error verifying wallet linkage:', error);
            return false;
        }
    }
}

module.exports = new NeynarService();
