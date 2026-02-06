import { createClient } from '@supabase/supabase-js';

// ==========================================
// 1. INISIALISASI (Koneksi ke Supabase)
// Menggunakan variabel dari file .env lu
// ==========================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Kalo lu jalanin ini di server (Project IDX), disarankan pake Service Role Key
// tapi kalo di Frontend, Anon Key sudah cukup.
export const supabase = createClient(supabaseUrl, supabaseKey);


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
        console.log(`[XP Engine] Awarding XP for ${activityKey} to FID: ${fid}`);

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
