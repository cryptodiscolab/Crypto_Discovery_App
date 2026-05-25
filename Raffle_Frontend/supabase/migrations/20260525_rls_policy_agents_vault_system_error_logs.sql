-- Migration: RLS Policy Completion for agents_vault & system_error_logs
-- Purpose: Resolve Supabase lint warning "rls_enabled_no_policy".
-- Both tables are INTENTIONALLY service-role-only.
-- Adding a deny-all policy makes the intent explicit and self-documenting.
-- Service role continues to bypass RLS implicitly via SUPABASE_SERVICE_ROLE_KEY.
-- Date: 2026-05-25

-- ─── agents_vault ─────────────────────────────────────────────────────────────
-- Design: Internal AI agent task queue. No public or authenticated user access.
-- Reads/writes go through admin-bundle (service role) and orchestrator scripts only.

-- Drop any lingering policy (idempotent safety)
DROP POLICY IF EXISTS "agents_vault_deny_all" ON public.agents_vault;
DROP POLICY IF EXISTS "No public access agents_vault" ON public.agents_vault;

-- Explicit deny-all for non-service-role principals
-- (service_role bypasses RLS by default — this policy only covers anon/authenticated roles)
CREATE POLICY "agents_vault_deny_all"
    ON public.agents_vault
    AS RESTRICTIVE
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

-- ─── system_error_logs ────────────────────────────────────────────────────────
-- Design: Sanitized backend error/incident log. Admin reads via admin-bundle endpoint only.
-- No direct client-side access permitted (not even authenticated users).

-- Drop any lingering policy (idempotent safety)
DROP POLICY IF EXISTS "system_error_logs_deny_all" ON public.system_error_logs;
DROP POLICY IF EXISTS "No public access system_error_logs" ON public.system_error_logs;

-- Explicit deny-all for non-service-role principals
CREATE POLICY "system_error_logs_deny_all"
    ON public.system_error_logs
    AS RESTRICTIVE
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

COMMENT ON POLICY "agents_vault_deny_all" ON public.agents_vault
    IS 'Explicit deny-all RLS policy. Access is service-role-only via admin-bundle and orchestrator scripts. Resolves lint: rls_enabled_no_policy.';

COMMENT ON POLICY "system_error_logs_deny_all" ON public.system_error_logs
    IS 'Explicit deny-all RLS policy. Admin reads go through admin-bundle GET_ERROR_LOGS endpoint (service role). Resolves lint: rls_enabled_no_policy.';
