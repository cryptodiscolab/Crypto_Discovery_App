const { NeynarAPIClient } = require('@neynar/nodejs-sdk');
const config = require('../config');

class NeynarService {
    constructor() {
        if (!config.neynar.apiKey) {
            throw new Error('NEYNAR_API_KEY is not configured');
        }
        this.client = new NeynarAPIClient({ apiKey: config.neynar.apiKey });
    }

    /**
     * Verify if a user follows another user on Farcaster
     * @param {number} fid - User's Farcaster ID
     * @param {number} targetFid - Target user's Farcaster ID to check if followed
     * @returns {Promise<boolean>}
     */
    async verifyFollow(fid, targetFid) {
        try {
            let cursor = null;
            let attempts = 0;
            const maxPages = 5; // Safety cap: 500 followings checked

            while (attempts < maxPages) {
                const response = await this.client.v2.fetchUserFollowing(fid, {
                    limit: 100,
                    cursor: cursor || undefined
                });

                const isFollowing = response.users.some(user => user.fid === targetFid);
                if (isFollowing) return true;

                cursor = response.next;
                if (!cursor) break;
                attempts++;
            }

            return false;
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
            let cursor = null;
            let attempts = 0;
            const maxPages = 5; // Safety cap: 500 reactions checked

            while (attempts < maxPages) {
                const response = await this.client.v2.fetchCastReactions(castHash, {
                    limit: 100,
                    cursor: cursor || undefined
                });

                const hasLiked = response.reactions.some(
                    reaction => reaction.user.fid === fid && reaction.reaction_type === 'like'
                );
                if (hasLiked) return true;

                cursor = response.next;
                if (!cursor) break;
                attempts++;
            }

            return false;
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
            let cursor = null;
            let attempts = 0;
            const maxPages = 3; // Safety cap for recasts

            while (attempts < maxPages) {
                const response = await this.client.v2.fetchCastReactions(castHash, {
                    limit: 100,
                    cursor: cursor || undefined
                });

                const hasRecasted = response.reactions.some(
                    reaction => reaction.user.fid === fid && reaction.reaction_type === 'recast'
                );
                if (hasRecasted) return true;

                cursor = response.next;
                if (!cursor) break;
                attempts++;
            }

            return false;
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
            const response = await this.client.v2.fetchCastsForUser(fid, {
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
            const response = await this.client.v2.fetchConversation(castHash, { type: 'farcaster' });

            // Check if user has replied to the cast
            const hasCommented = response.conversation.cast.replies.some(
                cast => cast.author.fid === fid && cast.parent_hash === castHash
            );

            return hasCommented;
        } catch (error) {
            console.error('Error verifying Farcaster comment:', error);
            throw new Error(`Failed to verify comment: ${error.message}`);
        }
    }

    /**
     * Get Farcaster user info by wallet address
     * @param {string} walletAddress - Ethereum address
     * @returns {Promise<Object|null>}
     */
    async getUserByAddress(walletAddress) {
        try {
            const response = await this.client.v2.fetchBulkUsersByAddress([walletAddress.toLowerCase()]);
            // The API returns an object where keys are addresses
            const users = response[walletAddress.toLowerCase()];
            return (users && users.length > 0) ? users[0] : null;
        } catch (error) {
            console.error('Error fetching Farcaster user by address:', error);
            return null;
        }
    }

    /**
     * Get user info by FID
     ...

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
