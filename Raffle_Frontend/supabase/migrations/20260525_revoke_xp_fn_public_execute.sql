-- Migration: Revoke public EXECUTE on SECURITY DEFINER XP functions
-- Purpose: Resolve Supabase lint warnings:
--   - 0028_anon_security_definer_function_executable
--   - 0029_authenticated_security_definer_function_executable
--
-- Root Cause: Both functions are SECURITY DEFINER (run as postgres/owner), which is
-- correct because they need elevated access to write to user_profiles and user_task_claims.
-- However, Postgres grants EXECUTE to PUBLIC by default on new functions, meaning
-- anon and authenticated roles can call them directly via /rest/v1/rpc/*.
--
-- Fix: REVOKE EXECUTE from anon and authenticated.
-- These functions are EXCLUSIVELY called by the backend (service_role via supabaseAdmin).
-- service_role bypasses permission checks, so no backend functionality is affected.
--
-- Date: 2026-05-25

-- ─── fn_increment_xp ──────────────────────────────────────────────────────────
-- Caller: All API bundles (user-bundle, tasks-bundle, raffle-bundle, audit-bundle)
--         via supabaseAdmin.rpc() = service_role. Never called from frontend.

REVOKE EXECUTE ON FUNCTION public.fn_increment_xp(text, numeric, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_increment_xp(text, numeric, boolean) FROM authenticated;

-- Also revoke from PUBLIC (belt-and-suspenders: prevents future roles from inheriting)
REVOKE EXECUTE ON FUNCTION public.fn_increment_xp(text, numeric, boolean) FROM PUBLIC;

-- Ensure service_role retains EXECUTE (explicit grant)
GRANT EXECUTE ON FUNCTION public.fn_increment_xp(text, numeric, boolean) TO service_role;

-- ─── fn_insert_claim_and_increment_xp ─────────────────────────────────────────
-- Caller: tasks-bundle.ts via supabaseAdmin.rpc() = service_role only.

REVOKE EXECUTE ON FUNCTION public.fn_insert_claim_and_increment_xp(text, text, numeric, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_insert_claim_and_increment_xp(text, text, numeric, text, text, text) FROM authenticated;

-- Also revoke from PUBLIC
REVOKE EXECUTE ON FUNCTION public.fn_insert_claim_and_increment_xp(text, text, numeric, text, text, text) FROM PUBLIC;

-- Ensure service_role retains EXECUTE
GRANT EXECUTE ON FUNCTION public.fn_insert_claim_and_increment_xp(text, text, numeric, text, text, text) TO service_role;

-- ─── Verification query ────────────────────────────────────────────────────────
-- Run after applying to confirm anon/authenticated no longer have EXECUTE:
-- SELECT routine_name, grantee, privilege_type
-- FROM information_schema.role_routine_grants
-- WHERE routine_schema = 'public'
--   AND routine_name IN ('fn_increment_xp', 'fn_insert_claim_and_increment_xp')
-- ORDER BY routine_name, grantee;
-- Expected: Only 'postgres' and 'service_role' should appear.
