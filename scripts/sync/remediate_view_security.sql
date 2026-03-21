-- ========================================================
-- SECURITY REMEDIATION: Transition Views to SECURITY INVOKER
-- ========================================================
-- Resolves Supabase Linter ERROR: security_definer_view
-- Ensures views respect RLS policies of the querying user.

-- 1. Drop existing views to handle security property changes cleanly
DROP VIEW IF EXISTS public.v_leaderboard CASCADE;
DROP VIEW IF EXISTS public.user_stats CASCADE;
DROP VIEW IF EXISTS public.v_user_full_profile CASCADE;

-- 2. Redefine v_user_full_profile (Canonical Profile View)
CREATE OR REPLACE VIEW public.v_user_full_profile 
WITH (security_invoker = true)
AS
SELECT u.wallet_address,
    u.fid,
    u.username,
    u.display_name,
    u.pfp_url,
    (u.total_xp + COALESCE(u.manual_xp_bonus, (0)::bigint)) AS total_xp,
    u.tier,
    u.referred_by,
    u.last_daily_bonus_claim,
    u.streak_count,
    u.raffle_wins,
    u.raffle_tickets_bought,
    u.raffles_created,
    COALESCE(t.tier_name, 'Rookie'::text) AS rank_name,
    u.updated_at,
    u.is_admin,
    u.is_operator,
    u.google_id,
    u.google_email,
    u.twitter_id,
    u.twitter_username,
    u.oauth_provider,
    u.neynar_score,
    u.verifications,
    u.power_badge,
    u.follower_count,
    u.following_count,
    u.bio,
    u.active_status,
    u.last_seen_at
   FROM (public.user_profiles u
     LEFT JOIN public.sbt_thresholds t ON ((u.tier = t.level)));

-- 3. Redefine user_stats (Simplified stats view)
CREATE OR REPLACE VIEW public.user_stats 
WITH (security_invoker = true)
AS
SELECT wallet_address,
    fid,
    username,
    display_name,
    pfp_url,
    total_xp,
    tier,
    referred_by,
    last_daily_bonus_claim,
    streak_count,
    rank_name,
    updated_at,
    is_admin,
    is_operator
   FROM public.v_user_full_profile;

-- 4. Redefine v_leaderboard (Global Ranking View)
CREATE OR REPLACE VIEW public.v_leaderboard 
WITH (security_invoker = true)
AS
SELECT wallet_address,
    username,
    display_name,
    pfp_url,
    total_xp,
    rank_name,
    tier,
    streak_count,
    rank() OVER (ORDER BY total_xp DESC) AS global_rank
   FROM public.v_user_full_profile
  ORDER BY total_xp DESC;

-- 5. Restore Permissions
GRANT SELECT ON public.v_user_full_profile TO anon, authenticated, service_role;
GRANT SELECT ON public.user_stats TO anon, authenticated, service_role;
GRANT SELECT ON public.v_leaderboard TO anon, authenticated, service_role;

-- 6. Reload PostgREST Cache
NOTIFY pgrst, 'reload schema';

COMMIT;
