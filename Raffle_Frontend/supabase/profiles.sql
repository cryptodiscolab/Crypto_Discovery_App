-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    wallet_address TEXT PRIMARY KEY,
    fid BIGINT,
    farcaster_username TEXT,
    display_name TEXT,
    pfp_url TEXT,
    power_badge BOOLEAN DEFAULT false,
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read profiles
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

-- Policy: Users can only update their own profile
-- Assuming the user is authenticated via Supabase Auth (if applicable)
-- However, since we are syncing via wallet address from API, 
-- if using Supabase Auth with wallets, we'd use:
-- auth.uid() = wallet_address (if mapped)
-- For now, if users are not yet using Supabase Auth, they can't update via frontend directly unless we use an Anon key with restricted policy or Service Role (backend only).
-- To follow the user's request "agar user hanya bisa update datanya sendiri":
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid()::text = wallet_address);

-- If users are strictly using the API for syncing, the API will use the SERVICE_ROLE_KEY to bypass RLS.
