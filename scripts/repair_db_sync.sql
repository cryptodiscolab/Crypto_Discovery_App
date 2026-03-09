-- ============================================
-- SQL REPAIR: XP UNIFICATION & SCHEMA ALIGNMENT
-- Unifies 'xp', 'points', and 'total_xp' into a single source of truth.
-- ============================================

-- 1. Ensure the Daily Claim Task Anchor exists
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
INSERT INTO public.point_settings (activity_key, points_value)
VALUES ('daily_claim', 100)
ON CONFLICT (activity_key) DO NOTHING;

-- 4. XP UNIFICATION: Merge legacy columns into total_xp
DO $$ 
BEGIN 
    -- Ensure total_xp exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='total_xp') THEN
        ALTER TABLE public.user_profiles ADD COLUMN total_xp INTEGER DEFAULT 0;
    END IF;

    -- Merge 'xp' into total_xp if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='xp') THEN
        UPDATE public.user_profiles SET total_xp = total_xp + COALESCE(xp, 0);
        
        -- Fix: Drop legacy trigger that depends on 'xp' column
        DROP TRIGGER IF EXISTS trg_sync_total_xp ON public.user_profiles;
        
        ALTER TABLE public.user_profiles DROP COLUMN xp;
    END IF;

    -- Merge 'points' into total_xp if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='points') THEN
        UPDATE public.user_profiles SET total_xp = total_xp + COALESCE(points, 0);
        ALTER TABLE public.user_profiles DROP COLUMN points;
    END IF;

    -- Streaks Implementation (Ensure these exist)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='streak_count') THEN
        ALTER TABLE public.user_profiles ADD COLUMN streak_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='last_streak_claim') THEN
        ALTER TABLE public.user_profiles ADD COLUMN last_streak_claim TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 5. FUNCTION: Improved sync_user_xp (Direct Calculation)
-- This function recalculates total_xp from claims to ensure consistency.
CREATE OR REPLACE FUNCTION public.sync_user_xp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.user_profiles
    SET 
        total_xp = (
            SELECT COALESCE(SUM(xp_earned), 0)
            FROM public.user_task_claims
            WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address)
        ),
        updated_at = NOW()
    WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Re-create the trigger to ensure it's pointing to the correct function
DROP TRIGGER IF EXISTS trg_sync_user_xp_on_claim ON public.user_task_claims;
CREATE TRIGGER trg_sync_user_xp_on_claim
    AFTER INSERT OR UPDATE ON public.user_task_claims
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_xp();

-- 6. RECREATE VIEW: v_user_full_profile (Refined)
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
    -- Simple total_xp from the profile table
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

-- ✅ XP Schema Unified and Triggers Repaired.
