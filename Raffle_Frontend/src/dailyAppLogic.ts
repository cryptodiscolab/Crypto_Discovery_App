import { supabase } from './lib/supabaseClient';
import { cleanWallet } from './utils/cleanWallet';
import { referralUtils } from './utils/referralUtils';

/**
 * ensureUserProfile: Securely guarantee a record exists in user_profiles via Backend API.
 * @param {string} walletAddress
 * @param {string} signature
 * @param {string} message
 */
export async function ensureUserProfile(walletAddress: string, signature: string, message: string, fid: unknown = null, token: string | null = null) {
    if (!walletAddress || !signature || !message) return null;
    const normalizedAddress = cleanWallet(walletAddress);
    const referred_by = referralUtils.getReferrer();

    try {
        const response = await fetch('/api/user/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: normalizedAddress,
                signature,
                message,
                fid,
                referred_by,
                token
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Profile sync failed");

        // Clear referrer after successful sync to prevent re-attribution
        if (referred_by) referralUtils.clearReferrer();

        return result.profile;
    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[Ensure Profile] Critical Error:', errMsg);
        // Persist error for admin visibility (fire-and-forget)
        try {
            fetch('/api/user-bundle', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    action: 'log-activity',
                    wallet_address: normalizedAddress,
                    signature: 'system-error',
                    message: 'Profile Sync Failure',
                    category: 'ERROR',
                    type: 'Profile Sync Failed',
                    description: (errMsg || 'Unknown error').slice(0, 200),
                    metadata: { source: 'ensureUserProfile' }
                })
            }).catch(() => {});
        } catch { /* never throw from error reporter */ }
        return null;
    }
}

/**
 * addXP: Securely award XP via Backend API.
 * @param {string} walletAddress
 * @param {string} signature
 * @param {string} message
 * @param {number} taskId
 * @param {number} xpReward
 */
export async function awardTaskXP(walletAddress: string, signature: string, message: string, taskId: string | number, xpReward: number) {
    try {
        const response = await fetch('/api/tasks/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: walletAddress,
                signature,
                message,
                task_id: taskId,
                xp_reward: xpReward
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "XP Award failed");

        return { success: true, ...result };
    } catch (err: unknown) {
        console.error('[Award XP Error]', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        // Persist XP award error for admin visibility (fire-and-forget)
        try {
            fetch('/api/user-bundle', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    action: 'log-activity',
                    wallet_address: walletAddress,
                    signature: 'system-error',
                    message: 'XP Award Failure',
                    category: 'ERROR',
                    type: 'XP Award Failed',
                    description: (errMsg || 'Unknown error').slice(0, 200),
                    metadata: { source: 'awardTaskXP', task_id: String(taskId) }
                })
            }).catch(() => {});
        } catch { /* never throw */ }
        return { success: false, error: errMsg };
    }
}

// ==========================================
// READ-ONLY UTILITIES (Safe to keep as direct Supabase calls)
// ==========================================

export async function getUserStatsByFid(fid: unknown) {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('fid', fid)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        return data || { total_xp: 0, tier: 1, last_seen_at: null };
    } catch (err: unknown) {
        console.error('[User Stats] Error:', err);
        return null;
    }
}

export async function getSBTThresholds() {
    try {
        const { data, error } = await supabase
            .from('sbt_thresholds')
            .select('*')
            .order('level', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (err: unknown) {
        console.error('[SBT Config] Error fetching thresholds:', err);
        return [];
    }
}
