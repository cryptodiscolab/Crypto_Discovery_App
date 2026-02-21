-- Add internal_trust_score to user_profiles and trigger for calculation
-- To be run in Supabase SQL Editor

-- 1. Add internal_trust_score column
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS internal_trust_score FLOAT DEFAULT 0.0;

-- 2. Trigger Function for Automatic Trust Score Calculation
CREATE OR REPLACE FUNCTION public.calculate_trust_score_v2()
RETURNS TRIGGER AS $$
BEGIN
    -- Formula: (Power Badge ? 50 : 0) + (Follower_count / 10) + (Rank_score * 100)
    -- We use COALESCE to handle NULLs gracefully
    NEW.internal_trust_score := 
        (CASE WHEN NEW.power_badge = true THEN 50 ELSE 0 END) + 
        (COALESCE(NEW.follower_count, 0) / 10.0) + 
        (COALESCE(NEW.rank_score, 0) * 100.0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS trg_calculate_trust_score_user_profiles ON public.user_profiles;
CREATE TRIGGER trg_calculate_trust_score_user_profiles
BEFORE INSERT OR UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.calculate_trust_score_v2();

-- 4. Backfill existing scores
UPDATE public.user_profiles SET last_sync = last_sync; -- Triggers the BEFORE UPDATE

-- 5. Comments
COMMENT ON COLUMN public.user_profiles.internal_trust_score IS 'Computed reputation score for anti-bot filtering';
