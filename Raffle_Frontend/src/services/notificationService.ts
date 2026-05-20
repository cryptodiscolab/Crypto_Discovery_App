/**
 * Notification Service
 * Semua panggilan Neynar dilakukan melalui /api/notify (server-side).
 * NEYNAR_API_KEY TIDAK pernah ada di client bundle ini. (Rule §6 .cursorrules)
 *
 * For system-initiated notifications (deadline alerts), we use an internal
 * auth header. For user-initiated notifications, the caller must provide
 * wallet + signature.
 */

export const NotificationService = {
    /**
     * Kirim notifikasi ke Farcaster user via server endpoint /api/notify.
     * NOTE: System-level notifications should ideally be triggered server-side (cron/backend).
     * This client-side call relies on the /api/notify endpoint to validate the request
     * without requiring a cron secret from the browser.
     * @param {number|string} fid - Recipient Farcaster ID.
     * @param {string} message - Message content (max 500 characters).
     * @param {"mention"|"cast"} type - Notification type.
     */
    async sendFarcasterNotification(fid: number | string, message: string, type: string = 'mention') {
        if (!fid || !message) {
            console.warn('[NotificationService] Missing fid or message');
            return false;
        }

        try {
            const response = await fetch('/api/notify', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ fid, message, type, source: 'client' })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                console.error('[NotificationService] Server error:', err.error || response.status);
                return false;
            }

            return true;
        } catch (error) {
            console.error('[NotificationService] Fetch error:', (error as Error).message);
            return false;
        }
    },

    /**
     * Kirim notifikasi dengan wallet signature (user-initiated).
     * @param {number|string} fid - Recipient Farcaster ID.
     * @param {string} message - Message content.
     * @param {string} wallet - Sender wallet address.
     * @param {string} signature - EIP-191 signature.
     * @param {string} signedMessage - The signed message.
     * @param {"mention"|"cast"} type - Notification type.
     */
    async sendUserNotification(fid: number | string, message: string, wallet: string, signature: string, signedMessage: string, type: string = 'mention') {
        if (!fid || !message || !wallet || !signature || !signedMessage) {
            console.warn('[NotificationService] Missing required fields');
            return false;
        }

        try {
            const response = await fetch('/api/notify', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ fid, message, type, wallet, signature, signedMessage })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                console.error('[NotificationService] Server error:', err.error || response.status);
                return false;
            }

            return true;
        } catch (error) {
            console.error('[NotificationService] Fetch error:', (error as Error).message);
            return false;
        }
    },

    /**
     * Check reward deadline and trigger notification if needed.
     * This logic runs on the client — only checks, does not send directly to Neynar.
     */
    checkDeadlinesAndNotify(unclaimedRewards: unknown[]) {
        const now = Date.now();
        unclaimedRewards.forEach((reward) => {
            const r = reward as { isClaimed?: boolean; deadline?: number; fid?: number | string };
            if (!r.isClaimed && r.deadline) {
                const timeLeft = r.deadline - now;
                // 1 hour before deadline: trigger notification via server
                if (timeLeft < 3600000 && timeLeft > 0 && r.fid) {
                    this.sendFarcasterNotification(
                        r.fid,
                        `⏰ Claim your reward before it expires in 1 hour!`,
                        'mention'
                    );
                }
            }
        });
    }
};
