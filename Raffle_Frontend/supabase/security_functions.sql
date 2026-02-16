-- ============================================
-- ATOMIC SECURITY FUNCTIONS
-- ============================================

-- Function: fn_increment_user_xp
-- Purpose: Safely increment a user's XP without race conditions
-- Usage via RPC: supabase.rpc('fn_increment_user_xp', { p_wallet: '0x...', p_xp: 100 })

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

-- Grant execution to API
GRANT EXECUTE ON FUNCTION public.fn_increment_user_xp(TEXT, INTEGER) TO anon, authenticated, service_role;
