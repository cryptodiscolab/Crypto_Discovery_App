-- ============================================
-- CRYPTO DISCO APP - SYNC INITIALIZATION
-- Purpose: Register virtual "System Tasks" required for automated syncing.
-- These tasks act as anchors for points earned from MasterX and DailyApp events.
-- ============================================

-- 1. Create MasterX Points Placeholder Task
INSERT INTO public.daily_tasks (id, description, xp_reward, is_active)
VALUES (
    '12e123f5-0ded-4ca1-af04-e8b6924823e2',
    'MasterX Contract: Reward-Points Event Sync',
    0,
    true
) ON CONFLICT (id) DO UPDATE SET
    description = EXCLUDED.description,
    is_active = true;

-- 2. Create DailyApp Task Placeholder
INSERT INTO public.daily_tasks (id, description, xp_reward, is_active)
VALUES (
    '885535d2-4c5c-4a80-9af5-36666192c244',
    'DailyApp Contract: Task-Completed Event Sync',
    0,
    true
) ON CONFLICT (id) DO UPDATE SET
    description = EXCLUDED.description,
    is_active = true;

-- 3. Ensure Legacy Placeholder also exists
INSERT INTO public.daily_tasks (id, description, xp_reward, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'Legacy XP Migration Anchor',
    0,
    false
) ON CONFLICT (id) DO NOTHING;

-- ✅ System synchronization anchors established.
