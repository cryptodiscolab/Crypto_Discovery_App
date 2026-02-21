-- Robust RLS Fix for Web3 Native Wallets
-- This script aligns all RLS policies to use the 'x-user-wallet' header
-- and ensures 'upsert' operations work correctly for user_profiles.

-- 1. Ensure RLS is enabled on core tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_task_claims ENABLE ROW LEVEL SECURITY;

-- 2. Clean up conflicting policies for user_profiles
DROP POLICY IF EXISTS "Public can view profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.user_profiles;

-- 3. Create Robust Policies for user_profiles
-- Policy: Everyone can read profiles
CREATE POLICY "Public Read Profiles"
ON public.user_profiles
FOR SELECT
USING (true);

-- Policy: Authenticated Web3 users can manage (INSERT/UPDATE) their own profile
-- This is critical for 'upsert' operations
CREATE POLICY "Web3 Manage Own Profile"
ON public.user_profiles
FOR ALL
USING (
    LOWER(COALESCE(current_setting('request.headers', true)::json->>'x-user-wallet', '')) = LOWER(wallet_address)
)
WITH CHECK (
    LOWER(COALESCE(current_setting('request.headers', true)::json->>'x-user-wallet', '')) = LOWER(wallet_address)
);

-- 4. Clean up conflicting policies for user_task_claims
DROP POLICY IF EXISTS "Public can view claims" ON public.user_task_claims;
DROP POLICY IF EXISTS "Users can insert claims" ON public.user_task_claims;
DROP POLICY IF EXISTS "Users can insert own claims" ON public.user_task_claims;

-- 5. Create Robust Policies for user_task_claims
-- Policy: Everyone can read claims
CREATE POLICY "Public Read Claims"
ON public.user_task_claims
FOR SELECT
USING (true);

-- Policy: Authenticated Web3 users can insert their own claims
CREATE POLICY "Web3 Insert Own Claims"
ON public.user_task_claims
FOR INSERT
WITH CHECK (
    LOWER(COALESCE(current_setting('request.headers', true)::json->>'x-user-wallet', '')) = LOWER(wallet_address)
);

-- 6. Verification
COMMENT ON TABLE public.user_profiles IS 'Identity table secured by x-user-wallet header';
COMMENT ON TABLE public.user_task_claims IS 'Claims table secured by x-user-wallet header';
