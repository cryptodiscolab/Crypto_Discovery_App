-- ============================================
-- FIX: STANDARDIZE ON 'total_xp' (Reverting 'xp' rename)
-- ============================================

-- 1. COLUMN RENAMING (Safe Operation)
-- If 'xp' exists and 'total_xp' does not, rename it back.
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='xp') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='total_xp') THEN
        ALTER TABLE public.user_profiles RENAME COLUMN xp TO total_xp;
    END IF;

    -- If for some reason both exist (rare), we need to merge them.
    -- This is a manual intervention case, but for now we assume one or the other.
    -- If only 'total_xp' exists, we are good.
END $$;

-- 2. UPDATE VIEW (v_user_full_profile)
-- Ensure it explicitly uses 'total_xp'
DROP VIEW IF EXISTS public.v_user_full_profile;

CREATE OR REPLACE VIEW public.v_user_full_profile AS
WITH all_wallets AS (
    SELECT LOWER(address) as w_address FROM public.profiles
    UNION
    SELECT LOWER(wallet_address) FROM public.user_profiles
    UNION
    SELECT LOWER(wallet_address) FROM public.ens_subdomains
)
SELECT 
    w.w_address as wallet_address,
    up.fid, -- FIXED: Source FID from user_profiles
    COALESCE(p.display_name, 'User ' || substring(w.w_address from 3 for 6)) as username, -- FIXED: Removed non-existent farcaster_username
    COALESCE(
        NULLIF(p.display_name, ''), 
        ens.full_name,
        '0x' || substring(w.w_address from 3 for 4) || '...' || substring(w.w_address from length(w.w_address)-3)
    ) as display_name, 
    p.bio,
    p.pfp_url,
    COALESCE(p.neynar_score, 0) as neynar_score,
    COALESCE(up.total_xp, 0) as total_xp, -- FIXED: Explicitly use total_xp
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

GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;

-- 3. UPDATE RPC FUNCTION (fn_increment_user_xp)
-- Ensure it targets 'total_xp'
CREATE OR REPLACE FUNCTION public.fn_increment_user_xp(p_wallet TEXT, p_xp INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_profiles
    SET 
        total_xp = COALESCE(total_xp, 0) + p_xp,
        last_seen_at = NOW()
    WHERE LOWER(wallet_address) = LOWER(p_wallet);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. UPDATE SYNC LOGIC (fn_sync_user_data_propagation)
-- Ensure it reads 'total_xp' from NEW record
CREATE OR REPLACE FUNCTION public.fn_sync_user_data_propagation()
RETURNS TRIGGER AS $$
BEGIN
    -- SYNC TO: public.profiles
    INSERT INTO public.profiles (address, display_name, bio, pfp_url, neynar_score, updated_at)
    VALUES (
        NEW.wallet_address,
        NEW.display_name,
        NEW.bio,
        NEW.pfp_url,
        COALESCE(NEW.neynar_score, 0),
        NOW()
    )
    ON CONFLICT (address) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        bio = EXCLUDED.bio,
        pfp_url = EXCLUDED.pfp_url,
        neynar_score = EXCLUDED.neynar_score,
        updated_at = NOW();

    -- SYNC TO: public.user_stats
    INSERT INTO public.user_stats (wallet_address, fid, total_xp, current_level, last_login_at, created_at)
    VALUES (
        NEW.wallet_address,
        NEW.fid,
        COALESCE(NEW.total_xp, 0), -- FIXED: Use NEW.total_xp
        COALESCE(NEW.tier, 1),
        COALESCE(NEW.last_login_at, NOW()),
        COALESCE(NEW.created_at, NOW())
    )
    ON CONFLICT (wallet_address) DO UPDATE SET
        fid = COALESCE(EXCLUDED.fid, public.user_stats.fid),
        total_xp = EXCLUDED.total_xp,
        current_level = EXCLUDED.current_level,
        last_login_at = EXCLUDED.last_login_at;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. UPDATE AGGREGATE SYNC (sync_user_xp)
-- Updates user_profiles from claims
CREATE OR REPLACE FUNCTION public.sync_user_xp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
BEGIN
    -- STEP A: Ensure user profile exists (Upsert)
    INSERT INTO public.user_profiles (wallet_address, total_xp, tier)
    VALUES (LOWER(NEW.wallet_address), 0, 1)
    ON CONFLICT (wallet_address) DO NOTHING;

    -- STEP B: Aggressive XP Sync
    UPDATE public.user_profiles
    SET 
        total_xp = ( -- FIXED: Target total_xp
            SELECT COALESCE(SUM(xp_earned), 0)
            FROM public.user_task_claims
            WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address)
        ),
        last_seen_at = NOW()
    WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address);
    
    RETURN NEW;
END;
$$;
