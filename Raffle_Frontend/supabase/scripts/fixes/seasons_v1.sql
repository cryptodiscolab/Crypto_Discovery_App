-- ============================================================
-- CRYPTO DISCO APP — SEASONS & TIER UPGRADE ECONOMY v1
-- ============================================================

-- 1. Update sbt_thresholds to include fees
ALTER TABLE public.sbt_thresholds
  ADD COLUMN IF NOT EXISTS upgrade_fee_eth NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upgrade_fee_usdc NUMERIC DEFAULT 0;

-- 2. Create Seasons table
CREATE TABLE IF NOT EXISTS public.seasons (
  id BIGSERIAL PRIMARY KEY,
  season_id INT UNIQUE NOT NULL,
  name TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active season lookups
CREATE INDEX IF NOT EXISTS idx_seasons_active ON public.seasons(is_active) WHERE is_active = TRUE;

-- 3. Create User Season History (Permanent Record)
CREATE TABLE IF NOT EXISTS public.user_season_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  season_id INT NOT NULL REFERENCES public.seasons(season_id),
  final_tier INT NOT NULL DEFAULT 0,
  xp_at_reset INT DEFAULT 0,
  sbt_token_id TEXT, -- For minted collectible NFT reference
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_address, season_id)
);

-- Index for user history lookups
CREATE INDEX IF NOT EXISTS idx_user_history_wallet ON public.user_season_history(wallet_address);

-- 4. RLS for Seasons & History
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_season_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view seasons" ON public.seasons;
CREATE POLICY "Public can view seasons" ON public.seasons
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view own history" ON public.user_season_history;
CREATE POLICY "Users can view own history" ON public.user_season_history
    FOR SELECT USING (LOWER(wallet_address) = LOWER(auth.jwt() ->> 'sub') OR auth.role() = 'service_role');

-- 5. Seed Season 1 if not exists
INSERT INTO public.seasons (season_id, name, is_active)
VALUES (1, 'Season 1: Genesis', TRUE)
ON CONFLICT (season_id) DO NOTHING;

COMMENT ON TABLE public.seasons IS 'Global season control for Tier resets and rewards.';
COMMENT ON TABLE public.user_season_history IS 'Permanent archive of user achievements per season.';
