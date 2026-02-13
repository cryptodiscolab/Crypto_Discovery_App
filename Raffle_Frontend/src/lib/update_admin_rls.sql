-- ==============================================================================
-- UPDATE RLS POLICIES: MULTI-ADMIN SUPPORT
-- ==============================================================================
-- Grant INSERT/UPDATE/DELETE permissions to:
-- 1. Smart Wallet (Old Admin): 0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B
-- 2. Deployer Wallet (New Admin): 0x455DF75735d2a18c26f0AfDefa93217B60369fe5
-- ==============================================================================

-- 1. Drop the old restrictive policy (if it exists)
DROP POLICY IF EXISTS "Admin can manage tasks" ON public.daily_tasks;

-- 2. Create the new inclusive policy
CREATE POLICY "Admin can manage tasks"
    ON public.daily_tasks
    FOR ALL
    USING (
        LOWER(current_setting('request.headers', true)::json->>'x-user-wallet') IN (
            LOWER('0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B'), -- Smart Wallet
            LOWER('0x455DF75735d2a18c26f0AfDefa93217B60369fe5')  -- Deployer Wallet (You)
        )
    )
    WITH CHECK (
        LOWER(current_setting('request.headers', true)::json->>'x-user-wallet') IN (
            LOWER('0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B'), -- Smart Wallet
            LOWER('0x455DF75735d2a18c26f0AfDefa93217B60369fe5')  -- Deployer Wallet (You)
        )
    );

-- ==============================================================================
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard -> SQL Editor
-- 2. Paste this entire script
-- 3. Click RUN
-- ==============================================================================
