-- Fix for Google Sign-In and Neynar Verifications Not Showing
-- The view v_user_full_profile was missing the newer columns from user_profiles

CREATE OR REPLACE VIEW v_user_full_profile AS 
SELECT 
    up.wallet_address,
    up.fid,
    up.username,
    up.display_name,
    up.pfp_url,
    up.total_xp,
    up.tier,
    up.referred_by,
    up.last_daily_bonus_claim,
    up.streak_count,
    CASE
        WHEN up.tier = 5 THEN 'Diamond'::text
        WHEN up.tier = 4 THEN 'Platinum'::text
        WHEN up.tier = 3 THEN 'Gold'::text
        WHEN up.tier = 2 THEN 'Silver'::text
        WHEN up.tier = 1 THEN 'Bronze'::text
        ELSE 'Rookie'::text
    END AS rank_name,
    up.updated_at,
    up.is_admin,
    up.is_operator,
    -- NEW COLUMNS FOR IDENTITY SYNC
    up.google_id,
    up.google_email,
    up.twitter_id,
    up.twitter_username,
    up.oauth_provider,
    up.neynar_score,
    up.verifications,
    up.power_badge,
    up.follower_count,
    up.following_count,
    up.bio,
    up.active_status
FROM user_profiles up;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
