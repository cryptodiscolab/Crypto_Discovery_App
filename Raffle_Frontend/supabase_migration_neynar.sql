-- Add neynar_score to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS neynar_score FLOAT DEFAULT 0;

-- Add min_neynar_score to daily_tasks
ALTER TABLE daily_tasks 
ADD COLUMN IF NOT EXISTS min_neynar_score FLOAT DEFAULT 0;

-- Comment for documentation
COMMENT ON COLUMN daily_tasks.min_neynar_score IS 'Minimum Neynar trust score required to claim this task';
COMMENT ON COLUMN user_profiles.neynar_score IS 'User Farcaster internal trust score synced from Neynar';
