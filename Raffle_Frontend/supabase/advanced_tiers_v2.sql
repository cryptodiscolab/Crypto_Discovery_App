-- ============================================================
-- CRYPTO DISCO APP — ADVANCED TIER MANAGEMENT v2
-- ============================================================

-- 1. Create System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key          TEXT        PRIMARY KEY,
    value        JSONB       NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initialize default percentiles
INSERT INTO public.system_settings (key, value)
VALUES 
    ('tier_percentiles', '{"gold": 0.10, "silver": 0.30, "bronze": 0.70}')
ON CONFLICT (key) DO NOTHING;

-- 2. Add Tier Override Column to User Profiles
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS tier_override INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.user_profiles.tier_override IS
    'Manual tier override. If NULL, tier is calculated by rank. (0: None, 1: Bronze, 2: Silver, 3: Gold)';

-- 3. Enhanced Leaderboard Tier Computation
--    Respects manual overrides and dynamic percentiles from system_settings.
CREATE OR REPLACE FUNCTION public.fn_compute_leaderboard_tiers()
RETURNS TABLE (
    wallet_address TEXT,
    computed_tier INTEGER -- 1: Bronze, 2: Silver, 3: Gold, 0: None
) AS $$
DECLARE
    gold_p FLOAT;
    silver_p FLOAT;
    bronze_p FLOAT;
    settings JSONB;
BEGIN
    -- Fetch current settings
    SELECT value INTO settings FROM public.system_settings WHERE key = 'tier_percentiles';
    gold_p   := COALESCE((settings->>'gold')::FLOAT, 0.10);
    silver_p := COALESCE((settings->>'silver')::FLOAT, 0.30);
    bronze_p := COALESCE((settings->>'bronze')::FLOAT, 0.70);

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
            WHEN ru.percentile <= gold_p   THEN 3 -- GOLD
            WHEN ru.percentile <= silver_p THEN 2 -- SILVER
            WHEN ru.percentile <= bronze_p THEN 1 -- BRONZE
            ELSE 0 -- NONE
        END::INTEGER as computed_tier
    FROM RankedUsers ru;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Refresh Rank Scores
--    Updates the cached rank_score for fast UI display.
CREATE OR REPLACE FUNCTION public.fn_refresh_rank_scores()
RETURNS void AS $$
BEGIN
    UPDATE public.user_profiles p
    SET rank_score = sub.new_rank
    FROM (
        SELECT 
            wallet_address,
            (PERCENT_RANK() OVER (ORDER BY total_xp DESC) * 1000)::INTEGER as new_rank
        FROM public.user_profiles
        WHERE total_xp > 0
    ) sub
    WHERE p.wallet_address = sub.wallet_address;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
