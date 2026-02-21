-- Upgrade profiles table to V2 (Future-Proofing)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.follower_count IS 'Number of followers on Farcaster';
COMMENT ON COLUMN public.profiles.following_count IS 'Number of people followed on Farcaster';
COMMENT ON COLUMN public.profiles.is_active IS 'Indicates if the user is considered active based on recently activity';
