-- ============================================================
-- CRYPTO DISCO APP — DIAMOND TIER UPGRADE v3
-- ============================================================

-- 1. Update default percentiles in System Settings
INSERT INTO public.system_settings (key, value)
VALUES 
    ('tier_percentiles', '{"diamond": 0.01, "gold": 0.10, "silver": 0.30, "bronze": 0.70}')
ON CONFLICT (key) DO UPDATE 
SET value = public.system_settings.value || '{"diamond": 0.01}'::jsonb;

-- 2. Enhanced Leaderboard Tier Computation (Diamond Edition)
--    0: None, 1: Bronze, 2: Silver, 3: Gold, 4: Diamond
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
    -- Fetch current settings
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
            p.tier_override,
            PERCENT_RANK() OVER (ORDER BY p.total_xp DESC) as percentile
        FROM public.user_profiles p
        WHERE p.total_xp > 0 OR p.tier_override IS NOT NULL
    )
    SELECT 
        ru.wallet_address,
        CASE 
            WHEN ru.tier_override IS NOT NULL THEN ru.tier_override
            WHEN ru.percentile <= diamond_p THEN 4 -- DIAMOND
            WHEN ru.percentile <= gold_p    THEN 3 -- GOLD
            WHEN ru.percentile <= silver_p  THEN 2 -- SILVER
            WHEN ru.percentile <= bronze_p  THEN 1 -- BRONZE
            ELSE 0 -- NONE
        END::INTEGER as computed_tier
    FROM RankedUsers ru;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Distribution Statistics Helper
CREATE OR REPLACE FUNCTION public.fn_get_tier_distribution()
RETURNS TABLE (
    tier_label TEXT,
    user_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE t.computed_tier
            WHEN 4 THEN 'DIAMOND'
            WHEN 3 THEN 'GOLD'
            WHEN 2 THEN 'SILVER'
            WHEN 1 THEN 'BRONZE'
            ELSE 'NONE'
        END as tier_label,
        COUNT(*) as user_count
    FROM (SELECT computed_tier FROM public.fn_compute_leaderboard_tiers()) t
    GROUP BY t.computed_tier
    ORDER BY t.computed_tier DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
