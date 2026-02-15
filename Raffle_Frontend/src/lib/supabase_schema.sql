-- ============================================
-- CRYPTO DISCO APP - WEB3 NATIVE SUPABASE SCHEMA
-- Pure Wallet-Based Authentication (No Supabase Auth)
-- ============================================

-- ============================================
-- 1. USER PROFILES TABLE (Identity Foundation)
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
    wallet_address TEXT PRIMARY KEY,
    fid BIGINT UNIQUE,
    trust_score NUMERIC DEFAULT 0,
    xp INTEGER DEFAULT 0,
    tier INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT wallet_address_lowercase CHECK (wallet_address = LOWER(wallet_address)),
    CONSTRAINT trust_score_range CHECK (trust_score >= 0 AND trust_score <= 100),
    CONSTRAINT xp_positive CHECK (xp >= 0)
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_user_profiles_trust_score 
    ON public.user_profiles(trust_score DESC);

CREATE INDEX IF NOT EXISTS idx_user_profiles_xp 
    ON public.user_profiles(xp DESC);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public Read (Leaderboard & reputation visible to all)
CREATE POLICY "Public can view profiles"
    ON public.user_profiles
    FOR SELECT
    USING (true);

-- RLS Policy: Users can insert/update their own profile
-- NOTE: Karena tidak ada auth.uid(), kita rely pada application logic
-- untuk memastikan wallet_address yang dikirim valid
CREATE POLICY "Users can manage own profile"
    ON public.user_profiles
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 2. DAILY TASKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.daily_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    xp_reward INTEGER NOT NULL DEFAULT 0,
    task_type VARCHAR(50) DEFAULT 'daily',
    is_active BOOLEAN DEFAULT true,
    max_claims INTEGER DEFAULT NULL,
    current_claims INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT xp_reward_positive CHECK (xp_reward >= 0),
    CONSTRAINT current_claims_positive CHECK (current_claims >= 0),
    CONSTRAINT task_type_valid CHECK (task_type IN ('daily', 'weekly', 'special', 'onetime'))
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_daily_tasks_active 
    ON public.daily_tasks(is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_type 
    ON public.daily_tasks(task_type, is_active);

-- Enable RLS
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public Read (Semua user bisa lihat task yang aktif)
CREATE POLICY "Public can view active tasks"
    ON public.daily_tasks
    FOR SELECT
    USING (is_active = true);

-- RLS Policy: Admin Write
-- NOTE: Untuk saat ini, kita buat permissive policy
-- Nanti bisa ditambahkan custom function untuk check admin wallet
CREATE POLICY "Admin can manage tasks"
    ON public.daily_tasks
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 3. USER TASK CLAIMS TABLE (Web3 Native)
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_task_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    task_id UUID NOT NULL REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    xp_earned INTEGER NOT NULL,
    
    -- Foreign key ke user_profiles
    CONSTRAINT fk_wallet_address 
        FOREIGN KEY (wallet_address) 
        REFERENCES public.user_profiles(wallet_address) 
        ON DELETE CASCADE,
    
    -- Ensure wallet is lowercase
    CONSTRAINT wallet_address_lowercase 
        CHECK (wallet_address = LOWER(wallet_address)),
    
    -- XP must be positive
    CONSTRAINT xp_earned_positive 
        CHECK (xp_earned >= 0)
);

-- UNIQUE INDEX: Prevent duplicate claims (one claim per wallet per task per day)
-- Using expression index with ::date cast (immutable)
CREATE UNIQUE INDEX IF NOT EXISTS unique_wallet_task_claim 
    ON public.user_task_claims (wallet_address, task_id, (claimed_at::date));

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_user_task_claims_wallet 
    ON public.user_task_claims(wallet_address, claimed_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_task_claims_task 
    ON public.user_task_claims(task_id, claimed_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_task_claims_date 
    ON public.user_task_claims((claimed_at::date), wallet_address);

-- Enable RLS
ALTER TABLE public.user_task_claims ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public Read (untuk leaderboard & stats)
CREATE POLICY "Public can view claims"
    ON public.user_task_claims
    FOR SELECT
    USING (true);

-- RLS Policy: Users can insert claims
-- NOTE: Application logic harus memastikan wallet_address valid
CREATE POLICY "Users can insert claims"
    ON public.user_task_claims
    FOR INSERT
    WITH CHECK (true);

-- ============================================
-- 4. TRIGGERS & FUNCTIONS
-- ============================================

-- Trigger: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_tasks_updated_at
    BEFORE UPDATE ON public.daily_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function: Auto-sync user XP when task claimed
CREATE OR REPLACE FUNCTION public.sync_user_xp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.user_profiles
    SET 
        xp = (
            SELECT COALESCE(SUM(xp_earned), 0)
            FROM public.user_task_claims
            WHERE wallet_address = NEW.wallet_address
        ),
        last_seen_at = NOW()
    WHERE wallet_address = NEW.wallet_address;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_user_xp_on_claim
    AFTER INSERT ON public.user_task_claims
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_xp();

-- Function: Auto-increment current_claims counter
CREATE OR REPLACE FUNCTION increment_task_claims()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.daily_tasks
    SET current_claims = current_claims + 1
    WHERE id = NEW.task_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_claims_counter
    AFTER INSERT ON public.user_task_claims
    FOR EACH ROW
    EXECUTE FUNCTION increment_task_claims();

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Function: Check if wallet is admin
CREATE OR REPLACE FUNCTION is_admin_wallet(wallet TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- MASTER_ADMIN address (ganti dengan address lengkap)
    RETURN LOWER(wallet) = LOWER('0x0845204b4b5e5f8aa7a0cfd2c6c6b5e8d4f3e2d1');
END;
$$ LANGUAGE plpgsql;

-- Function: Get user stats
CREATE OR REPLACE FUNCTION get_user_stats(wallet TEXT)
RETURNS TABLE (
    xp INTEGER,
    total_claims BIGINT,
    trust_score NUMERIC,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.xp,
        COUNT(utc.id) as total_claims,
        up.trust_score,
        (SELECT COUNT(*) + 1 
         FROM public.user_profiles 
         WHERE xp > up.xp) as rank
    FROM public.user_profiles up
    LEFT JOIN public.user_task_claims utc ON utc.wallet_address = up.wallet_address
    WHERE up.wallet_address = LOWER(wallet)
    GROUP BY up.wallet_address, up.xp, up.trust_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. SAMPLE DATA (Optional - untuk testing)
-- ============================================

-- Insert sample tasks
INSERT INTO public.daily_tasks (description, xp_reward, task_type) VALUES
    ('Connect your wallet', 10, 'onetime'),
    ('Complete your first transaction', 25, 'onetime'),
    ('Daily check-in', 5, 'daily'),
    ('Participate in raffle', 50, 'weekly'),
    ('Invite a friend', 100, 'special')
ON CONFLICT DO NOTHING;

-- Insert sample admin profile
INSERT INTO public.user_profiles (wallet_address, trust_score, xp) VALUES
    (LOWER('0x0845204b4b5e5f8aa7a0cfd2c6c6b5e8d4f3e2d1'), 100, 0)
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. VERIFICATION QUERIES
-- ============================================

-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_profiles', 'daily_tasks', 'user_task_claims');

-- Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('user_profiles', 'daily_tasks', 'user_task_claims');

-- Check triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- ============================================
-- PRE-FLIGHT CHECK
-- ============================================
-- ✅ Web3 Native: No dependency on Supabase Auth
-- ✅ Wallet-Based Identity: wallet_address as primary key
-- ✅ Case-Insensitive: All wallets stored in lowercase
-- ✅ Auto XP Increment: Trigger updates user_profiles on claim
-- ✅ Duplicate Prevention: Unique constraint per wallet/task/day
-- ✅ Performance: Indexes on frequently queried columns
-- ✅ Data Integrity: Foreign keys & constraints
-- ✅ Helper Functions: is_admin_wallet(), get_user_stats()
