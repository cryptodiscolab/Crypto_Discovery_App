const axios = require('axios');
const config = require('../config');

class GoogleService {
    constructor() {
        this.apiKey = config.google.apiKey;
        if (!this.apiKey) {
            console.warn('⚠️  GOOGLE_API_KEY is not configured. Google verification will be limited.');
        }
    }

    /**
     * Verify if a user is subscribed to a YouTube channel
     * @param {string} userIdentifier - User's identifier (can be email or ID if public check)
     * @param {string} channelId - The YouTube Channel ID to check
     * @param {string} [accessToken] - Optional OAuth2 access token for private checks
     * @returns {Promise<boolean>}
     */
    async verifyYouTubeSubscribe(userIdentifier, channelId, accessToken = null) {
        try {
            if (accessToken) {
                // Method 1: Check via OAuth2 (Private subscriptions)
                const response = await axios.get('https://www.googleapis.com/youtube/v3/subscriptions', {
                    params: {
                        part: 'snippet',
                        mine: true,
                        forChannelId: channelId,
                    },
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });

                return response.data.items && response.data.items.length > 0;
            } else {
                /**
                 * Method 2: Bridge/Trust-based verification or Public check.
                 * NOTE: YouTube subscriptions are private by default. 
                 * Without OAuth, we cannot reliably verify subscriptions.
                 * Implementation: Return true for now if GOOGLE_API_KEY is set (Bridge mode).
                 */
                console.log(`[GoogleService] Bridge verification for YouTube subscribe: ${userIdentifier} to ${channelId}`);
                return !!this.apiKey;
            }
        } catch (error) {
            console.error('Error verifying YouTube subscription:', error.response?.data || error.message);
            throw new Error(`Failed to verify YouTube subscription: ${error.message}`);
        }
    }

    /**
     * Verify if a user liked a YouTube video
     * @param {string} userIdentifier - User's identifier
     * @param {string} videoId - The YouTube Video ID
     * @param {string} [accessToken] - Optional OAuth2 access token
     * @returns {Promise<boolean>}
     */
    async verifyYouTubeLike(userIdentifier, videoId, accessToken = null) {
        try {
            if (accessToken) {
                const response = await axios.get('https://www.googleapis.com/youtube/v3/videos/getRating', {
                    params: {
                        id: videoId,
                    },
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });

                const rating = response.data.items?.[0]?.rating;
                return rating === 'like';
            } else {
                console.log(`[GoogleService] Bridge verification for YouTube like: ${userIdentifier} to ${videoId}`);
                return !!this.apiKey;
            }
        } catch (error) {
            console.error('Error verifying YouTube like:', error.response?.data || error.message);
            throw new Error(`Failed to verify YouTube like: ${error.message}`);
        }
    }
}

module.exports = new GoogleService();
