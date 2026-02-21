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
    p.fid,
    COALESCE(p.farcaster_username, p.display_name, '') as username,
    COALESCE(
        NULLIF(p.display_name, ''), 
        ens.full_name,
        '0x' || substring(w.w_address from 3 for 4) || '...' || substring(w.w_address from length(w.w_address)-3)
    ) as display_name, 
    p.bio,
    p.pfp_url,
    COALESCE(p.neynar_score, 0) as neynar_score,
    COALESCE(up.total_xp, 0) as total_xp,
    COALESCE(up.tier, 1) as tier,
    -- Dynamic Rank Name based on total_xp
    CASE 
        WHEN COALESCE(up.total_xp, 0) >= 10000 THEN 'Gold'
        WHEN COALESCE(up.total_xp, 0) >= 5000 THEN 'Silver'
        WHEN COALESCE(up.total_xp, 0) >= 1000 THEN 'Bronze'
        ELSE 'Rookie'
    END as rank_name,
    ens.full_name as ens_name,
    COALESCE(p.updated_at, up.created_at, ens.created_at) as updated_at
FROM all_wallets w
LEFT JOIN public.profiles p ON w.w_address = LOWER(p.address)
LEFT JOIN public.user_profiles up ON w.w_address = LOWER(up.wallet_address)
LEFT JOIN public.ens_subdomains ens ON w.w_address = LOWER(ens.wallet_address);

-- Grant access
GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;

COMMENT ON VIEW public.v_user_full_profile IS 'Master View for User Identity, Points, and ENS Subdomains';
