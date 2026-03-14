-- ============================================================
-- CRYPTO DISCO APP — ECOSYSTEM SYNC V2.3 (COLUMN HARDENING)
-- Purpose: 
-- 1. Ensure all columns for v_user_full_profile exist in user_profiles
-- 2. Align Tier Indexing (0-5)
-- 3. Unified View (Robust)
-- ============================================================

-- 1. Column Hardening (Defensive)
DO $$ 
BEGIN 
    -- Foundation
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='total_xp') THEN
        ALTER TABLE public.user_profiles ADD COLUMN total_xp BIGINT DEFAULT 0;
    END IF;

    -- Identity & Social
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='username') THEN
        ALTER TABLE public.user_profiles ADD COLUMN username TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='display_name') THEN
        ALTER TABLE public.user_profiles ADD COLUMN display_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='pfp_url') THEN
        ALTER TABLE public.user_profiles ADD COLUMN pfp_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='bio') THEN
        ALTER TABLE public.user_profiles ADD COLUMN bio TEXT;
    END IF;

    -- Tiering
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='tier') THEN
        ALTER TABLE public.user_profiles ADD COLUMN tier INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='tier_override') THEN
        ALTER TABLE public.user_profiles ADD COLUMN tier_override INTEGER;
    END IF;

    -- Stats & Metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='streak_count') THEN
        ALTER TABLE public.user_profiles ADD COLUMN streak_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='last_daily_bonus_claim') THEN
        ALTER TABLE public.user_profiles ADD COLUMN last_daily_bonus_claim TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='referred_by') THEN
        ALTER TABLE public.user_profiles ADD COLUMN referred_by TEXT;
    END IF;

    -- Security
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='is_admin') THEN
        ALTER TABLE public.user_profiles ADD COLUMN is_admin BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='is_operator') THEN
        ALTER TABLE public.user_profiles ADD COLUMN is_operator BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Defaults Alignment
ALTER TABLE public.user_profiles ALTER COLUMN tier SET DEFAULT 0;

-- 3. Hardened Admin Helper
CREATE OR REPLACE FUNCTION public.is_admin_wallet(wallet TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE LOWER(wallet_address) = LOWER(wallet) 
        AND (is_admin = true OR is_operator = true)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Unified Tier Computation Function (1-5 Mapping)
CREATE OR REPLACE FUNCTION public.fn_compute_leaderboard_tiers()
RETURNS TABLE (
    wallet_address TEXT,
    computed_tier INTEGER 
) AS $$
DECLARE
    diamond_p FLOAT;
    platinum_p FLOAT;
    gold_p FLOAT;
    silver_p FLOAT;
    bronze_p FLOAT;
BEGIN
    SELECT 
        COALESCE((value->>'diamond')::FLOAT, 0.01),
        COALESCE((value->>'platinum')::FLOAT, 0.05),
        COALESCE((value->>'gold')::FLOAT, 0.15),
        COALESCE((value->>'silver')::FLOAT, 0.40),
        COALESCE((value->>'bronze')::FLOAT, 0.80)
    INTO diamond_p, platinum_p, gold_p, silver_p, bronze_p
    FROM public.system_settings 
    WHERE key = 'tier_percentiles';

    IF diamond_p IS NULL THEN
        diamond_p := 0.01; platinum_p := 0.05; gold_p := 0.15; silver_p := 0.40; bronze_p := 0.80;
    END IF;

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
            WHEN ru.tier_override IS NOT NULL THEN ru.tier_override::INTEGER
            WHEN ru.percentile <= diamond_p THEN 5 -- DIAMOND
            WHEN ru.percentile <= platinum_p THEN 4 -- PLATINUM
            WHEN ru.percentile <= gold_p THEN 3 -- GOLD
            WHEN ru.percentile <= silver_p THEN 2 -- SILVER
            WHEN ru.percentile <= bronze_p THEN 1 -- BRONZE
            ELSE 0 -- ROOKIE
        END::INTEGER as computed_tier
    FROM RankedUsers ru;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Sync Trigger Update
CREATE OR REPLACE FUNCTION public.sync_user_xp_on_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_profiles (wallet_address, total_xp, tier)
    VALUES (LOWER(NEW.wallet_address), 0, 0)
    ON CONFLICT (wallet_address) DO NOTHING;

    UPDATE public.user_profiles
    SET
        total_xp = (
            SELECT COALESCE(SUM(xp_earned), 0)
            FROM public.user_task_claims
            WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address)
        )
    WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address);

    RETURN NEW;
END;
$$;

-- 6. REFRESH MASTER VIEW
DROP VIEW IF EXISTS public.v_user_full_profile CASCADE;
CREATE OR REPLACE VIEW public.v_user_full_profile AS
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

-- 7. Legacy Support
DROP VIEW IF EXISTS public.user_stats CASCADE;
CREATE OR REPLACE VIEW public.user_stats AS SELECT * FROM public.v_user_full_profile;

-- 8. Seasonal Reset Logic
CREATE OR REPLACE FUNCTION public.fn_archive_and_reset_season(
    p_old_season_id INT,
    p_new_season_id INT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.user_season_history (wallet_address, season_id, final_tier, xp_at_reset)
    SELECT wallet_address, p_old_season_id, tier, total_xp
    FROM public.user_profiles
    WHERE tier > 0 OR total_xp > 0
    ON CONFLICT (wallet_address, season_id) DO UPDATE SET 
        final_tier = EXCLUDED.final_tier,
        xp_at_reset = EXCLUDED.xp_at_reset;

    UPDATE public.user_profiles SET tier = 0;

    UPDATE public.seasons SET is_active = false, ended_at = NOW() WHERE season_id = p_old_season_id;
    INSERT INTO public.seasons (season_id, name, is_active, started_at)
    VALUES (p_new_season_id, 'Season ' || p_new_season_id, true, NOW())
    ON CONFLICT (season_id) DO UPDATE SET is_active = true, started_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;
GRANT SELECT ON public.user_stats TO anon, authenticated;
