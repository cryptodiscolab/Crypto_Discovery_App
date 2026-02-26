-- ============================================
-- CRYPTO DISCO APP - TASK SCHEMA REPAIR & CLEANUP
-- Purpose: Fix missing 'task_type' column and hide system tasks.
-- ============================================

-- 1. Add 'task_type' column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_tasks' AND column_name='task_type') THEN
        ALTER TABLE public.daily_tasks ADD COLUMN task_type VARCHAR(50) DEFAULT 'daily';
    END IF;
END $$;

-- 2. Drop old constraint if exists and create new one including 'system'
ALTER TABLE public.daily_tasks DROP CONSTRAINT IF EXISTS task_type_valid;
ALTER TABLE public.daily_tasks ADD CONSTRAINT task_type_valid 
    CHECK (task_type IN ('daily', 'weekly', 'special', 'onetime', 'system'));

-- 3. Mark Sync Anchor Tasks as 'system'
UPDATE public.daily_tasks 
SET task_type = 'system' 
WHERE id IN (
    '12e123f5-0ded-4ca1-af04-e8b6924823e2', -- MasterX Sync
    '885535d2-4c5c-4a80-9af5-36666192c244', -- DailyApp Sync
    '00000000-0000-0000-0000-000000000000'  -- Legacy Anchor
);

-- ✅ Schema repaired and system tasks hidden.
