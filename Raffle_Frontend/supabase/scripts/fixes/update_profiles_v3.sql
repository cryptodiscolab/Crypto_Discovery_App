-- Upgrade profiles table to V3 (Full-Scale Neynar v2 Integration)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS verified_addresses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS rank_score FLOAT DEFAULT 0.0;

-- Add comments for clarity
COMMENT ON COLUMN public.profiles.bio IS 'User bio/description from Farcaster';
COMMENT ON COLUMN public.profiles.verified_addresses IS 'List of all wallet addresses verified to this FID (Sybil Protection)';
COMMENT ON COLUMN public.profiles.rank_score IS 'Farcaster social rank score (OpenRank)';
