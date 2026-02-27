/**
 * Notification Service
 * Semua panggilan Neynar dilakukan melalui /api/notify (server-side).
 * NEYNAR_API_KEY TIDAK pernah ada di client bundle ini. (Rule §6 .cursorrules)
 */

export const NotificationService = {
    /**
     * Kirim notifikasi ke Farcaster user via server endpoint /api/notify.
     * @param {number|string} fid - Farcaster ID penerima.
     * @param {string} message - Isi pesan (max 500 karakter).
     * @param {"mention"|"cast"} type - Tipe notifikasi.
     */
    async sendFarcasterNotification(fid, message, type = 'mention') {
        if (!fid || !message) {
            console.warn('[NotificationService] Missing fid or message');
            return false;
        }

        try {
            const response = await fetch('/api/notify', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ fid, message, type })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                console.error('[NotificationService] Server error:', err.error || response.status);
                return false;
            }

            return true;
        } catch (error) {
            console.error('[NotificationService] Fetch error:', error.message);
            return false;
        }
    },

    /**
     * Cek deadline reward dan trigger notifikasi jika diperlukan.
     * Logika ini berjalan di client — hanya memeriksa, tidak kirim langsung ke Neynar.
     */
    checkDeadlinesAndNotify(unclaimedRewards) {
        const now = Date.now();
        unclaimedRewards.forEach(reward => {
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
