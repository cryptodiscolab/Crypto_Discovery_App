-- ROBUST ALIGNMENT: Universal Identity View (Farcaster + Points + ENS)
-- This version uses a UNION of all wallets to ensure rows exist even before sync.

DROP VIEW IF EXISTS public.v_user_full_profile;

CREATE OR REPLACE VIEW public.v_user_full_profile AS
WITH all_wallets AS (
    -- Collect every known wallet address from all identity tables
    SELECT LOWER(address) as w_address FROM public.profiles
    UNION
    SELECT LOWER(wallet_address) FROM public.user_profiles
    UNION
    SELECT LOWER(wallet_address) FROM public.ens_subdomains
)
SELECT 
    w.w_address as wallet_address,
    COALESCE(
        NULLIF(p.display_name, ''), 
        NULLIF(up.display_name, ''), 
        ens.full_name
    ) as display_name, 
    COALESCE(NULLIF(p.bio, ''), NULLIF(up.bio, '')) as bio,
    COALESCE(NULLIF(p.pfp_url, ''), NULLIF(up.avatar_url, '')) as pfp_url,
    COALESCE(p.neynar_score, 0) as neynar_score,
    COALESCE(up.points, 0) as points,
    COALESCE(up.tier, 1) as tier,
    COALESCE(up.total_xp, 0) as total_xp,
    ens.full_name as ens_name,
    COALESCE(p.updated_at, up.created_at, ens.created_at) as updated_at
FROM all_wallets w
LEFT JOIN public.profiles p ON w.w_address = LOWER(p.address)
LEFT JOIN public.user_profiles up ON w.w_address = LOWER(up.wallet_address)
LEFT JOIN public.ens_subdomains ens ON w.w_address = LOWER(ens.wallet_address);

-- Grant access
GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;

COMMENT ON VIEW public.v_user_full_profile IS 'Master View for User Identity, Points, and ENS Subdomains';
