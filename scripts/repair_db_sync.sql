-- ============================================
-- SQL REPAIR: DAILY CLAIM TASKS & SCHEMA ALIGNMENT
-- Fixes missing task IDs and ensures column naming consistency.
-- ============================================

-- 1. Ensure the Daily Claim Task Anchor exists
-- This UUID is used in user-bundle.js for standard daily rewards.
INSERT INTO public.daily_tasks (id, description, xp_reward, is_active, task_type)
VALUES (
    '288596d8-b5a9-4faf-bde0-0dd28aaba902',
    'Daily Mojo: Routine Bonus Claim',
    100,
    true,
    'daily'
) ON CONFLICT (id) DO UPDATE SET
    description = EXCLUDED.description,
    xp_reward = EXCLUDED.xp_reward,
    task_type = EXCLUDED.task_type,
    is_active = true;

-- 2. Ensure the System Sync Task Anchor exists
-- This UUID is used for non-standard delta jumps (Contract Sync).
INSERT INTO public.daily_tasks (id, description, xp_reward, is_active, task_type)
VALUES (
    '885535d2-4c5c-4a80-9af5-36666192c244',
    'DailyApp Contract: Task-Completed Event Sync',
    0,
    true,
    'system'
) ON CONFLICT (id) DO UPDATE SET
    is_active = true;

-- 3. Point Settings Verification
-- Ensure the daily_claim activity key is present for the API calculation.
INSERT INTO public.point_settings (activity_key, points_value)
VALUES ('daily_claim', 100)
ON CONFLICT (activity_key) DO NOTHING;

-- 4. Schema Alignment Check
-- Ensure total_xp column exists in user_profiles. 
-- We prefer 'total_xp' as it matches v_user_full_profile and ProfilePage.jsx.
DO $$ 
BEGIN 
    -- If 'xp' exists but 'total_xp' doesn't, rename it.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='xp') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='total_xp') THEN
        ALTER TABLE public.user_profiles RENAME COLUMN xp TO total_xp;
    END IF;

    -- If neither exist (highly unlikely), create it.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='total_xp') THEN
        ALTER TABLE public.user_profiles ADD COLUMN total_xp INTEGER DEFAULT 0;
    END IF;

    -- Streaks Implementation
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='streak_count') THEN
        ALTER TABLE public.user_profiles ADD COLUMN streak_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='last_streak_claim') THEN
        ALTER TABLE public.user_profiles ADD COLUMN last_streak_claim TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 5. Force a Sync of all current users based on claims
-- This ensures the leaderboard and profile stats are corrected immediately.
UPDATE public.user_profiles p
SET total_xp = (
    SELECT COALESCE(SUM(xp_earned), 0)
    FROM public.user_task_claims c
    WHERE LOWER(c.wallet_address) = LOWER(p.wallet_address)
);

-- 6. RECREATE VIEW: v_user_full_profile (The Source of Truth)
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
    -- Aggregate XP from all possible columns (Farcaster Sync + Wallet Tasks)
    (COALESCE(up.total_xp, 0) + COALESCE(us.total_xp, 0)) as total_xp,
    (
        SELECT level 
        FROM public.sbt_thresholds st 
        WHERE st.min_xp <= (COALESCE(up.total_xp, 0) + COALESCE(us.total_xp, 0))
        ORDER BY st.min_xp DESC 
        LIMIT 1
    ) as current_level,
    (
        SELECT tier_name 
        FROM public.sbt_thresholds st 
        WHERE st.min_xp <= (COALESCE(up.total_xp, 0) + COALESCE(us.total_xp, 0))
        ORDER BY st.min_xp DESC 
        LIMIT 1
    ) as rank_name
FROM public.user_profiles up
LEFT JOIN public.user_stats us ON up.fid = us.fid;

-- ✅ Database repair script updated.
