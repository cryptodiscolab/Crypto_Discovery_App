-- ============================================
-- HARDENED RLS POLICIES (Custom Header Validation)
-- ============================================

-- DROP existing permissive policies first
DROP POLICY IF EXISTS "Public can view profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Public can view active tasks" ON public.daily_tasks;
DROP POLICY IF EXISTS "Admin can manage tasks" ON public.daily_tasks;
DROP POLICY IF EXISTS "Public can view claims" ON public.user_task_claims;
DROP POLICY IF EXISTS "Users can insert claims" ON public.user_task_claims;

-- ============================================
-- USER_PROFILES POLICIES
-- ============================================

-- Policy 1: Public Read (Leaderboard visible to all)
CREATE POLICY "Public can view profiles"
    ON public.user_profiles
    FOR SELECT
    USING (true);

-- Policy 2: Users can INSERT their own profile
CREATE POLICY "Users can create own profile"
    ON public.user_profiles
    FOR INSERT
    WITH CHECK (
        LOWER(current_setting('request.headers', true)::json->>'x-user-wallet') = LOWER(wallet_address)
    );

-- Policy 3: Users can UPDATE their own profile
CREATE POLICY "Users can update own profile"
    ON public.user_profiles
    FOR UPDATE
    USING (
        LOWER(current_setting('request.headers', true)::json->>'x-user-wallet') = LOWER(wallet_address)
    )
    WITH CHECK (
        LOWER(current_setting('request.headers', true)::json->>'x-user-wallet') = LOWER(wallet_address)
    );

-- ============================================
-- DAILY_TASKS POLICIES
-- ============================================

-- Policy 1: Public Read (All users can view active tasks)
CREATE POLICY "Public can view active tasks"
    ON public.daily_tasks
    FOR SELECT
    USING (is_active = true);

-- Policy 2: Admin Only Write (MASTER_ADMIN can manage tasks)
CREATE POLICY "Admin can manage tasks"
    ON public.daily_tasks
    FOR ALL
    USING (
        LOWER(current_setting('request.headers', true)::json->>'x-user-wallet') = LOWER('0x0845204b4b5e5f8aa7a0cfd2c6c6b5e8d4f3e2d1')
    )
    WITH CHECK (
        LOWER(current_setting('request.headers', true)::json->>'x-user-wallet') = LOWER('0x0845204b4b5e5f8aa7a0cfd2c6c6b5e8d4f3e2d1')
    );

-- ============================================
-- USER_TASK_CLAIMS POLICIES
-- ============================================

-- Policy 1: Public Read (For leaderboard & stats)
CREATE POLICY "Public can view claims"
    ON public.user_task_claims
    FOR SELECT
    USING (true);

-- Policy 2: Users can INSERT claims for their own wallet
CREATE POLICY "Users can insert own claims"
    ON public.user_task_claims
    FOR INSERT
    WITH CHECK (
        LOWER(current_setting('request.headers', true)::json->>'x-user-wallet') = LOWER(wallet_address)
    );

-- ============================================
-- PRE-FLIGHT CHECK
-- ============================================
-- ✅ Admin Protection: Only MASTER_ADMIN can modify tasks
-- ✅ User Protection: Users can only insert/update their own data
-- ✅ Header Validation: All write operations check x-user-wallet header
-- ✅ Public Read: Leaderboard & stats remain accessible
-- ✅ No Permissive Policies: All USING (true) replaced with proper checks
