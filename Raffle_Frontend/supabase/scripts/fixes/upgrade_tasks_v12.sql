-- ============================================
-- UPGRADE DAILY TASKS TABLE FOR V12 & ADVANCED VERIFICATION
-- ============================================

-- 1. Add new columns to public.daily_tasks
ALTER TABLE public.daily_tasks 
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'base',
ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'transaction',
ADD COLUMN IF NOT EXISTS link TEXT DEFAULT 'https://warpcast.com/CryptoDisco',
ADD COLUMN IF NOT EXISTS min_tier INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS requires_verification BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS min_neynar_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_followers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_age_requirement INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS power_badge_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS no_spam_filter BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS onchain_id INTEGER;

-- 2. Rename 'description' to 'title' (or just use description as title to avoid breaking old code)
-- Let's keep 'description' but we'll use it as Title in the UI.

-- 3. Add index for onchain_id for faster sync
CREATE INDEX IF NOT EXISTS idx_daily_tasks_onchain_id ON public.daily_tasks(onchain_id);

-- 4. Update RLS (Ensure public can view all columns)
DROP POLICY IF EXISTS "Public can view active tasks" ON public.daily_tasks;
CREATE POLICY "Public can view active tasks"
    ON public.daily_tasks
    FOR SELECT
    USING (is_active = true);

-- 5. Audit Logging entry
-- This part is usually done via application but can be noted here.
