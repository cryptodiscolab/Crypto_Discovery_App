const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

class SupabaseService {
    constructor() {
        if (!config.supabase.url || !config.supabase.serviceRoleKey) {
            console.warn('⚠️  Supabase configuration missing in verification-server!');
            return;
        }

        this.client = createClient(
            config.supabase.url,
            config.supabase.serviceRoleKey,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                }
            }
        );
    }

    /**
     * Get a specific task by ID
     * @param {string} taskId - Task UUID
     * @returns {Promise<Object>}
     */
    async getTaskById(taskId) {
        try {
            const { data, error } = await this.client
                .from('daily_tasks')
                .select('*')
                .eq('id', taskId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('[Supabase] Error getting task:', error.message);
            return null;
        }
    }

    /**
     * Check if a user has already claimed a specific target (Anti-Cheat)
     * @param {string} walletAddress - User's wallet
     * @param {string} platform - e.g., 'twitter'
     * @param {string} actionType - e.g., 'follow'
     * @param {string} targetId - The specific account/tweet ID
     * @returns {Promise<boolean>}
     */
    async hasAlreadyClaimedTarget(walletAddress, platform, actionType, targetId) {
        try {
            const { count, error } = await this.client
                .from('user_task_claims')
                .select('id', { count: 'exact', head: true })
                .eq('wallet_address', walletAddress.toLowerCase())
                .eq('platform', platform)
                .eq('action_type', actionType)
                .eq('target_id', targetId);

            if (error) throw error;
            return count > 0;
        } catch (error) {
            console.error('[Supabase] Error checking target claim:', error.message);
            return false;
        }
    }

    /**
     * Record a task claim in the database
     * @param {string} walletAddress - User's wallet address
     * @param {string} taskId - Task UUID
     * @param {number} xpEarned - XP awarded
     * @param {string} platform - Platform name
     * @param {string} actionType - Action type
     * @param {string} targetId - (Optional) Target ID for anti-cheat
     * @returns {Promise<Object>}
     */
    async recordClaim(walletAddress, taskId, xpEarned, platform, actionType, targetId = null) {
        if (!this.client) throw new Error('Supabase client not initialized');

        const normalizedWallet = walletAddress.toLowerCase();

        try {
            // Ensure user profile exists first
            await this.ensureProfile(normalizedWallet);

            // Check for existing claim (safety check)
            const { data: existing, error: checkError } = await this.client
                .from('user_task_claims')
                .select('id')
                .eq('wallet_address', normalizedWallet)
                .eq('task_id', taskId)
                .maybeSingle();

            if (checkError) throw checkError;
            if (existing) {
                console.warn(`[Supabase] Claim already exists for wallet ${walletAddress} and task ${taskId}`);
                return { success: false, error: 'Task already claimed in database today' }; // Keep original error message for consistency
            }

            // Insert new claim
            const { data, error } = await this.client
                .from('user_task_claims')
                .insert({
                    wallet_address: normalizedWallet,
                    task_id: taskId,
                    xp_earned: xpEarned,
                    platform: platform,
                    action_type: actionType,
                    target_id: targetId,
                    claimed_at: new Date().toISOString()
                })
                .select()
                .single(); // Changed to single to match the new implementation's return type

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('[SupabaseService] Error recording claim:', error.message);
            throw error;
        }
    }

    /**
     * Ensure a user profile row exists. Creates one with defaults if not found.
     * @param {string} walletAddress - Lowercase wallet address
     */
    async ensureProfile(walletAddress) {
        if (!this.client) throw new Error('Supabase client not initialized');

        const { data: profile, error: profileError } = await this.client
            .from('user_profiles')
            .select('wallet_address')
            .eq('wallet_address', walletAddress)
            .single();

        if (profileError && profileError.code !== 'PGRST116') throw profileError;

        if (!profile) {
            await this.client
                .from('user_profiles')
                .insert({ wallet_address: walletAddress, total_xp: 0, tier: 1 });
        }
    }

    /**
     * Sync / Upsert user profile. Called when wallet connects.
     * Zero-Trust: only called from backend after signature verification.
     * @param {string} walletAddress - Lowercase wallet address
     * @param {number|null} fid - Optional Farcaster ID
     */
    async syncUserProfile(walletAddress, fid = null) {
        if (!this.client) throw new Error('Supabase client not initialized');

        try {
            const upsertData = {
                wallet_address: walletAddress,
                last_seen_at: new Date().toISOString(),
            };

            if (fid) upsertData.fid = parseInt(fid);

            const { data, error } = await this.client
                .from('user_profiles')
                .upsert(upsertData, {
                    onConflict: 'wallet_address',
                    ignoreDuplicates: false,
                })
                .select()
                .single();

            if (error) throw error;

            return data;
        } catch (error) {
            console.error('[SupabaseService] Error syncing profile:', error.message);
            throw error;
        }
    }

    /**
     * Award XP after on-chain task completion (generic tasks).
     * Inserts a claim record + increments total_xp in user_profiles.
     * Prevents double-claim via unique constraint on (wallet_address, task_id, date).
     *
     * @param {string} walletAddress - Lowercase wallet address
     * @param {string|number} taskId - Task ID (contract ID or UUID string)
     * @param {number} xpReward - Amount of XP to award
     */
    async awardXP(walletAddress, taskId, xpReward) {
        if (!this.client) throw new Error('Supabase client not initialized');

        try {
            // Ensure profile exists before awarding XP
            await this.ensureProfile(walletAddress);

            // 1. Insert claim record
            const { data: claim, error: claimError } = await this.client
                .from('user_task_claims')
                .insert({
                    wallet_address: walletAddress,
                    task_id: String(taskId),
                    xp_earned: xpReward,
                    claimed_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (claimError) {
                if (claimError.code === '23505') {
                    return { success: false, alreadyClaimed: true, error: 'XP already awarded for this task today' };
                }
                throw claimError;
            }

            // 2. Increment total_xp: Handled by database trigger 'trg_sync_user_xp_on_claim'
            // in Supabase. The trigger automatically sums all claims for the user.

            return { success: true, claim, xpAwarded: xpReward };
        } catch (error) {
            console.error('[SupabaseService] Error awarding XP:', error.message);
            throw error;
        }
    }

    /**
     * Update Neynar score for a user
     */
    async updateUserScore(walletAddress, score) {
        if (!this.client) return;
        try {
            await this.client
                .from('user_profiles')
                .update({ neynar_score: score })
                .eq('wallet_address', walletAddress.toLowerCase());
        } catch (err) {
            console.error('[SupabaseService] Error updating score:', err);
        }
    }
}

module.exports = new SupabaseService();
