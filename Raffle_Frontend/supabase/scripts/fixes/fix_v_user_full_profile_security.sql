-- SECURITY HARDENING: Re-define v_user_full_profile and user_stats as SECURITY INVOKER
-- This ensures the views respect Row Level Security (RLS) policies of the querying user.

-- Use CASCADE to ensure dependent views (like user_stats) are handled
DROP VIEW IF EXISTS public.v_user_full_profile CASCADE;

CREATE OR REPLACE VIEW public.v_user_full_profile 
WITH (security_invoker = true)
AS
WITH Settings AS (
    SELECT 
        COALESCE((value->>'diamond')::FLOAT, 0.01) as diamond_p,
        COALESCE((value->>'platinum')::FLOAT, 0.05) as platinum_p,
        COALESCE((value->>'gold')::FLOAT, 0.15) as gold_p,
        COALESCE((value->>'silver')::FLOAT, 0.40) as silver_p,
        COALESCE((value->>'bronze')::FLOAT, 0.80) as bronze_p
    FROM public.system_settings 
    WHERE key = 'tier_percentiles'
    UNION ALL
    SELECT 0.01, 0.05, 0.15, 0.40, 0.80
    LIMIT 1
),
RankedUsers AS (
    SELECT 
        p.wallet_address,
        p.total_xp,
        p.tier,
        p.tier_override,
        PERCENT_RANK() OVER (ORDER BY p.total_xp DESC) as percentile
    FROM public.user_profiles p
    WHERE p.total_xp > 0 OR p.tier_override IS NOT NULL OR p.tier > 0
)
SELECT 
    up.wallet_address,
    up.fid,
    COALESCE(up.username, up.display_name, 'User ' || substring(up.wallet_address from 3 for 6)) as username,
    COALESCE(
        NULLIF(up.display_name, ''),
        '0x' || substring(up.wallet_address from 3 for 4) || '...' || substring(up.wallet_address from length(up.wallet_address)-3)
    ) as display_name, 
    COALESCE(up.pfp_url, '') as pfp_url,
    COALESCE(up.total_xp, 0) as total_xp,
    COALESCE(up.tier, 0) as tier,
    up.referred_by,
    up.last_daily_bonus_claim,
    up.streak_count,
    CASE 
        WHEN COALESCE(up.tier_override, up.tier) > 0 THEN 
            CASE COALESCE(up.tier_override, up.tier)
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
    up.created_at as updated_at,
    up.is_admin,
    up.is_operator
FROM public.user_profiles up
LEFT JOIN RankedUsers ru ON up.wallet_address = ru.wallet_address;

-- Re-create the dependent view user_stats as an alias with SECURITY INVOKER
CREATE OR REPLACE VIEW public.user_stats 
WITH (security_invoker = true)
AS SELECT * FROM public.v_user_full_profile;

-- Grant access
GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;
GRANT SELECT ON public.user_stats TO anon, authenticated;

COMMENT ON VIEW public.v_user_full_profile IS 'Master View with Dynamic Tier Calculation (Diamond-Rookie) based on XP Percentile. (SECURITY INVOKER)';
COMMENT ON VIEW public.user_stats IS 'Legacy alias for v_user_full_profile. (SECURITY INVOKER)';
