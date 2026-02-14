-- ENHANCED ALIGNMENT: Include ENS subdomains in v_user_full_profile
DROP VIEW IF EXISTS public.v_user_full_profile;

CREATE OR REPLACE VIEW public.v_user_full_profile AS
SELECT 
    p.address as wallet_address,
    COALESCE(p.display_name, ens.full_name) as display_name, -- Fallback to ENS name
    p.bio,
    p.pfp_url,
    p.neynar_score,
    COALESCE(up.points, 0) as points,
    COALESCE(up.tier, 1) as tier,
    COALESCE(up.total_xp, 0) as total_xp,
    ens.full_name as ens_name,
    p.updated_at
FROM public.profiles p
LEFT JOIN public.user_profiles up ON LOWER(p.address) = LOWER(up.wallet_address)
LEFT JOIN public.ens_subdomains ens ON LOWER(p.address) = LOWER(ens.wallet_address);

GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;
