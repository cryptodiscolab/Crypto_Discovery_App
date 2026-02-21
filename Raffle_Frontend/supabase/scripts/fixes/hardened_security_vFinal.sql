-- Super Sempurna: Final Hardening (Sybil Defense & Automated Trust Score)

-- 1. Add internal_trust_score column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS internal_trust_score FLOAT DEFAULT 0.0;

-- 2. Enforce Unique FID (Sybil Defense: 1 FID = 1 Wallet in our system)
-- Use a partial index to allow NULL if some profiles are incomplete, but unique otherwise
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_fid ON public.profiles (fid) WHERE (fid IS NOT NULL);

-- 3. Trigger Function for Automatic Trust Score Calculation
CREATE OR REPLACE FUNCTION public.calculate_trust_score()
RETURNS TRIGGER AS $$
BEGIN
    -- Formula: (Power Badge ? 50 : 0) + (Follower_count / 10) + (Rank_score * 100)
    NEW.internal_trust_score := 
        (CASE WHEN NEW.power_badge = true THEN 50 ELSE 0 END) + 
        (COALESCE(NEW.follower_count, 0) / 10.0) + 
        (COALESCE(NEW.rank_score, 0) * 100.0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create Trigger
DROP TRIGGER IF EXISTS trg_calculate_trust_score ON public.profiles;
CREATE TRIGGER trg_calculate_trust_score
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.calculate_trust_score();

-- 5. Comments for Documentation
COMMENT ON COLUMN public.profiles.internal_trust_score IS 'Computed reputation score for anti-bot filtering';
COMMENT ON INDEX public.unique_active_fid IS 'Prevents one Farcaster identity from farming with multiple wallets';
