-- Fix RLS Policies for user_profiles

-- 1. Enable RLS (if not already enabled)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

-- 3. Create Public Read Policy
-- Allow anyone (authenticated or anon) to read user_profiles
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.user_profiles FOR SELECT 
USING (true);

-- 4. Create Update Policy
-- Allow users to update ONLY their own profile based on wallet_address match
-- NOTE: This assumes Supabase Auth UID matches wallet_address or you are using custom claims.
-- If not using Supabase Auth for wallets, the API (Service Role) handles updates.
-- But for completeness:
CREATE POLICY "Users can update own profile" 
ON public.user_profiles FOR UPDATE 
USING (auth.uid()::text = wallet_address);

-- 5. Create Insert Policy
-- Allow authenticated users to insert their own profile
CREATE POLICY "Users can insert own profile" 
ON public.user_profiles FOR INSERT 
WITH CHECK (auth.uid()::text = wallet_address);
