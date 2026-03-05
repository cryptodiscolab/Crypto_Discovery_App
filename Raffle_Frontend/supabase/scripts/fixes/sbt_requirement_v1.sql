-- ==========================================
-- SECURITY PATCH: SBT ENFORCEMENT v1
-- Prevents users from ranking up without on-chain SBT.
-- ==========================================

-- 1. Reset default tier to 0 (None/Guest)
ALTER TABLE public.user_profiles ALTER COLUMN tier SET DEFAULT 0;

-- Update existing unverified users to tier 0
-- (Assuming users with 0 tier in contract should be 0 here)
UPDATE public.user_profiles SET tier = 0 WHERE tier = 1;

-- 2. Modify v_user_full_profile to enforce SBT requirement
DROP VIEW IF EXISTS public.v_user_full_profile;

CREATE OR REPLACE VIEW public.v_user_full_profile AS
WITH all_wallets AS (
    SELECT LOWER(wallet_address) as w_address FROM public.user_profiles
    UNION
    SELECT LOWER(address) FROM public.profiles
    UNION
    SELECT LOWER(wallet_address) FROM public.ens_subdomains
)
SELECT 
    w.w_address as wallet_address,
    COALESCE(up.fid, p.fid) as fid,
    COALESCE(p.display_name, '') as username,
    COALESCE(
        NULLIF(p.display_name, ''),
        '0x' || substring(w.w_address from 3 for 4) || '...' || substring(w.w_address from length(w.w_address)-3)
    ) as display_name, 
    COALESCE(p.pfp_url, '') as pfp_url,
    COALESCE(up.total_xp, 0) as total_xp,
    COALESCE(up.tier, 0) as tier,
    up.referred_by,
    CASE 
        -- IF TIER IS 0 (No SBT), ALWAYS RETURN 'Guest'
        WHEN COALESCE(up.tier, 0) = 0 THEN 'Guest'
        
        -- ONLY IF TIER >= 1, CALCULATE BASED ON XP
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

-- Grant permissions
GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;

COMMENT ON VIEW public.v_user_full_profile IS 'Secure View: Rank name restricted to SBT Holders (Tier > 0).';
