-- ============================================
-- HARDENED RLS POLICIES v2
-- FIX #3: Remove all x-user-wallet header-based policies.
-- All client writes are BLOCKED. Only Next.js API Routes
-- using SERVICE_ROLE_KEY can write to these tables.
-- ============================================

-- ─── DROP OLD VULNERABLE POLICIES ────────────────────────────────────────────

DROP POLICY IF EXISTS "Public can view profiles"        ON public.user_profiles;
DROP POLICY IF EXISTS "Users can manage own profile"    ON public.user_profiles;
DROP POLICY IF EXISTS "Users can create own profile"    ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile"    ON public.user_profiles;

DROP POLICY IF EXISTS "Public can view active tasks"    ON public.daily_tasks;
DROP POLICY IF EXISTS "Admin can manage tasks"          ON public.daily_tasks;

DROP POLICY IF EXISTS "Public can view claims"          ON public.user_task_claims;
DROP POLICY IF EXISTS "Users can insert claims"         ON public.user_task_claims;
DROP POLICY IF EXISTS "Users can insert own claims"     ON public.user_task_claims;

-- ─── USER_PROFILES ────────────────────────────────────────────────────────────

-- ✅ Public read: leaderboard & reputation visible to all
CREATE POLICY "Public can view profiles"
    ON public.user_profiles
    FOR SELECT
    USING (true);

-- 🔒 Block ALL client-side writes.
-- API Routes use SERVICE_ROLE_KEY which bypasses RLS entirely.
-- No INSERT / UPDATE / DELETE policy = denied by default when RLS is enabled.

-- ─── DAILY_TASKS ─────────────────────────────────────────────────────────────

-- ✅ Public read: active tasks visible to all
CREATE POLICY "Public can view active tasks"
    ON public.daily_tasks
    FOR SELECT
    USING (is_active = true);

-- 🔒 No write policy — admin writes go through API Route with SERVICE_ROLE_KEY

-- ─── USER_TASK_CLAIMS ────────────────────────────────────────────────────────

-- ✅ Public read: for leaderboard & stats
CREATE POLICY "Public can view claims"
    ON public.user_task_claims
    FOR SELECT
    USING (true);

-- 🔒 No insert policy — claim writes go through /api/verify-action with signature check

-- ─── ADMIN HELPER FUNCTION (Updated with correct addresses) ──────────────────

CREATE OR REPLACE FUNCTION is_admin_wallet(wallet TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN LOWER(wallet) IN (
        LOWER('0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B'),
        LOWER('0x52260c30697674a7C837FEB2af21bBf3606795C8')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── PRE-FLIGHT CHECK ────────────────────────────────────────────────────────
-- ✅ No x-user-wallet header policies (was spoofable via DevTools)
-- ✅ All write operations blocked from client (RLS default deny)
-- ✅ SERVICE_ROLE_KEY bypasses RLS safely — only used server-side in API Routes
-- ✅ Public reads still work for leaderboard, task list, and claim history
-- ✅ is_admin_wallet() updated with both correct admin addresses
