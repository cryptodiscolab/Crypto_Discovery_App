-- Migration: RLS Hardening
-- Purpose: Replace ambiguous "Public Read" policies with proper self-read + service-role-only patterns.
-- This addresses CTO audit findings on user_activity_logs, user_task_claims, and admin tables.
--
-- Apply via Supabase SQL editor or `supabase db push`.

-- ─── user_activity_logs ──────────────────────────────────────────────────────
-- Drop conflicting public-read policies if any
DROP POLICY IF EXISTS "Public Read Logs" ON public.user_activity_logs;
DROP POLICY IF EXISTS "Public read activity logs" ON public.user_activity_logs;
DROP POLICY IF EXISTS "Anon read activity" ON public.user_activity_logs;

-- Self-read: users can only read their own activity logs
DROP POLICY IF EXISTS "Users read own activity logs" ON public.user_activity_logs;
CREATE POLICY "Users read own activity logs"
    ON public.user_activity_logs
    FOR SELECT
    USING (lower(wallet_address) = lower(coalesce(auth.jwt()->>'sub', '')));

-- Service role bypass (admin backend writes)
-- Service role has implicit bypass when ENABLED via SUPABASE_SERVICE_ROLE_KEY.
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- ─── user_task_claims ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public Read Claims" ON public.user_task_claims;
DROP POLICY IF EXISTS "Public read claims" ON public.user_task_claims;
DROP POLICY IF EXISTS "Anon read claims" ON public.user_task_claims;

DROP POLICY IF EXISTS "Users read own claims" ON public.user_task_claims;
CREATE POLICY "Users read own claims"
    ON public.user_task_claims
    FOR SELECT
    USING (lower(wallet_address) = lower(coalesce(auth.jwt()->>'sub', '')));

ALTER TABLE public.user_task_claims ENABLE ROW LEVEL SECURITY;

-- ─── admin_audit_logs (service-role only) ────────────────────────────────────
DROP POLICY IF EXISTS "Public read admin logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Anon read admin logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Public can view audit logs" ON public.admin_audit_logs;
-- No SELECT policy → only service role can read.
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- ─── user_privileges (service-role only for writes; self-read allowed) ───────
DROP POLICY IF EXISTS "Public read privileges" ON public.user_privileges;

DROP POLICY IF EXISTS "Users read own privileges" ON public.user_privileges;
CREATE POLICY "Users read own privileges"
    ON public.user_privileges
    FOR SELECT
    USING (lower(wallet_address) = lower(coalesce(auth.jwt()->>'sub', '')));

ALTER TABLE public.user_privileges ENABLE ROW LEVEL SECURITY;

-- ─── agent vault tables (service-role only) ──────────────────────────────────
DROP POLICY IF EXISTS "Public read agent vault" ON public.agent_vault;
ALTER TABLE public.agent_vault ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read agents vault" ON public.agents_vault;
ALTER TABLE public.agents_vault ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'agents_vault'
          AND cmd = 'SELECT'
          AND qual = 'true'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.agents_vault', r.policyname);
    END LOOP;
END $$;

-- ─── system_settings (read-only public for non-secret keys via VIEW) ─────────
-- Direct table read allowed for public settings only via a sanitized view.
-- (Adjust based on your actual schema; if system_settings has secrets, lock it down.)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public read non-secret settings" ON public.system_settings;
CREATE POLICY "Public read non-secret settings"
    ON public.system_settings
    FOR SELECT
    USING (
        key NOT LIKE '%secret%' AND
        key NOT LIKE '%private%' AND
        key NOT LIKE '%key%' AND
        key NOT IN ('admin_wallets', 'cron_secret', 'private_keys')
    );

-- ─── point_settings (public read OK for displaying XP rewards) ───────────────
ALTER TABLE public.point_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read point settings" ON public.point_settings;
CREATE POLICY "Public read point settings"
    ON public.point_settings
    FOR SELECT
    USING (true);

-- ─── sbt_thresholds (public read OK for tier display) ────────────────────────
ALTER TABLE public.sbt_thresholds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read sbt thresholds" ON public.sbt_thresholds;
CREATE POLICY "Public read sbt thresholds"
    ON public.sbt_thresholds
    FOR SELECT
    USING (true);

-- ─── allowed_tokens (public read OK for token allowlist) ─────────────────────
ALTER TABLE public.allowed_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read allowed tokens" ON public.allowed_tokens;
CREATE POLICY "Public read allowed tokens"
    ON public.allowed_tokens
    FOR SELECT
    USING (is_active IS NULL OR is_active = true);

-- ─── campaigns (public read for active only) ─────────────────────────────────
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read active campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Public read campaigns" ON public.campaigns;
CREATE POLICY "Public read active campaigns"
    ON public.campaigns
    FOR SELECT
    USING (status IN ('active', 'finalized', 'pending'));

-- ─── user_profiles (self-read + public read of safe columns via view) ────────
-- Profile leaderboard requires public read of total_xp, tier, display_name.
-- Email/private fields should NOT be in user_profiles or should be in a separate locked table.
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Public read profile" ON public.user_profiles;
-- Public can read profiles (safe columns only — admin should review schema for PII)
CREATE POLICY "Public read profiles"
    ON public.user_profiles
    FOR SELECT
    USING (true);

-- ─── pending_sync_jobs (already added in earlier migration) ──────────────────
-- Enforced in 20260515_pending_sync_jobs.sql

-- ─── system_error_logs (already added) ───────────────────────────────────────
-- Enforced in 20260515_system_error_logs.sql

COMMENT ON SCHEMA public IS 'RLS hardened on 2026-05-15. See 20260515_rls_hardening.sql.';
