-- ========================================================
-- CONSOLIDATED FIX: RESOLVE UNIQUE CONSTRAINT ERRORS
-- ========================================================

-- 1. Ensure 'user_stats' allows NULL FID (Legacy support for wallet-only users)
ALTER TABLE public.user_stats ALTER COLUMN fid DROP NOT NULL;

-- 2. ADD UNIQUE CONSTRAINT TO 'user_stats' (Crucial for ON CONFLICT to work)
-- This fixes the "no unique or exclusion constraint matching" error.
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_stats_wallet_address_key' 
        AND conrelid = 'public.user_stats'::regclass
    ) THEN
        ALTER TABLE public.user_stats ADD CONSTRAINT user_stats_wallet_address_key UNIQUE (wallet_address);
    END IF;
END $$;

-- 3. Define the Robust Sync Function
CREATE OR REPLACE FUNCTION public.fn_sync_user_data_propagation()
RETURNS TRIGGER AS $$
BEGIN
    -- SYNC TO: public.profiles (Legacy Table 1)
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

    -- SYNC TO: public.user_stats (Legacy Table 2)
    -- Anchors on wallet_address now that it has a UNIQUE constraint
    INSERT INTO public.user_stats (wallet_address, fid, total_xp, current_level, last_login_at, created_at)
    VALUES (
        NEW.wallet_address,
        NEW.fid,
        COALESCE(NEW.total_xp, 0),
        COALESCE(NEW.tier, 1),
        COALESCE(NEW.last_login_at, NOW()),
        COALESCE(NEW.created_at, NOW())
    )
    ON CONFLICT (wallet_address) DO UPDATE SET
        fid = COALESCE(EXCLUDED.fid, public.user_stats.fid),
        total_xp = EXCLUDED.total_xp,
        current_level = EXCLUDED.current_level,
        last_login_at = EXCLUDED.last_login_at;

    -- Standard Audit Log
    INSERT INTO public.admin_audit_logs (admin_address, action, details)
    VALUES (
        'SYSTEM_SYNC',
        'FIXED_DATA_CONSOLIDATION',
        jsonb_build_object(
            'target_wallet', NEW.wallet_address,
            'fid', NEW.fid,
            'timestamp', NOW()
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-apply Trigger to user_profiles
DROP TRIGGER IF EXISTS trg_sync_user_data_on_update ON public.user_profiles;
CREATE TRIGGER trg_sync_user_data_on_update
    AFTER INSERT OR UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_user_data_propagation();
