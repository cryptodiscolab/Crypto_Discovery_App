-- ALAMAT: Supabase SQL Editor
-- 1. ADD NEW COLUMNS TO user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS fid BIGINT,
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS pfp_url TEXT,
ADD COLUMN IF NOT EXISTS follower_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS following_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS neynar_score FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS verifications TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS active_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS power_badge BOOLEAN DEFAULT FALSE;

-- 2. UPDATE VIEW v_user_full_profile
-- (Di-drop dulu biar bersih, lalu create ulang dengan kolom baru)
DROP VIEW IF EXISTS public.v_user_full_profile;

CREATE OR REPLACE VIEW public.v_user_full_profile AS
SELECT
    up.wallet_address,
    up.display_name,
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
    COALESCE(us.total_xp, 0) as total_xp,
    COALESCE(us.current_level, 1) as current_level
FROM public.user_profiles up
LEFT JOIN public.user_stats us ON up.fid = us.fid
OR up.wallet_address = (
    -- Fallback join logic logic kalau FID belum ada di user_stats tapi wallet ada di logs
    -- (Opsional, sesuaikan dengan logic existing user_stats relation)
    -- Simpelnya join via FID dulu.
    NULL
);

-- Note: user_stats mungkin perlu FK ke wallet_address atau sebaliknya jika FID null.
-- Update view ini sesuaikan dengan relasi yang _pasti_ ada.
-- Versi aman join ON wallet address jika user_stats punya wallet column, atau biarkan LEFT JOIN loose.

-- RE-GRANT PERMISSIONS (Just in case)
GRANT SELECT ON public.v_user_full_profile TO anon, authenticated, service_role;
