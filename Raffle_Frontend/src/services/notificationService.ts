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
     * @param {number|string} fid - Farcaster ID penerima.
     * @param {string} message - Isi pesan (max 500 karakter).
     * @param {"mention"|"cast"} type - Tipe notifikasi.
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
            console.error('[NotificationService] Fetch error:', (error as any).message);
            return false;
        }
    },

    /**
     * Kirim notifikasi dengan wallet signature (user-initiated).
     * @param {number|string} fid - Farcaster ID penerima.
     * @param {string} message - Isi pesan.
     * @param {string} wallet - Wallet address pengirim.
     * @param {string} signature - EIP-191 signature.
     * @param {string} signedMessage - Message yang di-sign.
     * @param {"mention"|"cast"} type - Tipe notifikasi.
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
            console.error('[NotificationService] Fetch error:', (error as any).message);
            return false;
        }
    },

    /**
     * Cek deadline reward dan trigger notifikasi jika diperlukan.
     * Logika ini berjalan di client — hanya memeriksa, tidak kirim langsung ke Neynar.
     */
    checkDeadlinesAndNotify(unclaimedRewards: any[]) {
        const now = Date.now();
        unclaimedRewards.forEach((reward: any) => {
            if (!reward.isClaimed && reward.deadline) {
                const timeLeft = reward.deadline - now;
                // 1 jam sebelum deadline: trigger notification via server
                if (timeLeft < 3600000 && timeLeft > 0 && reward.fid) {
                    this.sendFarcasterNotification(
                        reward.fid,
                        `⏰ Klaim reward kamu sebelum expired dalam 1 jam!`,
                        'mention'
                    );
                }
            }
        });
    }
};
