-- ============================================================
-- CRYPTO DISCO APP — SBT ENFORCEMENT & TIER HARDENING v3
-- Fix: Corrected ALL column references based on real schema:
--   profiles table -> address, display_name, bio, pfp_url, neynar_score, updated_at
--   user_profiles  -> wallet_address, fid, username, tier, total_xp, referred_by, etc.
-- ============================================================

-- 1. Hardened Leaderboard Tier Computation
--    Users with tier 0 (Guest) cannot be promoted via XP alone.
--    They MUST have their tier updated by the cron job after detecting on-chain SBT.
CREATE OR REPLACE FUNCTION public.fn_compute_leaderboard_tiers()
RETURNS TABLE (
    wallet_address TEXT,
    computed_tier INTEGER 
) AS $$
DECLARE
    diamond_p FLOAT;
    gold_p FLOAT;
    silver_p FLOAT;
    bronze_p FLOAT;
    settings JSONB;
BEGIN
    SELECT value INTO settings FROM public.system_settings WHERE key = 'tier_percentiles';
    diamond_p := COALESCE((settings->>'diamond')::FLOAT, 0.01);
    gold_p    := COALESCE((settings->>'gold')::FLOAT, 0.10);
    silver_p  := COALESCE((settings->>'silver')::FLOAT, 0.30);
    bronze_p  := COALESCE((settings->>'bronze')::FLOAT, 0.70);

    RETURN QUERY
    WITH RankedUsers AS (
        SELECT 
            p.wallet_address,
            p.total_xp,
            p.tier AS current_tier,
            p.tier_override,
            PERCENT_RANK() OVER (ORDER BY p.total_xp DESC) AS percentile
        FROM public.user_profiles p
        WHERE p.total_xp > 0 OR p.tier_override IS NOT NULL
    )
    SELECT 
        ru.wallet_address,
        CASE 
            WHEN ru.tier_override IS NOT NULL THEN ru.tier_override
            -- *** SBT GATE: If user has not minted SBT (tier = 0), keep at 0 ***
            WHEN ru.current_tier = 0 THEN 0
            -- If SBT Holder, compute grade from XP percentile
            WHEN ru.percentile <= diamond_p THEN 4 -- DIAMOND
            WHEN ru.percentile <= gold_p    THEN 3 -- GOLD
            WHEN ru.percentile <= silver_p  THEN 2 -- SILVER
            WHEN ru.percentile <= bronze_p  THEN 1 -- BRONZE
            ELSE 1 -- Minimum bronze for all SBT holders
        END::INTEGER AS computed_tier
    FROM RankedUsers ru;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Secure v_user_full_profile View (SCHEMA-CORRECT VERSION)
-- profiles  -> address, display_name, bio, pfp_url, neynar_score
-- user_profiles -> wallet_address, fid, username, tier, total_xp, referred_by, etc.
DROP VIEW IF EXISTS public.v_user_full_profile;

CREATE OR REPLACE VIEW public.v_user_full_profile AS
WITH all_wallets AS (
    SELECT LOWER(address) AS w_address FROM public.profiles
    UNION
    SELECT LOWER(wallet_address) FROM public.user_profiles
    UNION
    SELECT LOWER(wallet_address) FROM public.ens_subdomains
)
SELECT 
    w.w_address                                             AS wallet_address,
    up.fid,
    COALESCE(up.username, up.display_name, '')              AS username,
    COALESCE(
        NULLIF(up.display_name, ''),
        NULLIF(p.display_name, ''),
        ens.full_name,
        '0x' || substring(w.w_address FROM 3 FOR 4) || '...' || RIGHT(w.w_address, 4)
    )                                                       AS display_name,
    COALESCE(up.bio, p.bio, '')                             AS bio,
    COALESCE(NULLIF(up.pfp_url, ''), p.pfp_url, '')         AS pfp_url,
    COALESCE(up.neynar_score, p.neynar_score, 0)            AS neynar_score,
    COALESCE(up.total_xp, 0)                                AS total_xp,
    COALESCE(up.tier, 0)                                    AS tier,
    up.referred_by,
    CASE 
        -- *** SBT GATE: No SBT = always 'Guest', cannot rank up ***
        WHEN COALESCE(up.tier, 0) = 0 THEN 'Guest'
        -- SBT Holder rank names based on synced on-chain tier
        WHEN COALESCE(up.tier, 0) = 5 THEN 'Diamond'
        WHEN COALESCE(up.tier, 0) = 4 THEN 'Platinum'
        WHEN COALESCE(up.tier, 0) = 3  THEN 'Gold'
        WHEN COALESCE(up.tier, 0) = 2  THEN 'Silver'
        WHEN COALESCE(up.tier, 0) = 1  THEN 'Bronze'
        ELSE 'Guest'
    END                                                     AS rank_name,
    ens.full_name                                           AS ens_name,
    COALESCE(p.updated_at, up.created_at, ens.created_at)  AS updated_at
FROM all_wallets w
LEFT JOIN public.profiles p
    ON w.w_address = LOWER(p.address)
LEFT JOIN public.user_profiles up
    ON w.w_address = LOWER(up.wallet_address)
LEFT JOIN public.ens_subdomains ens
    ON w.w_address = LOWER(ens.wallet_address);

-- Grant access
GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;

COMMENT ON VIEW public.v_user_full_profile IS 'Master View with SBT Gate: Users with tier=0 (no SBT minted) display as Guest.';
