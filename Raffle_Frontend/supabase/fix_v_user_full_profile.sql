-- FINAL ALIGNMENT: v_user_full_profile view
-- Based on live schema audit: 
-- profiles table uses 'address'
-- user_profiles table uses 'wallet_address'

DROP VIEW IF EXISTS public.v_user_full_profile;

CREATE OR REPLACE VIEW public.v_user_full_profile AS
SELECT 
    p.address as wallet_address, -- Alias 'address' to 'wallet_address' for Frontend compatibility
    p.display_name,
    p.bio,
    p.pfp_url,
    p.neynar_score,
    COALESCE(up.points, 0) as points,
    COALESCE(up.tier, 1) as tier,
    COALESCE(up.total_xp, 0) as total_xp,
    p.updated_at
FROM public.profiles p
LEFT JOIN public.user_profiles up ON LOWER(p.address) = LOWER(up.wallet_address);

-- Grant permissions for the view
GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;

-- Optional: Ensure neynar_score is in profiles if not already added
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS neynar_score FLOAT DEFAULT 0;
