/**
 * Notification Service
 * Handles sending notifications to users via various channels (e.g., Farcaster via Neynar).
 */

const NEYNAR_API_KEY = process.env.VITE_NEYNAR_API_KEY; // Ensure this is in .env

export const NotificationService = {
    /**
     * Send a notification to a Farcaster user via Neynar API.
     * @param {string} fid - The Farcaster ID of the recipient.
     * @param {string} message - The message content.
     */
    async sendFarcasterNotification(fid, message) {
        if (!NEYNAR_API_KEY) {
            console.warn("NotificationService: Missing VITE_NEYNAR_API_KEY");
            return;
        }

        try {
            // Placeholder for actual Neynar API endpoint for sending notifications/casts
            // Currently Neynar focuses on reading/writing casts. Direct notifications might be via frame interactions or specific bot logic.
            // This is a template structure.

            console.log(`[Mock] Sending notification to FID ${fid}: ${message}`);

            /*
            // NEYNAR API Example for proper mentions
            const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
                method: 'POST',
                headers: {
                    'api_key': NEYNAR_API_KEY,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    signer_uuid: 'YOUR_SIGNER_UUID', 
                    // To mention a user, simply include their handle with @ in the text
                    // Neynar automatically parses it if valid.
                    // Or for FIDs specifically without knowing the handle: 
                    // text: `Hey, you won!`, embeds: [], mentions: [fid], mentions_positions: [0]
                    
                    text: `@user ${message}`, // <-- MENTION FORMAT HERE
                    parent_author_fid: fid // Explicitly reply to the user
                })
            });
            */

            return true;
        } catch (error) {
            console.error("NotificationService Error:", error);
            return false;
        }
    },

    /**
     * Check for urgent deadlines and notify.
     * Can be called by the frontend or a periodic service.
     */
    checkDeadlinesAndNotify(unclaimedRewards) {
        const now = Date.now();
        unclaimedRewards.forEach(reward => {
            if (!reward.isClaimed && reward.deadline) {
                const timeLeft = reward.deadline - now;

                // Logic already exists in PointsContext, but this service could centralize external API calls
                if (timeLeft < 3600000 && timeLeft > 0) {
                    console.log(`Urgent: Reward ${reward.id} expires in ${(timeLeft / 60000).toFixed(0)} mins`);
                }
            }
        });
    }
};
