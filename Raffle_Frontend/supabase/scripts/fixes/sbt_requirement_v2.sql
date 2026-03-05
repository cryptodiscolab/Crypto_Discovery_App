-- ============================================================
-- CRYPTO DISCO APP — SBT ENFORCEMENT & TIER HARDENING v2
-- Fix: Corrected column references to match profiles schema.
-- ============================================================

-- 1. Hardened Leaderboard Tier Computation
--    Users with tier 0 (Guest) cannot be promoted via XP alone.
--    They MUST have their tier updated by an admin after minting SBT.
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
            p.tier as current_tier,
            p.tier_override,
            PERCENT_RANK() OVER (ORDER BY p.total_xp DESC) as percentile
        FROM public.user_profiles p
        WHERE p.total_xp > 0 OR p.tier_override IS NOT NULL
    )
    SELECT 
        ru.wallet_address,
        CASE 
            WHEN ru.tier_override IS NOT NULL THEN ru.tier_override
            -- *** SBT GATE: If user has never minted SBT (tier = 0), keep at 0 ***
            WHEN ru.current_tier = 0 THEN 0
            -- If SBT Holder, compute grade from XP percentile
            WHEN ru.percentile <= diamond_p THEN 4 -- DIAMOND
            WHEN ru.percentile <= gold_p    THEN 3 -- GOLD
            WHEN ru.percentile <= silver_p  THEN 2 -- SILVER
            WHEN ru.percentile <= bronze_p  THEN 1 -- BRONZE
            ELSE 1 -- Minimum bronze for all SBT holders
        END::INTEGER as computed_tier
    FROM RankedUsers ru;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Secure v_user_full_profile View
-- Locks rank_name to 'Guest' for non-SBT holders.
-- Fixed: uses p.fid, p.farcaster_username, p.neynar_score as per correct profiles schema.
DROP VIEW IF EXISTS public.v_user_full_profile;

CREATE OR REPLACE VIEW public.v_user_full_profile AS
WITH all_wallets AS (
    SELECT LOWER(address) as w_address FROM public.profiles
    UNION
    SELECT LOWER(wallet_address) FROM public.user_profiles
    UNION
    SELECT LOWER(wallet_address) FROM public.ens_subdomains
)
SELECT 
    w.w_address as wallet_address,
    p.fid,
    COALESCE(p.farcaster_username, p.display_name, '') as username,
    COALESCE(
        NULLIF(p.display_name, ''),
        ens.full_name,
        '0x' || substring(w.w_address from 3 for 4) || '...' || substring(w.w_address from length(w.w_address)-3)
    ) as display_name, 
    p.bio,
    p.pfp_url,
    COALESCE(p.neynar_score, 0) as neynar_score,
    COALESCE(up.total_xp, 0) as total_xp,
    COALESCE(up.tier, 0) as tier,
    up.referred_by,
    CASE 
        -- *** SBT GATE: If tier = 0 (no SBT minted), always 'Guest' ***
        WHEN COALESCE(up.tier, 0) = 0 THEN 'Guest'
        -- SBT Holder rank names based on synced tier
        WHEN COALESCE(up.tier, 0) >= 4 THEN 'Diamond'
        WHEN COALESCE(up.tier, 0) = 3  THEN 'Platinum'
        WHEN COALESCE(up.tier, 0) = 2  THEN 'Gold'
        -- Tier 1 = Bronze, but display based on XP milestone within Bronze
        WHEN COALESCE(up.total_xp, 0) >= 1000 THEN 'Bronze'
        ELSE 'Rookie'
    END as rank_name,
    ens.full_name as ens_name,
    COALESCE(p.updated_at, up.created_at, ens.created_at) as updated_at
FROM all_wallets w
LEFT JOIN public.profiles p ON w.w_address = LOWER(p.address)
LEFT JOIN public.user_profiles up ON w.w_address = LOWER(up.wallet_address)
LEFT JOIN public.ens_subdomains ens ON w.w_address = LOWER(ens.wallet_address);

-- Grant access
GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;

COMMENT ON VIEW public.v_user_full_profile IS 'Master View with SBT Gate: Non-SBT users (tier=0) show as Guest.';
