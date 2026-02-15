-- ============================================
-- CRYPTO DISCO APP - CONSOLIDATED TASK SCHEMA (XP STANDARD)
-- ============================================

-- 1. CLEANUP & MIGRATION PREP
-- Drop old views and triggers to avoid conflicts during schema change
DROP VIEW IF EXISTS public.v_user_full_profile;
DROP TRIGGER IF EXISTS increment_xp_on_claim ON public.user_task_claims;
DROP TRIGGER IF EXISTS on_task_claimed ON public.user_task_claims;
DROP FUNCTION IF EXISTS public.sync_user_points();
DROP FUNCTION IF EXISTS public.increment_user_xp();

-- 2. SCHEMA EVOLUTION (user_profiles)
-- Ensure 'xp' column exists and is used instead of 'total_xp' or 'points'
DO $$ 
BEGIN 
    -- If total_xp exists but xp doesn't, rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='total_xp') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='xp') THEN
        ALTER TABLE public.user_profiles RENAME COLUMN total_xp TO xp;
    END IF;

    -- If points exists, we will migrate data later and drop it if it's different
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='xp') THEN
        ALTER TABLE public.user_profiles ADD COLUMN xp INTEGER DEFAULT 0;
    END IF;

    -- Add tier column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='tier') THEN
        ALTER TABLE public.user_profiles ADD COLUMN tier INTEGER DEFAULT 1;
    END IF;

    -- Add fid column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='fid') THEN
        ALTER TABLE public.user_profiles ADD COLUMN fid BIGINT UNIQUE;
    END IF;
END $$;

-- 2.5 DATA MIGRATION (From user_stats to user_profiles)
-- This performs the "Penggabungan" (Consolidation)
INSERT INTO public.user_profiles (wallet_address, fid, xp, tier)
SELECT 
    p.wallet_address,
    s.fid,
    COALESCE(s.total_xp, 0),
    COALESCE(s.current_level, 1)
FROM public.user_stats s
JOIN public.profiles p ON s.fid = p.fid
ON CONFLICT (wallet_address) DO UPDATE SET
    fid = EXCLUDED.fid,
    xp = GREATEST(public.user_profiles.xp, EXCLUDED.xp),
    tier = GREATEST(public.user_profiles.tier, EXCLUDED.tier);

-- 3. SCHEMA EVOLUTION (daily_tasks)
-- Ensure min_neynar_score exists
ALTER TABLE public.daily_tasks ADD COLUMN IF NOT EXISTS min_neynar_score FLOAT DEFAULT 0;

-- 4. CONSOLIDATED SYNC LOGIC
-- A single robust function to keep user XP in sync with their claims
CREATE OR REPLACE FUNCTION public.sync_user_xp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
BEGIN
    -- STEP A: Ensure user profile exists (Upsert)
    INSERT INTO public.user_profiles (wallet_address, xp, tier)
    VALUES (LOWER(NEW.wallet_address), 0, 1)
    ON CONFLICT (wallet_address) DO NOTHING;

    -- STEP B: Aggressive XP Sync
    -- Calculated from the source of truth: user_task_claims
    UPDATE public.user_profiles
    SET 
        xp = (
            SELECT COALESCE(SUM(xp_earned), 0)
            FROM public.user_task_claims
            WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address)
        ),
        last_seen_at = NOW()
    WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address);
    
    RETURN NEW;
END;
$$;

-- 5. APPLY TRIGGER
CREATE TRIGGER trg_sync_user_xp_on_claim
AFTER INSERT ON public.user_task_claims
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_xp();

-- 6. DATA BACKFILL
-- Sync all existing users immediately
UPDATE public.user_profiles p
SET xp = (
    SELECT COALESCE(SUM(xp_earned), 0)
    FROM public.user_task_claims c
    WHERE LOWER(c.wallet_address) = LOWER(p.wallet_address)
);

-- 7. RECREATE MASTER VIEW (v_user_full_profile)
-- Consolidated Identity: Farcaster Profile + Gaming Stats
CREATE OR REPLACE VIEW public.v_user_full_profile AS
WITH all_wallets AS (
    SELECT LOWER(address) as w_address FROM public.profiles
    UNION
    SELECT LOWER(wallet_address) FROM public.user_profiles
)
SELECT 
    w.w_address as wallet_address,
    p.fid,
    COALESCE(p.farcaster_username, p.display_name, '') as username,
    COALESCE(p.display_name, '') as display_name, 
    p.bio,
    p.pfp_url,
    COALESCE(p.neynar_score, 0) as neynar_score,
    COALESCE(up.xp, 0) as xp,
    COALESCE(up.tier, 1) as tier,
    -- Dynamic Rank Name based on XP (Consolidating logic)
    CASE 
        WHEN COALESCE(up.xp, 0) >= 10000 THEN 'Gold'
        WHEN COALESCE(up.xp, 0) >= 5000 THEN 'Silver'
        WHEN COALESCE(up.xp, 0) >= 1000 THEN 'Bronze'
        ELSE 'Rookie'
    END as rank_name,
    COALESCE(p.updated_at, up.created_at) as updated_at
FROM all_wallets w
LEFT JOIN public.profiles p ON w.w_address = LOWER(p.address)
LEFT JOIN public.user_profiles up ON w.w_address = LOWER(up.wallet_address);

-- Grant access
GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;

-- 8. CLEANUP (Optional)
-- Remove old 'points' column if it was used temporarily and info is now in 'xp'
-- ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS points;

-- ============================================
-- ✅ CONSOLIDATION COMPLETE
-- ✅ Standardized on 'xp'
-- ✅ Unified Trigger for performance
-- ✅ Robust Master View
-- ============================================
