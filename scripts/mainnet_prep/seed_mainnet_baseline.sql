-- ====================================================================
-- CRYPTO DISCO APP - BASE MAINNET SEED DATA (v3.40.5)
-- Initial configurations for SBT Thresholds, Tasks, and Settings
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. TIER & SBT THRESHOLDS
-- --------------------------------------------------------------------
INSERT INTO public.sbt_thresholds (tier_name, xp_required, max_supply, current_supply, features, is_active)
VALUES
    ('Fan', 100, 0, 0, '{"multiplier": 1.0, "raffle_access": true}', true),
    ('Enthusiast', 500, 10000, 0, '{"multiplier": 1.2, "raffle_access": true, "early_access": true}', true),
    ('Ambassador', 2000, 5000, 0, '{"multiplier": 1.5, "raffle_access": true, "premium_access": true}', true),
    ('Whale', 10000, 1000, 0, '{"multiplier": 2.0, "raffle_access": true, "vip_access": true}', true)
ON CONFLICT (tier_name) DO UPDATE 
SET xp_required = EXCLUDED.xp_required,
    max_supply = EXCLUDED.max_supply,
    features = EXCLUDED.features;

-- --------------------------------------------------------------------
-- 2. POINT SETTINGS (Dynamic Reward Scaling)
-- --------------------------------------------------------------------
INSERT INTO public.point_settings (activity_key, points_value, description, is_active)
VALUES
    ('farcaster_follow', 50, 'XP for following a verified Farcaster account', true),
    ('farcaster_like', 20, 'XP for liking a Farcaster cast', true),
    ('twitter_follow', 50, 'XP for following a verified Twitter account', true),
    ('twitter_like', 20, 'XP for liking a Tweet', true),
    ('tiktok_follow', 50, 'XP for following on TikTok', true),
    ('daily_claim', 10, 'Base XP for daily check-in (before streak multi)', true),
    ('referral_invite', 100, 'XP bonus for inviting a new user', true),
    ('raffle_win_bonus', 200, 'Bonus XP when winning a tier 1 raffle', true)
ON CONFLICT (activity_key) DO UPDATE
SET points_value = EXCLUDED.points_value;

-- --------------------------------------------------------------------
-- 3. SYSTEM SETTINGS
-- --------------------------------------------------------------------
INSERT INTO public.system_settings (key, value, description)
VALUES
    ('underdog_threshold_percentile', '{"bottom_pct": 20}'::jsonb, 'Percentile threshold to qualify for Underdog Bonus'),
    ('underdog_bonus_multiplier_bp', '{"bp": 1000}'::jsonb, 'Underdog bonus in basis points (1000 = 10% bonus)'),
    ('maintenance_mode', '{"active": false}'::jsonb, 'Global killswitch for pausing all API actions'),
    ('minimum_wallet_balance', '{"eth": 0.0001}'::jsonb, 'Anti-sybil: Minimum Base ETH required to register'),
    ('active_features', '{"login_and_social": true, "daily_claim": false, "sbt_minting": false, "ugc_payment": false}'::jsonb, 'Mainnet Feature Flags for Phased Rollout')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- --------------------------------------------------------------------
-- 4. BASELINE DAILY TASKS
-- --------------------------------------------------------------------
-- Provide some initial active tasks for Mainnet Launch testing.
INSERT INTO public.daily_tasks (description, xp_reward, platform, action_type, target_url, task_type, is_active)
VALUES
    ('Follow @CryptoDisco on Farcaster', 50, 'Farcaster', 'follow', 'https://warpcast.com/cryptodisco', 'onetime', true),
    ('Follow @CryptoDisco on Twitter', 50, 'Twitter', 'follow', 'https://twitter.com/cryptodisco', 'onetime', true),
    ('Daily Check-in (Mainnet Beta)', 10, 'System', 'daily_claim', '', 'daily', true);
