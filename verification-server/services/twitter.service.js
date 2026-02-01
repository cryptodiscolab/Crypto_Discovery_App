const { TwitterApi } = require('twitter-api-v2');
const config = require('../config');

class TwitterService {
    constructor() {
        if (!config.twitter.bearerToken) {
            console.warn('⚠️  TWITTER_BEARER_TOKEN is not configured. Twitter verification will be disabled.');
            this.client = null;
            this.readOnlyClient = null;
            return;
        }

        // Initialize with bearer token for read-only operations
        this.client = new TwitterApi(config.twitter.bearerToken);
        this.readOnlyClient = this.client.readOnly;
    }

    /**
     * Verify if a user follows another user on Twitter
     * @param {string} userId - User's Twitter ID
     * @param {string} targetUserId - Target user's Twitter ID to check if followed
     * @returns {Promise<boolean>}
     */
    async verifyFollow(userId, targetUserId) {
        try {
            // Check if user follows target
            const response = await this.readOnlyClient.v2.following(userId, {
                max_results: 100,
            });

            // Check if target is in following list
            const isFollowing = response.data?.some(user => user.id === targetUserId) || false;

            return isFollowing;
        } catch (error) {
            console.error('Error verifying Twitter follow:', error);
            throw new Error(`Failed to verify follow: ${error.message}`);
        }
    }

    /**
     * Verify if a user liked a specific tweet
     * @param {string} userId - User's Twitter ID
     * @param {string} tweetId - Tweet ID to check
     * @returns {Promise<boolean>}
     */
    async verifyLike(userId, tweetId) {
        try {
            // Get users who liked the tweet
            const response = await this.readOnlyClient.v2.tweetLikedBy(tweetId, {
                max_results: 100,
            });

            // Check if user is in the list
            const hasLiked = response.data?.some(user => user.id === userId) || false;

            return hasLiked;
        } catch (error) {
            console.error('Error verifying Twitter like:', error);
            throw new Error(`Failed to verify like: ${error.message}`);
        }
    }

    /**
     * Verify if a user retweeted a specific tweet
     * @param {string} userId - User's Twitter ID
     * @param {string} tweetId - Tweet ID to check
     * @returns {Promise<boolean>}
     */
    async verifyRetweet(userId, tweetId) {
        try {
            // Get users who retweeted
            const response = await this.readOnlyClient.v2.tweetRetweetedBy(tweetId, {
                max_results: 100,
            });

            // Check if user is in the list
            const hasRetweeted = response.data?.some(user => user.id === userId) || false;

            return hasRetweeted;
        } catch (error) {
            console.error('Error verifying Twitter retweet:', error);
            throw new Error(`Failed to verify retweet: ${error.message}`);
        }
    }

    /**
     * Verify if a user quoted a specific tweet
     * @param {string} userId - User's Twitter ID
     * @param {string} tweetId - Tweet ID to check
     * @returns {Promise<boolean>}
     */
    async verifyQuote(userId, tweetId) {
        try {
            // Get user's recent tweets
            const response = await this.readOnlyClient.v2.userTimeline(userId, {
                max_results: 50,
                expansions: ['referenced_tweets.id'],
            });

            // Check if any tweet is a quote of the target tweet
            const hasQuoted = response.data?.some(tweet => {
                return tweet.referenced_tweets?.some(
                    ref => ref.type === 'quoted' && ref.id === tweetId
                );
            }) || false;

            return hasQuoted;
        } catch (error) {
            console.error('Error verifying Twitter quote:', error);
            throw new Error(`Failed to verify quote: ${error.message}`);
        }
    }

    /**
     * Verify if a user replied to a specific tweet
     * @param {string} userId - User's Twitter ID
     * @param {string} tweetId - Tweet ID to check
     * @returns {Promise<boolean>}
     */
    async verifyComment(userId, tweetId) {
        try {
            // Get user's recent tweets
            const response = await this.readOnlyClient.v2.userTimeline(userId, {
                max_results: 50,
                expansions: ['referenced_tweets.id'],
            });

            // Check if any tweet is a reply to the target tweet
            const hasReplied = response.data?.some(tweet => {
                return tweet.referenced_tweets?.some(
                    ref => ref.type === 'replied_to' && ref.id === tweetId
                );
            }) || false;

            return hasReplied;
        } catch (error) {
            console.error('Error verifying Twitter comment:', error);
            throw new Error(`Failed to verify comment: ${error.message}`);
        }
    }

    /**
     * Get user info by username
     * @param {string} username - Twitter username (without @)
     * @returns {Promise<Object>}
     */
    async getUserByUsername(username) {
        try {
            const response = await this.readOnlyClient.v2.userByUsername(username);
            return response.data || null;
        } catch (error) {
            console.error('Error fetching Twitter user:', error);
            throw new Error(`Failed to fetch user: ${error.message}`);
        }
    }

    /**
     * Get user info by ID
     * @param {string} userId - Twitter user ID
     * @returns {Promise<Object>}
     */
    async getUserById(userId) {
        try {
            const response = await this.readOnlyClient.v2.user(userId);
            return response.data || null;
        } catch (error) {
            console.error('Error fetching Twitter user:', error);
            throw new Error(`Failed to fetch user: ${error.message}`);
        }
    }

    /**
     * Verify if a wallet address is linked to a Twitter ID via a verification tweet
     * @param {string} userId - Twitter User ID
     * @param {string} walletAddress - Wallet address to link
     * @param {string} verificationCode - Unique code to look for in the tweet
     * @returns {Promise<boolean>}
     */
    async verifyLinkage(userId, walletAddress, verificationCode) {
        try {
            // Get user's recent tweets
            const response = await this.readOnlyClient.v2.userTimeline(userId, {
                max_results: 10,
            });

            if (!response.data || response.data.length === 0) return false;

            const normalizedAddress = walletAddress.toLowerCase();

            // Look for a tweet containing both the address and the code
            return response.data.some(tweet => {
                const text = tweet.text.toLowerCase();
                return text.includes(normalizedAddress) && text.includes(verificationCode.toLowerCase());
            });
        } catch (error) {
            console.error('Error verifying Twitter linkage:', error);
            return false;
        }
    }
}

module.exports = new TwitterService();
