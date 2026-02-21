-- ============================================
-- SQL MIGRATION: TASK SECURITY & EXPIRATION
-- ============================================

-- 1. ANTI-CHEAT: Prevent users from claiming the same task on the same day
-- Anchored on wallet_address, task_id, and the DATE part of claimed_at
CREATE UNIQUE INDEX IF NOT EXISTS uidx_user_task_day 
ON public.user_task_claims (wallet_address, task_id, (claimed_at::date));

COMMENT ON INDEX public.uidx_user_task_day IS 
'Prevents a user from claiming the same task more than once in a 24h UTC window.';

-- 2. AUTO-EXPIRATION: Logic to deactivate tasks based on expires_at
CREATE OR REPLACE FUNCTION public.fn_deactivate_expired_tasks()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.daily_tasks
    SET is_active = false
    WHERE is_active = true 
      AND expires_at IS NOT NULL 
      AND expires_at < NOW();
END;
$$;

-- Note: In Supabase, you can set up a Cron Job (via pg_cron or Edge Functions) 
-- to call `SELECT public.fn_deactivate_expired_tasks();` every hour.
-- For now, the frontend filtering in TaskList.jsx serves as the immediate fix.

-- 3. PERMISSION: Ensure user_task_claims can be inserted but not updated by public
ALTER TABLE public.user_task_claims ENABLE ROW LEVEL SECURITY;
-- (Assuming policies are already set via master_sync_security_v1.sql)
