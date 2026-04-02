-- ====================================================================
-- CRYPTO DISCO APP - BASE MAINNET HARDENED SUPABASE SCHEMA (v3.40.5)
-- Zero-Leak & EIP-191 Compliant Native Schema
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. IDENTITAS SOSIAL & WALLET (Sybil Resistance)
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_profiles (
    wallet_address TEXT PRIMARY KEY,
    fid BIGINT UNIQUE,
    twitter_id TEXT UNIQUE,
    tiktok_id TEXT UNIQUE,
    instagram_id TEXT UNIQUE,
    trust_score NUMERIC DEFAULT 0,
    total_xp INTEGER DEFAULT 0,
    tier INTEGER DEFAULT 1,
    tier_name TEXT DEFAULT 'Fan',
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT wallet_address_lowercase CHECK (wallet_address = LOWER(wallet_address)),
    CONSTRAINT trust_score_range CHECK (trust_score >= 0 AND trust_score <= 100),
    CONSTRAINT xp_positive CHECK (total_xp >= 0)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_xp_desc ON public.user_profiles(total_xp DESC);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Profiles"
    ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "No Anonymous Write Profiles"
    ON public.user_profiles FOR ALL USING (false) WITH CHECK (false);

-- --------------------------------------------------------------------
-- 2. TIERING & POINT SETTINGS (SBT Configurations)
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sbt_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name VARCHAR(50) UNIQUE NOT NULL,
    xp_required INTEGER NOT NULL,
    max_supply INTEGER DEFAULT 0, -- 0 means unlimited
    current_supply INTEGER DEFAULT 0,
    features JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sbt_thresholds_xp ON public.sbt_thresholds(xp_required DESC);
ALTER TABLE public.sbt_thresholds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read SBT Thresholds" ON public.sbt_thresholds FOR SELECT USING (is_active = true);
CREATE POLICY "Admin Write SBT Thresholds" ON public.sbt_thresholds FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.point_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_key VARCHAR(100) UNIQUE NOT NULL,
    points_value INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.point_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Point Settings" ON public.point_settings FOR SELECT USING (is_active = true);
CREATE POLICY "Admin Write Point Settings" ON public.point_settings FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read System Settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Admin Write System Settings" ON public.system_settings FOR ALL USING (false) WITH CHECK (false);

-- --------------------------------------------------------------------
-- 3. DAILY TASKS & UGC MODULE (Sponsorships & Raffles)
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.daily_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    xp_reward INTEGER NOT NULL DEFAULT 0,
    platform VARCHAR(50) NOT NULL, -- 'Twitter', 'Farcaster', 'TikTok', 'Instagram', 'System'
    action_type VARCHAR(50) NOT NULL, -- 'follow', 'like', 'recast', 'daily_claim', 'referral'
    target_id TEXT, -- e.g., tweet_id, fid
    target_url TEXT,
    task_type VARCHAR(50) DEFAULT 'daily',
    is_active BOOLEAN DEFAULT false, -- DEFAULT FALSE FOR MAINNET (REQUIRES ADMIN REVIEW)
    max_claims INTEGER DEFAULT NULL,
    current_claims INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_active ON public.daily_tasks(is_active, created_at DESC);
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Active Tasks" ON public.daily_tasks FOR SELECT USING (is_active = true);
CREATE POLICY "No Public Write Tasks" ON public.daily_tasks FOR ALL USING (false) WITH CHECK (false);

-- --------------------------------------------------------------------
-- 4. CLAIMS & LOGGING
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_task_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL REFERENCES public.user_profiles(wallet_address) ON DELETE CASCADE,
    task_id UUID REFERENCES public.daily_tasks(id) ON DELETE CASCADE, -- Made optional for off-chain XP fallback
    platform TEXT,
    target_id TEXT, 
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    xp_earned INTEGER NOT NULL,
    tx_hash TEXT, -- Storing on-chain proof for Optimistic Trust Sync
    
    CONSTRAINT wallet_address_lowercase CHECK (wallet_address = LOWER(wallet_address)),
    CONSTRAINT xp_earned_positive CHECK (xp_earned >= 0)
);

CREATE INDEX IF NOT EXISTS idx_claims_wallet_date ON public.user_task_claims((claimed_at::date), wallet_address);
CREATE INDEX IF NOT EXISTS idx_claims_tx_hash ON public.user_task_claims(tx_hash);
ALTER TABLE public.user_task_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Claims" ON public.user_task_claims FOR SELECT USING (true);
CREATE POLICY "No Public Write Claims" ON public.user_task_claims FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    activity_type VARCHAR(100) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_wallet ON public.user_activity_logs(wallet_address, created_at DESC);
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Logs" ON public.user_activity_logs FOR SELECT USING (true);
CREATE POLICY "No Public Write Logs" ON public.user_activity_logs FOR ALL USING (false) WITH CHECK (false);

-- --------------------------------------------------------------------
-- 5. REAL-TIME SQL VIEWS (SECURITY INVOKER = TRUE)
-- --------------------------------------------------------------------

-- SQL View for Real-time App Statistics
CREATE OR REPLACE VIEW public.v_user_full_profile WITH (security_invoker = true) AS
SELECT 
    up.wallet_address,
    up.fid,
    up.twitter_id,
    up.tiktok_id,
    up.instagram_id,
    up.trust_score,
    up.total_xp,
    up.tier,
    up.tier_name,
    COALESCE(claims.daily_claims, 0) as total_claims,
    up.last_seen_at
FROM public.user_profiles up
LEFT JOIN (
    SELECT wallet_address, COUNT(*) as daily_claims 
    FROM public.user_task_claims 
    GROUP BY wallet_address
) claims ON claims.wallet_address = up.wallet_address;

-- --------------------------------------------------------------------
-- 6. TRIGGERS & PROCEDURES (Opt-in DB Sync)
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_user_profiles_updated
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_daily_tasks_updated
    BEFORE UPDATE ON public.daily_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to safely increment claims
CREATE OR REPLACE FUNCTION increment_task_claims()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.task_id IS NOT NULL THEN
        UPDATE public.daily_tasks
        SET current_claims = current_claims + 1
        WHERE id = NEW.task_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_increment_claims_counter
    AFTER INSERT ON public.user_task_claims
    FOR EACH ROW EXECUTE FUNCTION increment_task_claims();

-- WARNING: sync_user_xp TRIGGER is explicitly excluded per PRD v3.27.0 
-- (Backend handles explicit total_xp update during verification for Optimistic Sync)

-- --------------------------------------------------------------------
-- FINAL CHECK: 
-- - NO Security Definer Views.
-- - NO Mutable Search Paths.
-- - Public RLS only for read, Backend Service Role for Writes.
-- --------------------------------------------------------------------
