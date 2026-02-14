-- FIX: Recreate v_user_full_profile with wallet_address column
DROP VIEW IF EXISTS public.v_user_full_profile;

CREATE OR REPLACE VIEW public.v_user_full_profile AS
SELECT 
    p.wallet_address,
    p.fid,
    p.farcaster_username,
    p.display_name,
    p.pfp_url,
    p.bio,
    p.neynar_score,
    u.points,
    u.tier
FROM public.profiles p
LEFT JOIN public.user_profiles u ON LOWER(p.wallet_address) = LOWER(u.wallet_address);

-- Optional: Enable RLS on view if needed (Supabase Views inherit RLS from tables if using SECURITY INVOKER, but by default views are SECURITY DEFINER in some contexts)
-- For public read access:
COMMENT ON VIEW public.v_user_full_profile IS 'Joined view of Farcaster profiles and User points';
