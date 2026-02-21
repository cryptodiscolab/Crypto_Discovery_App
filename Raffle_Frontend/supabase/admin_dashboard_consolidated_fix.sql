-- ============================================================
-- ADMIN DASHBOARD CONSOLIDATED FIXES & HARMONIZATION
-- ============================================================

-- 1. Ensure 'user_profiles' has consistent columns
DO $$ 
BEGIN 
    -- Ensure 'xp' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='xp') THEN
        ALTER TABLE public.user_profiles ADD COLUMN xp BIGINT DEFAULT 0;
    END IF;

    -- Ensure 'total_xp' exists (as a shadow or primary)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='total_xp') THEN
        ALTER TABLE public.user_profiles ADD COLUMN total_xp BIGINT DEFAULT 0;
    END IF;

    -- Sync them if one is zero and the other isn't
    UPDATE public.user_profiles SET xp = total_xp WHERE xp = 0 AND total_xp > 0;
    UPDATE public.user_profiles SET total_xp = xp WHERE total_xp = 0 AND xp > 0;

    -- Ensure other admin columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='is_admin') THEN
        ALTER TABLE public.user_profiles ADD COLUMN is_admin BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='is_operator') THEN
        ALTER TABLE public.user_profiles ADD COLUMN is_operator BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='trust_score') THEN
        ALTER TABLE public.user_profiles ADD COLUMN trust_score INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. Master View: v_user_full_profile (The Source of Truth)
DROP VIEW IF EXISTS public.v_user_full_profile CASCADE;

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
    up.fid,
    COALESCE(p.display_name, 'User ' || substring(w.w_address from 3 for 6)) as username,
    COALESCE(
        NULLIF(p.display_name, ''), 
        ens.full_name,
        '0x' || substring(w.w_address from 3 for 4) || '...' || substring(w.w_address from length(w.w_address)-3)
    ) as display_name, 
    p.bio,
    p.pfp_url,
    COALESCE(p.neynar_score, 0) as neynar_score,
    COALESCE(up.xp, 0) as xp,
    COALESCE(up.xp, 0) as total_xp, -- Alias for backward compatibility
    COALESCE(up.tier, 1) as tier,
    up.tier_override,
    COALESCE(up.trust_score, 0) as trust_score,
    CASE 
        WHEN COALESCE(up.xp, 0) >= 10000 THEN 'Gold'
        WHEN COALESCE(up.xp, 0) >= 5000 THEN 'Silver'
        WHEN COALESCE(up.xp, 0) >= 1000 THEN 'Bronze'
        ELSE 'Rookie'
    END as rank_name,
    ens.full_name as ens_name,
    COALESCE(p.updated_at, up.created_at, ens.created_at) as updated_at
FROM all_wallets w
LEFT JOIN public.profiles p ON w.w_address = LOWER(p.address)
LEFT JOIN public.user_profiles up ON w.w_address = LOWER(up.wallet_address)
LEFT JOIN public.ens_subdomains ens ON w.w_address = LOWER(ens.wallet_address);

GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;

-- 3. Legacy Wrapper: user_stats (Fixes AdminSystemSettings and others)
-- We drop it as a table first because it might exist as a legacy physical table (Error 42809)
DROP TABLE IF EXISTS public.user_stats CASCADE;
DROP VIEW IF EXISTS public.user_stats CASCADE;

CREATE OR REPLACE VIEW public.user_stats AS
SELECT * FROM public.v_user_full_profile;

GRANT SELECT ON public.user_stats TO anon, authenticated;

-- 4. RPC Functions for Admin Analytics
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
            p.xp,
            p.tier_override,
            PERCENT_RANK() OVER (ORDER BY p.xp DESC) as percentile
        FROM public.user_profiles p
        WHERE p.xp > 0 OR p.tier_override IS NOT NULL
    )
    SELECT 
        ru.wallet_address,
        CASE 
            WHEN ru.tier_override IS NOT NULL THEN ru.tier_override::INTEGER
            WHEN ru.percentile <= diamond_p THEN 4 -- DIAMOND
            WHEN ru.percentile <= gold_p    THEN 3 -- GOLD
            WHEN ru.percentile <= silver_p  THEN 2 -- SILVER
            WHEN ru.percentile <= bronze_p  THEN 1 -- BRONZE
            ELSE 0 -- NONE
        END::INTEGER as computed_tier
    FROM RankedUsers ru;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- 5. Helper to Sync total_xp if a tool updates just 'xp'
CREATE OR REPLACE FUNCTION public.trg_sync_total_xp_shadow()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_xp = NEW.xp;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_total_xp ON public.user_profiles;
CREATE TRIGGER trg_sync_total_xp
BEFORE INSERT OR UPDATE OF xp ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_total_xp_shadow();
