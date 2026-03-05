-- ============================================================
-- CRYPTO DISCO APP — SEASON ARCHIVAL & RESET FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_archive_and_reset_season(
    p_old_season_id INT,
    p_new_season_id INT
)
RETURNS VOID AS $$
BEGIN
    -- 1. Archive current status of all users for the old season
    -- We only archive users who reached at least Tier 1 (Bronze+) or have > 0 XP
    INSERT INTO public.user_season_history (wallet_address, season_id, final_tier, xp_at_reset)
    SELECT 
        wallet_address, 
        p_old_season_id, 
        tier, 
        total_xp
    FROM public.user_profiles
    WHERE tier > 0 OR total_xp > 0
    ON CONFLICT (wallet_address, season_id) 
    DO UPDATE SET 
        final_tier = EXCLUDED.final_tier,
        xp_at_reset = EXCLUDED.xp_at_reset;

    -- 2. Reset all active tiers to 0 (Guest) for the new season
    -- Note: We DON'T reset total_xp here if we want lifetime XP cumulative, 
    -- but usually, seasonal games reset seasonal XP. 
    -- For now, we only reset tiers as requested by the "SBT Tier Upgrade" logic.
    UPDATE public.user_profiles
    SET tier = 0
    WHERE tier > 0;

    -- 3. Update Seasons table metadata
    UPDATE public.seasons
    SET is_active = false, ended_at = NOW()
    WHERE season_id = p_old_season_id;

    INSERT INTO public.seasons (season_id, name, is_active, started_at)
    VALUES (p_new_season_id, 'Season ' || p_new_season_id, true, NOW())
    ON CONFLICT (season_id) DO UPDATE 
    SET is_active = true, started_at = NOW();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
