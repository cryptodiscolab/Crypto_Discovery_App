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
                return { success: false, error: 'Task already claimed in database today' };
            }

            // NEW: Anti-Cheat - Double check by target_id if provided
            if (targetId) {
                const hasClaimedTarget = await this.hasAlreadyClaimedTarget(
                    normalizedWallet,
                    platform,
                    actionType,
                    targetId
                );
                if (hasClaimedTarget) {
                    console.warn(`[Supabase] Anti-Cheat: User ${walletAddress} already claimed target ${targetId}`);
                    return { success: false, error: '[Security] Target account already claimed by this user' };
                }
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

            if (error) {
                if (error.code === '23505') {
                    console.log(`[Supabase] Graceful handled duplicate claim for wallet ${walletAddress} on task ${taskId}`);
                    return { success: true, message: 'Task already claimed' };
                }
                throw error;
            }
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
            try {
                await this.client
                    .from('user_profiles')
                    .insert({ wallet_address: walletAddress, total_xp: 0, tier: 1 });
            } catch (err) {
                // Ignore 23505 (Profile created by another concurrent request)
                if (err.code !== '23505') throw err;
            }
        }
    }

    /**
     * Link a Twitter account to a wallet address (Sybil Protection)
     * @param {string} walletAddress - User's wallet
     * @param {string} twitterId - Twitter numerical ID
     * @param {string} twitterUsername - Twitter handle
     */
    async linkTwitterAccount(walletAddress, twitterId, twitterUsername) {
        if (!this.client) throw new Error('Supabase client not initialized');
        const normalizedWallet = walletAddress.toLowerCase();

        try {
            // Check if twitterId is already linked to another wallet
            const { data: existing, error: checkError } = await this.client
                .from('user_profiles')
                .select('wallet_address')
                .eq('twitter_id', twitterId)
                .neq('wallet_address', normalizedWallet)
                .maybeSingle();

            if (checkError) throw checkError;
            if (existing) {
                throw new Error(`[Security] Twitter account ${twitterUsername} is already linked to wallet ${existing.wallet_address}. Sybil attack blocked.`);
            }

            // Update profile with twitter data
            const { error } = await this.client
                .from('user_profiles')
                .update({
                    twitter_id: twitterId,
                    twitter_username: twitterUsername,
                    updated_at: new Date().toISOString()
                })
                .eq('wallet_address', normalizedWallet);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('[SupabaseService] Error linking twitter:', error.message);
            throw error;
        }
    }

    /**
     * Link a Telegram account to a wallet (Sybil Protection)
     */
    async linkTelegramAccount(walletAddress, telegramId, telegramUsername) {
        return this._linkSocialAccount(walletAddress, 'telegram_id', 'telegram_username', telegramId, telegramUsername);
    }

    /**
     * Link a TikTok account to a wallet
     */
    async linkTikTokAccount(walletAddress, tiktokId, tiktokUsername) {
        return this._linkSocialAccount(walletAddress, 'tiktok_id', 'tiktok_username', tiktokId, tiktokUsername);
    }

    /**
     * Link an Instagram account to a wallet
     */
    async linkInstagramAccount(walletAddress, instagramId, instagramUsername) {
        return this._linkSocialAccount(walletAddress, 'instagram_id', 'instagram_username', instagramId, instagramUsername);
    }

    /**
     * Generic social account linking with Identity Lock
     * @private
     */
    async _linkSocialAccount(walletAddress, idColumn, userColumn, socialId, socialUsername) {
        if (!this.client) throw new Error('Supabase client not initialized');
        const normalizedWallet = walletAddress.toLowerCase();

        try {
            const { data: existing, error: checkError } = await this.client
                .from('user_profiles')
                .select('wallet_address')
                .eq(idColumn, socialId)
                .neq('wallet_address', normalizedWallet)
                .maybeSingle();

            if (checkError) throw checkError;
            if (existing) {
                throw new Error(`[Security] This social account is already linked to wallet ${existing.wallet_address}.`);
            }

            const { error } = await this.client
                .from('user_profiles')
                .update({
                    [idColumn]: socialId,
                    [userColumn]: socialUsername,
                    updated_at: new Date().toISOString()
                })
                .eq('wallet_address', normalizedWallet);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error(`[SupabaseService] Error linking social account (${idColumn}):`, error.message);
            throw error;
        }
    }

    /**
     * Sync / Upsert user profile. Called when wallet connects.
     * Zero-Trust: only called from backend after signature verification.
     * @param {string} walletAddress - Lowercase wallet address
     * @param {number|null} fid - Optional Farcaster ID
     * @param {Object|null} twitterData - Optional { id, username }
     * @param {Object|null} telegramData - Optional { id, username }
     * @param {Object|null} tiktokData - Optional { id, username }
     * @param {Object|null} instagramData - Optional { id, username }
     */
    async syncUserProfile(walletAddress, fid = null, twitterData = null, telegramData = null, tiktokData = null, instagramData = null) {
        if (!this.client) throw new Error('Supabase client not initialized');

        try {
            const upsertData = {
                wallet_address: walletAddress,
                last_login_at: new Date().toISOString(),
            };

            if (fid) upsertData.fid = parseInt(fid);
            if (twitterData) {
                upsertData.twitter_id = twitterData.id;
                upsertData.twitter_username = twitterData.username;
            }
            if (telegramData) {
                upsertData.telegram_id = telegramData.id;
                upsertData.telegram_username = telegramData.username;
            }
            if (tiktokData) {
                upsertData.tiktok_id = tiktokData.id;
                upsertData.tiktok_username = tiktokData.username;
            }
            if (instagramData) {
                upsertData.instagram_id = instagramData.id;
                upsertData.instagram_username = instagramData.username;
            }

            const { data, error } = await this.client
                .from('user_profiles')
                .upsert(upsertData, {
                    onConflict: 'wallet_address',
                    ignoreDuplicates: false,
                })
                .select()
                .single();

            if (error) {
                // Security Check: Handle Unique Identity Lock Violation
                if (error.code === '23505') {
                    const detail = error.details || error.message || '';
                    let platform = 'Social account';
                    if (detail.includes('fid')) platform = 'Farcaster FID';
                    else if (detail.includes('twitter_id')) platform = 'Twitter ID';
                    else if (detail.includes('telegram_id')) platform = 'Telegram ID';
                    else if (detail.includes('tiktok_id')) platform = 'TikTok ID';
                    else if (detail.includes('instagram_id')) platform = 'Instagram ID';

                    throw new Error(`[Security Alert] ${platform} is already linked to another wallet. Identity Lock violation blocked.`);
                }
                throw error;
            }
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

            // 🔐 Zero-Trust Enhancement: Lookup reward from point_settings for virtual tasks
            let finalXp = xpReward;
            if (typeof taskId === 'string' && (taskId.startsWith('raffle_buy') || taskId.includes('_'))) {
                const activityName = taskId.startsWith('raffle_buy') ? 'raffle_buy' : taskId;
                const { data: setting } = await this.client
                    .from('point_settings')
                    .select('points_value')
                    .eq('activity_key', activityName)
                    .single();

                if (setting) {
                    finalXp = setting.points_value;
                    console.log(`[Supabase] Overriding XP with Ground Truth for ${activityName}: ${finalXp}`);
                }
            }

            // 1. Insert claim record
            const { data: claim, error: claimError } = await this.client
                .from('user_task_claims')
                .insert({
                    wallet_address: walletAddress,
                    task_id: String(taskId),
                    xp_earned: finalXp,
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

            // 2. Increment total_xp: [Fix v3.41.2 Hardening] 
            // Scaling is now handled atomically by public.fn_increment_xp 
            // to ensure Global & Individual multipliers are calculated.
            try {
                await this.client.rpc('fn_increment_xp', {
                    p_wallet: walletAddress.toLowerCase(),
                    p_amount: finalXp
                });
            } catch (xpErr) {
                console.error('[SupabaseService] fn_increment_xp failed:', xpErr.message);
                // We don't fail the whole request since the claim was already recorded.
            }

            return { success: true, claim, xpAwarded: finalXp };
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

    /**
     * Sync a batch of tasks from Admin Dashboard to daily_tasks table.
     * Uses upsert to handle new or updated tasks.
     * @param {Array} tasks - Array of task objects
     */
    async syncTaskBatch(tasks) {
        if (!this.client) throw new Error('Supabase client not initialized');

        try {
            const { data, error } = await this.client
                .from('daily_tasks')
                .upsert(tasks.map(task => ({
                    ...task,
                    is_active: true, // Admin-created tasks are active by default in sync
                    updated_at: new Date().toISOString()
                })), {
                    onConflict: 'platform,action_type,target_id', // Prevent duplicates
                    ignoreDuplicates: false
                })
                .select();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('[SupabaseService] Error syncing task batch:', error.message);
            throw error;
        }
    }
    /**
     * Mark user as Base Social Verified (Basenames)
     * @param {string} walletAddress - User's wallet
     * @returns {Promise<Object>}
     */
    async verifyBaseSocial(walletAddress) {
        if (!this.client) throw new Error('Supabase client not initialized');
        const normalizedWallet = walletAddress.toLowerCase();

        try {
            const { data, error } = await this.client
                .from('user_profiles')
                .update({
                    is_base_social_verified: true,
                    updated_at: new Date().toISOString()
                })
                .eq('wallet_address', normalizedWallet)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('[Supabase] Error verifying Base Social:', error.message);
            throw error;
        }
    }

    /**
     * Get social linkage (FID, TwitterID) for a wallet address
     * @param {string} walletAddress - User's wallet
     */
    async getSocialLinkage(walletAddress) {
        if (!this.client) return null;
        try {
            const { data, error } = await this.client
                .from('user_profiles')
                .select('fid, twitter_id, twitter_username, discord_id, telegram_id')
                .eq('wallet_address', walletAddress.toLowerCase())
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('[Supabase] Error getting social linkage:', error.message);
            return null;
        }
    }
}

module.exports = new SupabaseService();
