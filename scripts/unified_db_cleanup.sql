-- ============================================
-- SQL UNIFICATION: DROPPING LEGACY TABLES
-- Removes `user_stats`, `profiles`, and sync triggers.
-- ============================================

-- 1. Drop Legacy Triggers and Functions
DROP TRIGGER IF EXISTS trg_sync_user_data_on_update ON public.user_profiles;
DROP FUNCTION IF EXISTS public.fn_sync_user_data_propagation();

-- 2. Ensure v_user_full_profile is detached from user_stats
DROP VIEW IF EXISTS public.v_user_full_profile CASCADE;

CREATE OR REPLACE VIEW public.v_user_full_profile AS
SELECT
    up.wallet_address,
    COALESCE(up.display_name, up.username, up.wallet_address) as display_name,
    up.bio,
    up.pfp_url,
    up.username,
    up.fid,
    up.follower_count,
    up.following_count,
    up.neynar_score,
    up.verifications,
    up.active_status,
    up.power_badge,
    up.streak_count,
    COALESCE(up.total_xp, 0) as total_xp,
    (
        SELECT level 
        FROM public.sbt_thresholds st 
        WHERE st.min_xp <= COALESCE(up.total_xp, 0)
        ORDER BY st.min_xp DESC 
        LIMIT 1
    ) as current_level,
    (
        SELECT tier_name 
        FROM public.sbt_thresholds st 
        WHERE st.min_xp <= COALESCE(up.total_xp, 0)
        ORDER BY st.min_xp DESC 
        LIMIT 1
    ) as rank_name
FROM public.user_profiles up;

-- 3. Safely Drop Legacy Tables
-- We use CASCADE in case there are other forgotten foreign keys or views attached
DROP TABLE IF EXISTS public.user_stats CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ✅ Database Cleaned and Unified.
