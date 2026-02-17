-- ========================================================
-- CRYPTO DISCO APP - USER DATA CONSOLIDATION & SYNC
-- ========================================================
-- Purpose: Sync user_profiles (Source of Truth) to legacy tables
-- (profiles & user_stats) to prevent crashes while cleaning up redundancy.

-- 1. Create Sync Trigger Function
CREATE OR REPLACE FUNCTION public.fn_sync_user_data_propagation()
RETURNS TRIGGER AS $$
BEGIN
    -- SYNC TO: public.profiles
    -- Profiles uses 'address' instead of 'wallet_address'
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
        display_name = EXCLUDED.display_name,
        bio = EXCLUDED.bio,
        pfp_url = EXCLUDED.pfp_url,
        neynar_score = EXCLUDED.neynar_score,
        updated_at = NOW();

    -- SYNC TO: public.user_stats
    -- user_stats uses 'wallet_address' and 'total_xp'
    INSERT INTO public.user_stats (wallet_address, fid, total_xp, current_level, last_login_at, created_at)
    VALUES (
        NEW.wallet_address,
        NEW.fid,
        COALESCE(NEW.xp, 0),
        COALESCE(NEW.tier, 1),
        COALESCE(NEW.last_login_at, NOW()),
        COALESCE(NEW.created_at, NOW())
    )
    ON CONFLICT (wallet_address) DO UPDATE SET
        fid = COALESCE(EXCLUDED.fid, public.user_stats.fid),
        total_xp = EXCLUDED.total_xp,
        current_level = EXCLUDED.current_level,
        last_login_at = EXCLUDED.last_login_at;

    -- LOG AUDIT: Track internal sync
    INSERT INTO public.admin_audit_logs (admin_address, action, details)
    VALUES (
        'SYSTEM_SYNC',
        'DATA_CONSOLIDATION',
        jsonb_build_object(
            'target_wallet', NEW.wallet_address,
            'fid', NEW.fid,
            'timestamp', NOW()
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Apply Trigger to Source of Truth (user_profiles)
DROP TRIGGER IF EXISTS trg_sync_user_data_on_update ON public.user_profiles;
CREATE TRIGGER trg_sync_user_data_on_update
    AFTER INSERT OR UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_user_data_propagation();

-- 3. Initial One-Time Sync (Safe: Won't overwrite if data is newer elsewhere, but sets baseline)
-- Note: Run this manually if you want to sync existing data immediately.
/*
INSERT INTO public.profiles (address, display_name, bio, pfp_url, neynar_score)
SELECT wallet_address, display_name, bio, pfp_url, neynar_score FROM public.user_profiles
ON CONFLICT (address) DO NOTHING;

INSERT INTO public.user_stats (wallet_address, fid, total_xp, current_level)
SELECT wallet_address, fid, total_xp, tier FROM public.user_profiles
ON CONFLICT (fid) DO NOTHING;
*/

-- PRE-FLIGHT CHECK
-- ✅ Consistency: user_profiles is now the master source.
-- ✅ Backward Compatibility: profiles & user_stats stay updated.
-- ✅ Auditability: SYSTEM_SYNC entries added to admin_audit_logs.
