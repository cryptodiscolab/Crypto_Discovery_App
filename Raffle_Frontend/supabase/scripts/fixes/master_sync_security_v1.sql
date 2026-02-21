-- ============================================================
-- CRYPTO DISCO APP — MASTER SYNC & SECURITY SCRIPT v1
-- Run this ONCE in Supabase SQL Editor (as postgres / service role)
-- Covers ALL changes from the security audit session (Feb 2026)
-- ============================================================
-- SECTIONS:
--   §1  Clean up old vulnerable policies & triggers
--   §2  Hardened RLS (no x-user-wallet header, all writes blocked)
--   §3  is_admin_wallet() helper function
--   §4  Sync trigger: user_task_claims → user_profiles (XP)
--   §5  Sync trigger: user_profiles → profiles & user_stats
--   §6  FID constraint fix (allow NULL fid in user_stats)
--   §7  Trust score column & auto-calculate trigger
--   §8  Unique FID index (Sybil defense)
--   §9  Verify-action API support (nonce table for replay protection)
--   §10 One-time data backfill (safe, idempotent)
--   §11 Pre-flight verification queries
-- ============================================================


-- ============================================================
-- §1  CLEANUP — Drop old policies & triggers to avoid conflicts
-- ============================================================

-- Old RLS policies (x-user-wallet based — VULNERABLE, removing all)
DROP POLICY IF EXISTS "Public can view profiles"             ON public.user_profiles;
DROP POLICY IF EXISTS "Users can manage own profile"        ON public.user_profiles;
DROP POLICY IF EXISTS "Users can create own profile"        ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile"        ON public.user_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.user_profiles;

DROP POLICY IF EXISTS "Public can view active tasks"        ON public.daily_tasks;
DROP POLICY IF EXISTS "Admin can manage tasks"              ON public.daily_tasks;

DROP POLICY IF EXISTS "Public can view claims"              ON public.user_task_claims;
DROP POLICY IF EXISTS "Users can insert claims"             ON public.user_task_claims;
DROP POLICY IF EXISTS "Users can insert own claims"         ON public.user_task_claims;
DROP POLICY IF EXISTS "Users can view own claims"           ON public.user_task_claims;

-- Old triggers
DROP TRIGGER IF EXISTS on_task_claimed                      ON public.user_task_claims;
DROP TRIGGER IF EXISTS trg_sync_user_data_on_update         ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_calculate_trust_score            ON public.user_profiles;

-- Old functions
DROP FUNCTION IF EXISTS public.sync_user_points();
DROP FUNCTION IF EXISTS public.fn_sync_user_data_propagation();
DROP FUNCTION IF EXISTS public.calculate_trust_score();
DROP FUNCTION IF EXISTS public.is_admin_wallet(TEXT);


-- ============================================================
-- §2  HARDENED RLS POLICIES
--     All client-side writes BLOCKED.
--     API Routes use SERVICE_ROLE_KEY → bypasses RLS safely.
--     Public reads remain open for leaderboard & stats.
-- ============================================================

-- Ensure RLS is enabled on all tables
ALTER TABLE public.user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_task_claims ENABLE ROW LEVEL SECURITY;

-- ── user_profiles ──────────────────────────────────────────
-- ✅ Public read: leaderboard & reputation
CREATE POLICY "Public can view profiles"
    ON public.user_profiles
    FOR SELECT
    USING (true);
-- 🔒 No INSERT / UPDATE / DELETE policy → denied by default

-- ── daily_tasks ────────────────────────────────────────────
-- ✅ Public read: active tasks only
CREATE POLICY "Public can view active tasks"
    ON public.daily_tasks
    FOR SELECT
    USING (is_active = true);
-- 🔒 No write policy → admin writes go through API Route

-- ── user_task_claims ───────────────────────────────────────
-- ✅ Public read: for leaderboard & stats
CREATE POLICY "Public can view claims"
    ON public.user_task_claims
    FOR SELECT
    USING (true);
-- 🔒 No insert policy → claim writes go through /api/verify-action


-- ============================================================
-- §3  ADMIN HELPER FUNCTION
--     Used by API routes for server-side admin checks.
--     SECURITY DEFINER so it runs with elevated privileges.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin_wallet(wallet TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN LOWER(wallet) IN (
        LOWER('0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B'),  -- Primary admin
        LOWER('0x455DF75735d2a18c26f0AfDefa93217B60369fe5')   -- Secondary admin
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_admin_wallet IS
    'Returns true if wallet is an authorized admin. Used by API routes for server-side checks.';


-- ============================================================
-- §3b ADD MISSING COLUMNS (safe, idempotent)
-- ============================================================

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS rank_score INTEGER DEFAULT 0;

-- ============================================================
-- §3c LEADERBOARD TIER COMPUTATION FUNCTION
--     Calculates tiers based on XP percentiles:
--     Gold: Top 10%, Silver: Top 11-30%, Bronze: Top 31-70%
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_compute_leaderboard_tiers()
RETURNS TABLE (
    wallet_address TEXT,
    computed_tier INTEGER -- 1: Bronze, 2: Silver, 3: Gold, 0: None
) AS $$
DECLARE
    total_active_users INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_active_users FROM public.user_profiles WHERE total_xp > 0;
    
    IF total_active_users = 0 THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH RankedUsers AS (
        SELECT 
            p.wallet_address,
            p.total_xp,
            PERCENT_RANK() OVER (ORDER BY p.total_xp DESC) as percentile
        FROM public.user_profiles p
        WHERE p.total_xp > 0
    )
    SELECT 
        ru.wallet_address,
        CASE 
            WHEN ru.percentile <= 0.10 THEN 3 -- GOLD
            WHEN ru.percentile <= 0.30 THEN 2 -- SILVER
            WHEN ru.percentile <= 0.70 THEN 1 -- BRONZE
            ELSE 0 -- NONE
        END as computed_tier
    FROM RankedUsers ru;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update rank_score based on position
CREATE OR REPLACE FUNCTION public.fn_refresh_rank_scores()
RETURNS void AS $$
BEGIN
    WITH NewRanks AS (
        SELECT wallet_address, ROW_NUMBER() OVER (ORDER BY total_xp DESC) as pos
        FROM public.user_profiles
    )
    UPDATE public.user_profiles p
    SET rank_score = nr.pos
    FROM NewRanks nr
    WHERE p.wallet_address = nr.wallet_address;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- §4  SYNC TRIGGER: user_task_claims → user_profiles (XP)
--     Fires after every new claim insert.
--     Recalculates total_xp from all claims for that wallet.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_user_xp_on_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure profile row exists (wallet-only users may not have one yet)
    INSERT INTO public.user_profiles (wallet_address, total_xp, tier)
    VALUES (LOWER(NEW.wallet_address), 0, 1)
    ON CONFLICT (wallet_address) DO NOTHING;

    -- Recalculate total XP from all claims for this wallet
    UPDATE public.user_profiles
    SET
        total_xp   = (
            SELECT COALESCE(SUM(xp_earned), 0)
            FROM public.user_task_claims
            WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address)
        )
    WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address);

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_xp_on_claim
    AFTER INSERT ON public.user_task_claims
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_xp_on_claim();

COMMENT ON FUNCTION public.sync_user_xp_on_claim IS
    'Auto-syncs total_xp in user_profiles whenever a new task claim is inserted.';


-- ============================================================
-- §5  SYNC TRIGGER: user_profiles → profiles & user_stats
--     Keeps legacy tables in sync with the master source of truth.
--     Anchors on wallet_address (not fid) to support non-Farcaster users.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_sync_user_data_propagation()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync to public.profiles (legacy table, uses 'address' column)
    INSERT INTO public.profiles (address, display_name, bio, pfp_url, neynar_score, updated_at)
    VALUES (
        NEW.wallet_address,
        NEW.display_name,
        NEW.bio,
        NEW.pfp_url,
        COALESCE(NEW.neynar_score, 0),
        NOW()
    )
    ON CONFLICT (address) DO UPDATE SET
        display_name  = EXCLUDED.display_name,
        bio           = EXCLUDED.bio,
        pfp_url       = EXCLUDED.pfp_url,
        neynar_score  = EXCLUDED.neynar_score,
        updated_at    = NOW();

    -- Sync to public.user_stats (anchored on wallet_address, fid can be NULL)
    INSERT INTO public.user_stats (wallet_address, fid, total_xp, current_level, last_login_at, created_at)
    VALUES (
        NEW.wallet_address,
        NEW.fid,                                    -- NULL allowed (§6 fix)
        COALESCE(NEW.total_xp, 0),
        COALESCE(NEW.tier, 1),
        COALESCE(NEW.last_login_at, NOW()),
        COALESCE(NEW.created_at, NOW())
    )
    ON CONFLICT (wallet_address) DO UPDATE SET
        fid           = COALESCE(EXCLUDED.fid, public.user_stats.fid),
        total_xp      = EXCLUDED.total_xp,
        current_level = EXCLUDED.current_level,
        last_login_at = EXCLUDED.last_login_at;

    -- Audit log
    INSERT INTO public.admin_audit_logs (admin_address, action, details)
    VALUES (
        'SYSTEM_SYNC',
        'DATA_PROPAGATION',
        jsonb_build_object(
            'target_wallet', NEW.wallet_address,
            'fid',           NEW.fid,
            'total_xp',      NEW.total_xp,
            'timestamp',     NOW()
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_user_data_on_update
    AFTER INSERT OR UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_user_data_propagation();

COMMENT ON FUNCTION public.fn_sync_user_data_propagation IS
    'Propagates user_profiles changes to legacy profiles and user_stats tables.';


-- ============================================================
-- §6  FID CONSTRAINT FIX
--     Allow NULL fid in user_stats (non-Farcaster users).
--     Add unique constraint on wallet_address for reliable upserts.
-- ============================================================

ALTER TABLE public.user_stats ALTER COLUMN fid DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_stats_wallet_address_key'
        AND conrelid = 'public.user_stats'::regclass
    ) THEN
        ALTER TABLE public.user_stats
            ADD CONSTRAINT user_stats_wallet_address_key UNIQUE (wallet_address);
    END IF;
END $$;


-- ============================================================
-- §7  TRUST SCORE — Auto-calculate on profile insert/update
--     Formula: (power_badge ? 50 : 0) + (followers / 10) + (rank_score * 100)
-- ============================================================

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS internal_trust_score FLOAT DEFAULT 0.0;

CREATE OR REPLACE FUNCTION public.calculate_trust_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.internal_trust_score :=
        (CASE WHEN NEW.power_badge = true THEN 50 ELSE 0 END) +
        (COALESCE(NEW.follower_count, 0) / 10.0) +
        (COALESCE(NEW.neynar_score, 0) * 100.0) +
        (CASE WHEN NEW.rank_score > 0 AND NEW.rank_score <= 100 THEN 50 ELSE 0 END); -- Bonus for top 100
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_trust_score
    BEFORE INSERT OR UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_trust_score();

COMMENT ON COLUMN public.user_profiles.internal_trust_score IS
    'Computed reputation score for anti-bot filtering. Auto-updated by trigger.';


-- ============================================================
-- §8  SYBIL DEFENSE — Unique FID index
--     1 Farcaster identity = 1 wallet. NULL fids are allowed (non-FC users).
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_fid
    ON public.user_profiles (fid)
    WHERE (fid IS NOT NULL);

COMMENT ON INDEX public.unique_active_fid IS
    'Prevents one Farcaster identity from farming with multiple wallets.';


-- ============================================================
-- §9  VERIFY-ACTION API SUPPORT
--     Nonce/signature log table for the /api/verify-action route.
--     Prevents replay attacks at the DB level (secondary defense).
--     Primary defense is the 5-minute timestamp window in route.js.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_action_log (
    id              BIGSERIAL PRIMARY KEY,
    wallet_address  TEXT        NOT NULL,
    action          TEXT        NOT NULL,
    msg_timestamp   BIGINT      NOT NULL,   -- Unix timestamp from signed message
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Composite unique: same wallet + same action + same timestamp = replay
    CONSTRAINT uq_action_replay UNIQUE (wallet_address, action, msg_timestamp)
);

-- RLS: Only service role can read/write (API route uses SERVICE_ROLE_KEY)
ALTER TABLE public.api_action_log ENABLE ROW LEVEL SECURITY;
-- No public policies → fully locked to service role

-- Auto-cleanup: delete log entries older than 10 minutes (they're expired anyway)
CREATE OR REPLACE FUNCTION public.cleanup_expired_action_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.api_action_log
    WHERE created_at < NOW() - INTERVAL '10 minutes';
END;
$$;

COMMENT ON TABLE public.api_action_log IS
    'Replay-attack prevention log for /api/verify-action. Entries auto-expire after 10 minutes.';


-- ============================================================
-- §10 ONE-TIME DATA BACKFILL (Safe & Idempotent)
--     Recalculate total_xp for all existing profiles from claims.
--     Run after the trigger is in place.
-- ============================================================

UPDATE public.user_profiles p
SET
    total_xp   = (
        SELECT COALESCE(SUM(xp_earned), 0)
        FROM public.user_task_claims c
        WHERE LOWER(c.wallet_address) = LOWER(p.wallet_address)
    )
WHERE EXISTS (
    SELECT 1 FROM public.user_task_claims c
    WHERE LOWER(c.wallet_address) = LOWER(p.wallet_address)
);


-- ============================================================
-- §11 PRE-FLIGHT VERIFICATION
--     Run these SELECT queries to confirm everything applied.
-- ============================================================

-- Check: RLS policies on the 3 main tables
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_profiles', 'daily_tasks', 'user_task_claims')
ORDER BY tablename, policyname;

-- Check: Active triggers
SELECT trigger_name, event_object_table, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
      'trg_sync_xp_on_claim',
      'trg_sync_user_data_on_update',
      'trg_calculate_trust_score'
  )
ORDER BY event_object_table;

-- Check: api_action_log table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'api_action_log';

-- Check: trust score column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
  AND column_name = 'internal_trust_score';

-- ============================================================
-- ✅ DONE. Expected results:
--   - 3 RLS policies (1 per table, SELECT only)
--   - 3 active triggers
--   - api_action_log table present
--   - internal_trust_score column present
--   - No x-user-wallet policies anywhere
-- ============================================================
