-- SECURITY HARDENING: Set search_path for SECURITY DEFINER functions
-- This prevents search_path hijacking vulnerabilities.

-- 1. public.sync_user_xp
CREATE OR REPLACE FUNCTION public.sync_user_xp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- STEP A: Ensure user profile exists (Upsert)
    INSERT INTO public.user_profiles (wallet_address, total_xp, tier)
    VALUES (LOWER(NEW.wallet_address), 0, 1)
    ON CONFLICT (wallet_address) DO NOTHING;

    -- STEP B: Aggressive XP Sync
    UPDATE public.user_profiles
    SET 
        total_xp = ( 
            SELECT COALESCE(SUM(xp_earned), 0)
            FROM public.user_task_claims
            WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address)
        ),
        last_seen_at = NOW()
    WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address);
    
    RETURN NEW;
END;
$$;

-- 2. public.fn_increment_user_xp
CREATE OR REPLACE FUNCTION public.fn_increment_user_xp(p_wallet TEXT, p_xp INTEGER)
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.user_profiles
    SET 
        total_xp = COALESCE(total_xp, 0) + p_xp,
        last_seen_at = NOW()
    WHERE LOWER(wallet_address) = LOWER(p_wallet);
END;
$$;

-- 3. Verify other critical functions (defensive)
-- fn_sync_user_data_propagation (if it was security definer, it should have it)
-- Based on previous view, it was not security definer, but let's make it robust if needed.
-- For now, focusing on the ones reported or clearly missing and security definer.

COMMENT ON FUNCTION public.sync_user_xp() IS 'Trigger function to sync total_xp from claims. (SECURITY DEFINER, search_path set)';
COMMENT ON FUNCTION public.fn_increment_user_xp(TEXT, INTEGER) IS 'RPC to increment user XP. (SECURITY DEFINER, search_path set)';
