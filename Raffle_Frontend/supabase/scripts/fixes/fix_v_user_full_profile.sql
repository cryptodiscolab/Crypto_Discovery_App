-- ROBUST ALIGNMENT: Universal Identity View (Farcaster + Points + Dynamic Tiers)
-- This version uses PERCENT_RANK() for dynamic tier calculation (Diamond, Gold, etc.)

DROP VIEW IF EXISTS public.v_user_full_profile;

CREATE OR REPLACE VIEW public.v_user_full_profile AS
WITH all_wallets AS (
    SELECT LOWER(wallet_address) as w_address FROM public.user_profiles
    UNION
    SELECT LOWER(address) FROM public.profiles
    UNION
    SELECT LOWER(wallet_address) FROM public.ens_subdomains
),
Settings AS (
    -- Fetch percentiles from system_settings
    SELECT 
        COALESCE((value->>'diamond')::FLOAT, 0.01) as diamond_p,
        COALESCE((value->>'platinum')::FLOAT, 0.05) as platinum_p,
        COALESCE((value->>'gold')::FLOAT, 0.15) as gold_p,
        COALESCE((value->>'silver')::FLOAT, 0.40) as silver_p,
        COALESCE((value->>'bronze')::FLOAT, 0.80) as bronze_p
    FROM public.system_settings 
    WHERE key = 'tier_percentiles'
    UNION ALL
    -- Fallback if setting doesn't exist
    SELECT 0.01, 0.05, 0.15, 0.40, 0.80
    LIMIT 1
),
RankedUsers AS (
    SELECT 
        p.wallet_address,
        p.total_xp,
        p.tier_override,
        PERCENT_RANK() OVER (ORDER BY p.total_xp DESC) as percentile
    FROM public.user_profiles p
    WHERE p.total_xp > 0 OR p.tier_override IS NOT NULL
)
SELECT 
    w.w_address as wallet_address,
    COALESCE(up.fid, p.fid) as fid,
    COALESCE(p.display_name, '') as username,
    COALESCE(
        NULLIF(p.display_name, ''),
        '0x' || substring(w.w_address from 3 for 4) || '...' || substring(w.w_address from length(w.w_address)-3)
    ) as display_name, 
    COALESCE(p.pfp_url, '') as pfp_url,
    COALESCE(up.total_xp, 0) as total_xp,
    COALESCE(up.tier, 1) as tier,
    up.referred_by,
    up.last_daily_bonus_claim,
    up.streak_count,
    -- Dynamic Rank Name based on PERCENT_RANK
    CASE 
        WHEN ru.tier_override IS NOT NULL THEN 
            CASE ru.tier_override
                WHEN 5 THEN 'Diamond'
                WHEN 4 THEN 'Platinum'
                WHEN 3 THEN 'Gold'
                WHEN 2 THEN 'Silver'
                WHEN 1 THEN 'Bronze'
                ELSE 'Rookie'
            END
        WHEN ru.percentile <= (SELECT diamond_p FROM Settings) THEN 'Diamond'
        WHEN ru.percentile <= (SELECT platinum_p FROM Settings) THEN 'Platinum'
        WHEN ru.percentile <= (SELECT gold_p FROM Settings) THEN 'Gold'
        WHEN ru.percentile <= (SELECT silver_p FROM Settings) THEN 'Silver'
        WHEN ru.percentile <= (SELECT bronze_p FROM Settings) THEN 'Bronze'
        ELSE 'Rookie'
    END as rank_name,
    ens.full_name as ens_name,
    COALESCE(p.updated_at, up.created_at, ens.created_at) as updated_at
FROM all_wallets w
LEFT JOIN public.profiles p ON w.w_address = LOWER(p.address)
LEFT JOIN public.user_profiles up ON w.w_address = LOWER(up.wallet_address)
LEFT JOIN RankedUsers ru ON w.w_address = ru.wallet_address
LEFT JOIN public.ens_subdomains ens ON w.w_address = LOWER(ens.wallet_address);

-- Grant access
GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;

COMMENT ON VIEW public.v_user_full_profile IS 'Master View with Dynamic Tier Calculation (Diamond-Rookie) based on XP Percentile.';
