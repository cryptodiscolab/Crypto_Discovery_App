-- ========================================================
-- SQL MIGRATION: RAFFLE BASE TABLE & V2 UPGRADE
-- Target: public.raffles
-- Status: Self-Healing Migration
-- ========================================================

-- 1. CREATE BASE TABLE (If missing)
-- This ensures the table exists before we try to ALTER it.
CREATE TABLE IF NOT EXISTS public.raffles (
    id BIGINT PRIMARY KEY, -- Blockchain Raffle ID
    creator_address TEXT NOT NULL,
    sponsor_address TEXT,
    nft_contract TEXT,
    token_id BIGINT DEFAULT 0,
    end_time TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    is_finalized BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. APPLY V2 UPDATES (Idempotent)
-- We use a DO block to add columns only if they don't exist
DO $$ 
BEGIN 
    -- max_tickets
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raffles' AND column_name='max_tickets') THEN
        ALTER TABLE public.raffles ADD COLUMN max_tickets BIGINT DEFAULT 100;
    END IF;

    -- metadata_uri
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raffles' AND column_name='metadata_uri') THEN
        ALTER TABLE public.raffles ADD COLUMN metadata_uri TEXT;
    END IF;

    -- prize_pool
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raffles' AND column_name='prize_pool') THEN
        ALTER TABLE public.raffles ADD COLUMN prize_pool NUMERIC DEFAULT 0;
    END IF;

    -- prize_per_winner
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raffles' AND column_name='prize_per_winner') THEN
        ALTER TABLE public.raffles ADD COLUMN prize_per_winner NUMERIC DEFAULT 0;
    END IF;
END $$;

-- 3. CREATE AUXILIARY TABLES
-- sponsor_stats: Track earnings and performance for event sponsors
CREATE TABLE IF NOT EXISTS public.sponsor_stats (
    sponsor_address TEXT PRIMARY KEY,
    total_raffles_created INTEGER DEFAULT 0,
    total_earnings_accumulated NUMERIC DEFAULT 0,
    total_tickets_sold BIGINT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- project_revenue_logs: Audit trail for 5% creation fees and 20% maintenance rakes
CREATE TABLE IF NOT EXISTS public.project_revenue_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL, 
    amount_eth NUMERIC NOT NULL,
    raffle_id BIGINT REFERENCES public.raffles(id),
    tx_hash TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SECURITY (RLS)
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_revenue_logs ENABLE ROW LEVEL SECURITY;

-- Public Read Policies
DROP POLICY IF EXISTS "Public can view raffles" ON public.raffles;
CREATE POLICY "Public can view raffles" ON public.raffles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view sponsor stats" ON public.sponsor_stats;
CREATE POLICY "Public can view sponsor stats" ON public.sponsor_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view revenue logs" ON public.project_revenue_logs;
CREATE POLICY "Public can view revenue logs" ON public.project_revenue_logs FOR SELECT USING (true);

-- Admin Write (Service Role Only via API)
-- No specific RLS needed for Service Role as it bypasses RLS by default.

-- PRE-FLIGHT CHECK
-- ✅ Self-Healing: Creates table if missing.
-- ✅ Idempotent: Can be run multiple times safely.
-- ✅ V2 Ready: Supports community sponsorship and metadata.
