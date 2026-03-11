-- =====================================================================
-- MIGRATION: RAFFLE XP SYNC v1 (CLEAN)
-- Purpose: Wire XP rewards for Raffle Creator, Buyer, Winner into DB
-- Date: 2026-03-11
-- Only references confirmed columns from user_profiles base schema
-- =====================================================================

-- ─── 1. POINT SETTINGS ───────────────────────────────────────────────────────
INSERT INTO public.point_settings (activity_key, points_value, description, is_active)
VALUES 
    ('raffle_create', 500,  'XP for creating a UGC Raffle (one-time per raffle)', true),
    ('raffle_buy',    100,  'XP per ticket purchased (multiplied by quantity)',    true),
    ('raffle_win',    1000, 'XP for winning a raffle and claiming prize',          true),
    ('raffle_ticket', 100,  'Alias for raffle_buy (legacy compat)',                true)
ON CONFLICT (activity_key) DO UPDATE 
    SET description = EXCLUDED.description,
        is_active   = EXCLUDED.is_active;
-- Note: points_value NOT updated on conflict – preserve admin-configured values.

-- ─── 2. ADD RAFFLE COUNTER COLUMNS TO user_profiles ─────────────────────────
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='user_profiles' AND column_name='raffle_wins'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN raffle_wins INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='user_profiles' AND column_name='raffle_tickets_bought'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN raffle_tickets_bought INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='user_profiles' AND column_name='raffles_created'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN raffles_created INTEGER DEFAULT 0;
    END IF;

    -- Optional: display_name and pfp_url (may already exist from other migrations)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='user_profiles' AND column_name='display_name'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN display_name TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='user_profiles' AND column_name='pfp_url'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN pfp_url TEXT;
    END IF;
END $$;

-- ─── 3. RPC: Increment raffle_wins ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_increment_raffle_wins(p_wallet TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_profiles
    SET raffle_wins = COALESCE(raffle_wins, 0) + 1,
        last_seen_at = NOW()
    WHERE LOWER(wallet_address) = LOWER(p_wallet);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 4. RPC: Increment raffle_tickets_bought ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_increment_raffle_tickets(p_wallet TEXT, p_amount INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_profiles
    SET raffle_tickets_bought = COALESCE(raffle_tickets_bought, 0) + p_amount,
        last_seen_at = NOW()
    WHERE LOWER(wallet_address) = LOWER(p_wallet);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. RPC: Increment raffles_created ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_increment_raffles_created(p_wallet TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_profiles
    SET raffles_created = COALESCE(raffles_created, 0) + 1,
        last_seen_at = NOW()
    WHERE LOWER(wallet_address) = LOWER(p_wallet);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 6. XP AUTO-SYNC TRIGGER (fires on every user_task_claims INSERT) ────────
CREATE OR REPLACE FUNCTION public.sync_user_xp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
BEGIN
    -- Ensure profile row exists first
    INSERT INTO public.user_profiles (wallet_address, total_xp, tier)
    VALUES (LOWER(NEW.wallet_address), 0, 1)
    ON CONFLICT (wallet_address) DO NOTHING;

    -- Recalculate total_xp as sum of all claims (ground truth)
    UPDATE public.user_profiles
    SET total_xp     = (
            SELECT COALESCE(SUM(xp_earned), 0)
            FROM public.user_task_claims
            WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address)
        ),
        last_seen_at = NOW()
    WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address);
    
    RETURN NEW;
END;
$$;

-- ─── 7. ATTACH TRIGGER ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_xp_on_claim ON public.user_task_claims;
CREATE TRIGGER trg_sync_xp_on_claim
    AFTER INSERT OR UPDATE ON public.user_task_claims
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_xp();

-- ─── 8. v_user_full_profile VIEW ─────────────────────────────────────────────
-- Uses ONLY confirmed columns. No references to last_daily_bonus_claim,
-- streak_count, tier_override, or public.profiles.
DROP VIEW IF EXISTS public.v_user_full_profile;

CREATE VIEW public.v_user_full_profile
WITH (security_invoker = true)
AS
WITH all_wallets AS (
    SELECT LOWER(wallet_address) AS w_address FROM public.user_profiles
    UNION
    SELECT LOWER(wallet_address) FROM public.ens_subdomains
),
tier_settings AS (
    SELECT 
        COALESCE((value->>'diamond')::FLOAT, 0.01)  AS diamond_p,
        COALESCE((value->>'platinum')::FLOAT, 0.05) AS platinum_p,
        COALESCE((value->>'gold')::FLOAT, 0.15)     AS gold_p,
        COALESCE((value->>'silver')::FLOAT, 0.40)   AS silver_p,
        COALESCE((value->>'bronze')::FLOAT, 0.80)   AS bronze_p
    FROM public.system_settings 
    WHERE key = 'tier_percentiles'
    UNION ALL
    -- Fallback defaults
    SELECT 0.01, 0.05, 0.15, 0.40, 0.80
    LIMIT 1
),
ranked AS (
    SELECT 
        wallet_address,
        total_xp,
        PERCENT_RANK() OVER (ORDER BY total_xp DESC) AS pct
    FROM public.user_profiles
    WHERE total_xp > 0
)
SELECT
    w.w_address                                                                      AS wallet_address,
    up.fid,
    COALESCE(up.display_name, '')                                                    AS username,
    COALESCE(
        NULLIF(up.display_name, ''),
        '0x' || substring(w.w_address FROM 3 FOR 4) || '...' ||
        substring(w.w_address FROM length(w.w_address)-3)
    )                                                                                AS display_name,
    COALESCE(up.pfp_url, '')                                                         AS pfp_url,
    COALESCE(up.total_xp, 0)                                                         AS total_xp,
    COALESCE(up.tier, 1)                                                             AS tier,
    COALESCE(up.raffle_wins, 0)                                                      AS raffle_wins,
    COALESCE(up.raffle_tickets_bought, 0)                                            AS raffle_tickets_bought,
    COALESCE(up.raffles_created, 0)                                                  AS raffles_created,
    up.updated_at,
    ens.full_name                                                                    AS ens_name,
    CASE
        WHEN r.pct <= (SELECT diamond_p  FROM tier_settings) THEN 'Diamond'
        WHEN r.pct <= (SELECT platinum_p FROM tier_settings) THEN 'Platinum'
        WHEN r.pct <= (SELECT gold_p     FROM tier_settings) THEN 'Gold'
        WHEN r.pct <= (SELECT silver_p   FROM tier_settings) THEN 'Silver'
        WHEN r.pct <= (SELECT bronze_p   FROM tier_settings) THEN 'Bronze'
        ELSE 'Rookie'
    END                                                                              AS rank_name
FROM all_wallets w
LEFT JOIN public.user_profiles   up  ON w.w_address = LOWER(up.wallet_address)
LEFT JOIN ranked                 r   ON w.w_address = LOWER(r.wallet_address)
LEFT JOIN public.ens_subdomains  ens ON w.w_address = LOWER(ens.wallet_address);

GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;

COMMENT ON VIEW public.v_user_full_profile IS
'Master View: Percentile-based Dynamic Tier + Raffle Stats. SECURITY INVOKER.';

-- ─── 9. LEADERBOARD HELPER RPC ───────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.fn_get_leaderboard(INTEGER, TEXT);

CREATE FUNCTION public.fn_get_leaderboard(
    p_limit INTEGER DEFAULT 100,
    p_tier  TEXT    DEFAULT NULL
)
RETURNS TABLE (
    wallet_address TEXT,
    display_name   TEXT,
    pfp_url        TEXT,
    total_xp       BIGINT,
    rank_name      TEXT,
    raffle_wins    INTEGER,
    raffles_created INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.wallet_address,
        v.display_name,
        v.pfp_url,
        v.total_xp::BIGINT,
        v.rank_name,
        v.raffle_wins::INTEGER,
        v.raffles_created::INTEGER
    FROM public.v_user_full_profile v
    WHERE (p_tier IS NULL OR p_tier = 'All' OR v.rank_name = p_tier)
    ORDER BY v.total_xp DESC
    LIMIT p_limit;
END;
$$;

-- =====================================================================
-- ✅ point_settings: raffle_create/buy/win/ticket keys seeded
-- ✅ user_profiles: raffle_wins, raffle_tickets_bought, raffles_created added
-- ✅ RPCs: fn_increment_raffle_wins/tickets/raffles_created
-- ✅ TRIGGER trg_sync_xp_on_claim: auto-recalculates total_xp
-- ✅ v_user_full_profile: SECURITY INVOKER, no phantom columns
-- ✅ fn_get_leaderboard: filterable by tier, ordered by XP
-- =====================================================================
