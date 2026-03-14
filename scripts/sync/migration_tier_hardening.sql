-- Migration: Tier Hardening & Rank-XP Unification
-- Goal: Remove hardcoded rank thresholds from views and code.

-- 1. Ensure system_settings has the canonical tier_percentiles (Audit check)
-- (We already verified this exists: {"diamond": 0.01, "platinum": 0.05, "gold": 0.15, "silver": 0.4, "bronze": 0.8})

-- 2. Update v_user_full_profile to use dynamic percentile calculation
-- We will pull percentiles from system_settings.
OR REPLACE VIEW public.v_user_full_profile AS
WITH user_scores AS (
    SELECT 
        *,
        (COALESCE(total_xp, 0) + COALESCE(manual_xp_bonus, 0))::integer AS effective_xp,
        percent_rank() OVER (ORDER BY (COALESCE(total_xp, 0) + COALESCE(manual_xp_bonus, 0))) AS p_rank
    FROM user_profiles
),
settings AS (
    SELECT value->>'diamond' as p_diamond,
           value->>'platinum' as p_platinum,
           value->>'gold' as p_gold,
           value->>'silver' as p_silver,
           value->>'bronze' as p_bronze
    FROM system_settings WHERE key = 'tier_percentiles'
)
SELECT 
    us.wallet_address,
    us.fid,
    us.username,
    us.display_name,
    us.pfp_url,
    us.effective_xp AS total_xp,
    us.tier,
    us.referred_by,
    us.last_daily_bonus_claim,
    us.streak_count,
    CASE
        WHEN us.p_rank >= (1.0 - (s.p_diamond)::double precision) THEN 'Diamond'
        WHEN us.p_rank >= (1.0 - (s.p_platinum)::double precision) THEN 'Platinum'
        WHEN us.p_rank >= (1.0 - (s.p_gold)::double precision) THEN 'Gold'
        WHEN us.p_rank >= (1.0 - (s.p_silver)::double precision) THEN 'Silver'
        WHEN us.p_rank >= (1.0 - (s.p_bronze)::double precision) THEN 'Bronze'
        ELSE 'Rookie'
    END AS rank_name,
    us.updated_at,
    us.is_admin,
    us.is_operator,
    us.bio,
    us.follower_count,
    us.following_count,
    us.neynar_score,
    us.verifications,
    us.power_badge,
    us.active_status,
    us.twitter_id,
    us.twitter_username,
    us.google_id,
    us.google_email,
    us.oauth_provider,
    us.manual_xp_bonus
FROM user_scores us, settings s;

-- 3. Verify sbt_thresholds table exists and is populated correctly
-- (This table is used for MIN XP requirements for certain actions, separate from leaderboard rank)
