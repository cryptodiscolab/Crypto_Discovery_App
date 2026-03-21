-- ========================================================
-- SECURITY REMEDIATION: Harden Function Search Path
-- ========================================================
-- Resolves Supabase Linter WARN: function_search_path_mutable
-- Includes defense-in-depth hardening for SECURITY DEFINER functions.

-- Requested Fix
ALTER FUNCTION public.get_auth_wallet() SET search_path = public, auth;

-- Security Definer Hardening (Precise Signatures)
ALTER FUNCTION public.fn_deactivate_expired_tasks() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.fn_refresh_rank_scores() SET search_path = public;
ALTER FUNCTION public.fn_increment_user_xp(text, integer) SET search_path = public;
ALTER FUNCTION public.fn_get_tier_distribution() SET search_path = public;
ALTER FUNCTION public.fn_increment_raffle_wins(text) SET search_path = public;
ALTER FUNCTION public.is_admin_wallet(text) SET search_path = public;
ALTER FUNCTION public.fn_award_referral_bonus() SET search_path = public;
ALTER FUNCTION public.fn_increment_raffle_tickets(text, integer) SET search_path = public;
ALTER FUNCTION public.fn_increment_raffles_created(text) SET search_path = public;
ALTER FUNCTION public.rls_auto_enable() SET search_path = public;
ALTER FUNCTION public.fn_compute_leaderboard_tiers() SET search_path = public;
ALTER FUNCTION public.sync_user_xp_on_claim() SET search_path = public;
ALTER FUNCTION public.fn_archive_and_reset_season(integer, integer) SET search_path = public;

-- PostgREST Cache Clear
NOTIFY pgrst, 'reload schema';
