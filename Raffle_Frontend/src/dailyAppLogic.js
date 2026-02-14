import { supabase } from './lib/supabaseClient';
import { cleanWallet } from './utils/cleanWallet';



// ==========================================
// 2. LOGIC FUNCTION (Mesin Daily Claim)
// ==========================================
/**
 * handleDailyClaim: Mengatur claim harian dengan cooldown 24 jam.
 * @param {number} fid - Farcaster ID User
 * @param {string} userAddress - Wallet address
 */
export async function handleDailyClaim(fid, userAddress) {
    const COOLDOWN_24H = 86400000;

    try {
        // STEP A: Cek data harian user
        const { data: userData, error } = await supabase
            .from('user_stats')
            .select('last_login_at')
            .eq('fid', fid)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        // STEP B: Cek Cooldown
        const now = new Date();
        if (userData?.last_login_at) {
            const lastClaim = new Date(userData.last_login_at);
            const diff = now.getTime() - lastClaim.getTime();

            if (diff < COOLDOWN_24H) {
                const remaining = COOLDOWN_24H - diff;
                const hours = Math.floor(remaining / (1000 * 60 * 60));
                const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                return { success: false, message: `Rehat dulu bor! Balik lagi ${hours}j ${mins}m lagi.` };
            }
        }

        // STEP C: Eksekusi XP via Central Engine (daily_login key)
        const result = await addXP(fid, 'daily_login', userAddress);

        if (result.success) {
            // Update last_login_at permanen
            await supabase.from('user_stats').update({ last_login_at: now.toISOString() }).eq('fid', fid);

            return {
                success: true,
                message: result.isLevelUp ? `🎉 GG! NAIK KE ${result.tierName.toUpperCase()}!` : `✅ Claim beres! +${result.points} XP.`,
                data: result
            };
        } else {
            return result;
        }

    } catch (err) {
        console.error('[Daily Claim Error]', err);
        return { success: false, error: err.message };
    }
}

// ==========================================
// 3. CENTRAL XP ENGINE (Universal XP Award)
// ==========================================
/**
 * addXP: Universal function to award XP and Log activity.
 * @param {number} fid - Farcaster ID
 * @param {string} activityKey - Key from point_settings (e.g., 'daily_login', 'raffle_buy_ticket')
 * @param {string} userAddress - Wallet address for logging
 */
export async function addXP(fid, activityKey, userAddress) {
    try {


        // 1. Fetch Point Value & Visibility
        const { data: setting, error: sError } = await supabase
            .from('point_settings')
            .select('*')
            .eq('activity_key', activityKey)
            .eq('is_active', true)
            .eq('is_hidden', false)
            .single();

        if (sError || !setting) {
            console.warn(`[XP Engine] Activity ${activityKey} not found or inactive.`);
            return { success: false, message: "Activity inactive" };
        }

        const points = setting.points_value;

        // 2. Get User Current Stats
        const { data: user, error: uError } = await supabase
            .from('user_stats')
            .select('*')
            .eq('fid', fid)
            .single();

        if (uError && uError.code !== 'PGRST116') throw uError;

        const currentXP = user?.total_xp || 0;
        const currentLevel = user?.current_level || 1;
        const newTotalXP = currentXP + points;

        // 3. New Level Check (SBT Thresholds)
        const { data: threshold } = await supabase
            .from('sbt_thresholds')
            .select('level, tier_name')
            .lte('min_xp', newTotalXP)
            .order('min_xp', { ascending: false })
            .limit(1);

        const nextLevelInfo = threshold?.[0] || { level: 1, tier_name: 'Disco Starter' };
        const newLevel = nextLevelInfo.level;
        const isLevelUp = newLevel > currentLevel;

        // 4. Atomic Updates
        const { error: updateError } = await supabase
            .from('user_stats')
            .upsert({
                fid: fid,
                total_xp: newTotalXP,
                current_level: newLevel,
                last_active_at: new Date().toISOString()
            });

        if (updateError) throw updateError;

        // 5. AUDIT LOG: user_point_logs (The Paper Trail)
        await supabase.from('user_point_logs').insert([{
            user_address: userAddress || '0x0',
            fid: fid,
            activity_key: activityKey,
            points_earned: points,
            metadata: { level_up: isLevelUp, new_level: nextLevelInfo.tier_name }
        }]);

        return {
            success: true,
            points,
            isLevelUp,
            tierName: nextLevelInfo.tier_name
        };

    } catch (err) {
        console.error('[XP Engine Error]', err);
        return { success: false, error: err.message };
    }
}

// ==========================================
// 4. REFERRAL SYSTEM (Dynamic Rewards)
// ==========================================
export async function rewardReferrer(referrerFid) {
    // Logic: Fetch 'referral_invite' setting and award to Referrer
    // Optional: Check Multiplier if referrerCount > 10
    return await addXP(referrerFid, 'referral_invite', 'Referral System');
}

// ==========================================
// 5. SBT THRESHOLD MANAGER (Admin Config)
// ==========================================
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

export async function updateSBTThreshold(id, updates) {
    try {
        const { error } = await supabase
            .from('sbt_thresholds')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (err) {
        console.error('[SBT Config] Error updating threshold:', err);
        return { success: false, error: err.message };
    }
}

// ==========================================
// 6. USER SYNC (Frontend Hook Support)
// ==========================================
export async function getUserStatsSupabase(walletAddress) {
    try {
        // First try by wallet if we have it linked
        // For now, we mainly use FID in this logic, but let's assume we can find by wallet in user_point_logs or a mapping
        // Since the current table is user_stats(fid), we might need the FID.
        // For this implementation, we will rely on the caller passing FID.
        return null;
    } catch (e) { return null; }
}

export async function getUserStatsByFid(fid) {
    try {
        const { data, error } = await supabase
            .from('user_stats')
            .select('*')
            .eq('fid', fid)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data || { total_xp: 0, current_level: 0, last_login_at: null };
    } catch (err) {
        console.error('[User Stats] Error:', err);
        return null;
    }
}

/**
 * ensureUserProfile: Guarantee a record exists in user_profiles.
 * Called after Wallet Signature (SIWE).
 */
export async function ensureUserProfile(walletAddress) {
    if (!walletAddress) return null;
    const normalizedAddress = cleanWallet(walletAddress);

    try {
        // 1. Semantic Upsert (Create or Update)
        // We use upsert to guarantee a record exists without race conditions
        const { data, error } = await supabase
            .from('user_profiles')
            .upsert(
                {
                    wallet_address: normalizedAddress,
                    last_login_at: new Date().toISOString()
                },
                {
                    onConflict: 'wallet_address',
                    ignoreDuplicates: false
                }
            )
            .select()
            .single();

        if (error) {
            console.error('[Ensure Profile] Upsert failed:', error.message);
            throw error;
        }

        return data;

    } catch (err) {
        console.error('[Ensure Profile] Critical Error:', err.message);
        return null; // Fail gracefully to prevent app crash
    }
}

// ==========================================
// 7. SBT MINT REQUEST (Anti-Halu Queue)
// ==========================================
export async function requestSBTMint(fid, walletAddress, targetLevel) {
    try {


        // 1. Verify Eligibility (Double Check Server Side)
        const { data: user } = await supabase
            .from('user_stats')
            .select('total_xp, current_level')
            .eq('fid', fid)
            .single();

        if (!user) throw new Error("User not found");

        const { data: threshold } = await supabase
            .from('sbt_thresholds')
            .select('min_xp')
            .eq('level', targetLevel)
            .single();

        if (!threshold) throw new Error("Invalid Tier Level");

        if (user.total_xp < threshold.min_xp) {
            return { success: false, message: `Points insufficient! Need ${threshold.min_xp} XP.` };
        }

        // 2. Check for Pending/Completed Request for this level
        // (Prevent spamming requests)
        const { data: existing } = await supabase
            .from('user_point_logs')
            .select('*')
            .eq('fid', fid)
            .eq('activity_key', `mint_request_lvl_${targetLevel}`)
            .limit(1);

        if (existing && existing.length > 0) {
            return { success: false, message: "Mint request already pending or processed!" };
        }

        // 3. Log Request (Admin Bot will pick this up)
        const { error } = await supabase.from('user_point_logs').insert([{
            user_address: walletAddress,
            fid: fid,
            activity_key: `mint_request_lvl_${targetLevel}`,
            points_earned: 0, // No points earned, just a log
            metadata: {
                type: 'SBT_MINT_REQUEST',
                target_level: targetLevel,
                status: 'pending',
                timestamp: new Date().toISOString()
            }
        }]);

        if (error) throw error;

        return { success: true, message: "Mint Request Queued! Admin will process shortly." };

    } catch (err) {
        console.error('[SBT Mint] Error:', err);
        return { success: false, message: err.message };
    }
}
