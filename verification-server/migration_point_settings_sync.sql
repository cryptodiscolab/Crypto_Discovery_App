-- Corrected point settings migration
-- Column names verified: activity_key, points_value

INSERT INTO public.point_settings (activity_key, points_value, platform, action_type, description, is_active)
VALUES 
    ('tiktok_comment', 100, 'tiktok', 'Comment', 'Reward for commenting on TikTok', true),
    ('tiktok_repost', 150, 'tiktok', 'Recast/Repost', 'Reward for reposting on TikTok', true),
    ('instagram_comment', 100, 'instagram', 'Comment', 'Reward for commenting on Instagram', true),
    ('instagram_repost', 150, 'instagram', 'Recast/Repost', 'Reward for reposting on Instagram', true),
    ('raffle_buy', 500, 'system', 'Buy', 'Reward for purchasing a Raffle ticket', true)
ON CONFLICT (activity_key) 
DO UPDATE SET 
    points_value = EXCLUDED.points_value,
    description = EXCLUDED.description,
    platform = EXCLUDED.platform,
    action_type = EXCLUDED.action_type,
    is_active = EXCLUDED.is_active;
