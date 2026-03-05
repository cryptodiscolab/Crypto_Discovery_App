-- ==========================================
-- REFERRAL SYSTEM MIGRATION v1
-- Adds referred_by tracking to user_profiles and updates view.
-- ==========================================

-- 1. Add referred_by to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- Index for fast lookup of referral network
CREATE INDEX IF NOT EXISTS idx_user_profiles_referred_by 
ON public.user_profiles(referred_by);

-- 2. Update v_user_full_profile view to include referred_by
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
    COALESCE(up.tier, 1) as tier,
    up.referred_by,
    CASE 
        WHEN COALESCE(up.total_xp, 0) >= 10000 THEN 'Gold'
        WHEN COALESCE(up.total_xp, 0) >= 5000 THEN 'Silver'
        WHEN COALESCE(up.total_xp, 0) >= 1000 THEN 'Bronze'
        ELSE 'Rookie'
    END as rank_name,
    ens.full_name as ens_name,
    COALESCE(p.updated_at, up.created_at, ens.created_at) as updated_at
FROM all_wallets w
LEFT JOIN public.profiles p ON w.w_address = LOWER(p.wallet_address)
LEFT JOIN public.user_profiles up ON w.w_address = LOWER(up.wallet_address)
LEFT JOIN public.ens_subdomains ens ON w.w_address = LOWER(ens.wallet_address);

-- Grant permissions (Safety Mandate)
GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;

COMMENT ON VIEW public.v_user_full_profile IS 'Master View updated with Referral System tracking.';
