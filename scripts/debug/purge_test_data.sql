-- ============================================
-- SQL PURGE: REMOVING DUMMY & TEST DATA
-- Resets application to a clean production state.
-- ============================================

-- 1. Clear User Progress & Rewards
-- Resets all users to zero XP and zero streaks.
UPDATE public.user_profiles 
SET 
    total_xp = 0, 
    streak_count = 0, 
    raffle_wins = 0, 
    tier = 0;

-- 2. Clear History & Claims
-- Removes all historical records of task claims and activity logs.
TRUNCATE TABLE public.user_task_claims CASCADE;
TRUNCATE TABLE public.user_activity_logs CASCADE;

-- 3. Clear Feature Data (Raffles & Campaigns)
-- Removes test raffles and test campaigns.
TRUNCATE TABLE public.raffles CASCADE;
TRUNCATE TABLE public.campaigns CASCADE;

-- 4. Clean up Daily Tasks
-- Removes redundant or test tasks. 
-- Specifically removes 'Daily Mojo' as it is redundant with the Profile Daily Claim.
-- Keeps 'system' tasks which are required for contract event synchronization.
DELETE FROM public.daily_tasks 
WHERE task_type != 'system';

-- ✅ Dummy Data Purged. Application reset to clean state.
