-- ==========================================
-- MASTER SCHEMA MIGRATION: XP & LEADERBOARD FIX
-- ==========================================

-- 1. Ensure user_profiles has all needed columns
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS fid BIGINT,
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS pfp_url TEXT,
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS neynar_score FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS verifications JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS active_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS power_badge BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Ensure sbt_thresholds exists and is aligned
CREATE TABLE IF NOT EXISTS public.sbt_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level INTEGER UNIQUE NOT NULL,
    tier_name TEXT,
    min_xp INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fix potential naming conflicts from legacy versions
DO $$ 
BEGIN 
    -- Ensure tier_name exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sbt_thresholds' AND column_name='tier_name') THEN
        ALTER TABLE public.sbt_thresholds ADD COLUMN tier_name TEXT;
    END IF;
    
    -- If level_name exists, make it nullable to avoid constraint errors
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sbt_thresholds' AND column_name='level_name') THEN
        ALTER TABLE public.sbt_thresholds ALTER COLUMN level_name DROP NOT NULL;
    END IF;
END $$;

-- Seed defaults (using both naming conventions for safety)
INSERT INTO public.sbt_thresholds (level, tier_name, min_xp)
VALUES 
    (1, 'Rookie', 0),
    (2, 'Bronze', 1000),
    (3, 'Silver', 5000),
    (4, 'Gold', 15000),
    (5, 'Platinum', 50000)
ON CONFLICT (level) DO UPDATE SET 
    tier_name = EXCLUDED.tier_name,
    min_xp = EXCLUDED.min_xp;

-- 3. Ensure user_stats exists (Farcaster XP Storage)
CREATE TABLE IF NOT EXISTS public.user_stats (
    fid BIGINT PRIMARY KEY,
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. RECREATE VIEW: v_user_full_profile (The Source of Truth)
DROP VIEW IF EXISTS public.v_user_full_profile;

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
    -- Aggregate XP from all possible columns (Farcaster Sync + Wallet Tasks)
    (COALESCE(us.total_xp, 0) + COALESCE(up.total_xp, 0) + COALESCE(up.points, 0)) as total_xp,
    (
        SELECT level 
        FROM public.sbt_thresholds st 
        WHERE st.min_xp <= (COALESCE(us.total_xp, 0) + COALESCE(up.total_xp, 0) + COALESCE(up.points, 0)) 
        ORDER BY st.min_xp DESC 
        LIMIT 1
    ) as current_level,
    (
        SELECT tier_name 
        FROM public.sbt_thresholds st 
        WHERE st.min_xp <= (COALESCE(us.total_xp, 0) + COALESCE(up.total_xp, 0) + COALESCE(up.points, 0)) 
        ORDER BY st.min_xp DESC 
        LIMIT 1
    ) as rank_name
FROM public.user_profiles up
LEFT JOIN public.user_stats us ON up.fid = us.fid;

-- 5. GRANT PERMISSIONS
GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;
GRANT SELECT ON public.sbt_thresholds TO anon, authenticated;

-- 6. SYNC DATA HISTORIS (JUMPSTART)
-- Jalankan script ini untuk mensinkronkan total XP dari tugas-tugas yang sudah dikerjakan sebelumnya.
UPDATE public.user_profiles p
SET total_xp = (
    SELECT COALESCE(SUM(xp_earned), 0)
    FROM public.user_task_claims c
    WHERE LOWER(c.wallet_address) = LOWER(p.wallet_address)
);

COMMENT ON VIEW public.v_user_full_profile IS 'Master view aggregating Farcaster data, Wallet points, and dynamic Ranks.';
