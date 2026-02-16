import { supabase } from './lib/supabaseClient';
import { cleanWallet } from './utils/cleanWallet';

/**
 * ensureUserProfile: Securely guarantee a record exists in user_profiles via Backend API.
 * @param {string} walletAddress 
 * @param {string} signature 
 * @param {string} message 
 */
export async function ensureUserProfile(walletAddress, signature, message, fid = null) {
    if (!walletAddress || !signature || !message) return null;
    const normalizedAddress = cleanWallet(walletAddress);

    try {
        const response = await fetch('/api/user/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: normalizedAddress,
                signature,
                message,
                fid
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Profile sync failed");

        return result.profile;
    } catch (err) {
        console.error('[Ensure Profile] Critical Error:', err.message);
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
export async function awardTaskXP(walletAddress, signature, message, taskId, xpReward) {
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
    } catch (err) {
        console.error('[Award XP Error]', err);
        return { success: false, error: err.message };
    }
}

// ==========================================
// READ-ONLY UTILITIES (Safe to keep as direct Supabase calls)
// ==========================================

export async function getUserStatsByFid(fid) {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('fid', fid)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data || { total_xp: 0, tier: 1, last_seen_at: null };
    } catch (err) {
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
    } catch (err) {
        console.error('[SBT Config] Error fetching thresholds:', err);
        return [];
    }
}
