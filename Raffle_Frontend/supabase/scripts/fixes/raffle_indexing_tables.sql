-- ========================================================
-- SQL MIGRATION: RAFFLE LIVE INDEXING TABLES
-- Target: public.raffle_tickets, public.raffle_sync_state
-- Description: Creates tables to track individual ticket purchases and the current indexed blockchain block.
-- ========================================================

-- 1. SYNC STATE TRACKER
-- Ensures the backend API can resume indexing without skipping or repeating blocks.
CREATE TABLE IF NOT EXISTS public.raffle_sync_state (
    id TEXT PRIMARY KEY DEFAULT 'primary_sync',
    last_synced_block BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initialize the tracker (Idempotent)
INSERT INTO public.raffle_sync_state (id, last_synced_block)
VALUES ('primary_sync', 0)
ON CONFLICT (id) DO NOTHING;

-- 2. TICKET TRACKER
-- Records individual ticket purchases for full audit parity
CREATE TABLE IF NOT EXISTS public.raffle_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id BIGINT NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    ticket_count BIGINT NOT NULL DEFAULT 1,
    tx_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for fast querying
CREATE INDEX IF NOT EXISTS idx_raffle_tickets_raffle_id ON public.raffle_tickets(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_tickets_wallet ON public.raffle_tickets(wallet_address);

-- 3. SECURITY (RLS)
ALTER TABLE public.raffle_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_tickets ENABLE ROW LEVEL SECURITY;

-- Public Read Policies
DROP POLICY IF EXISTS "Public can view ticket history" ON public.raffle_tickets;
CREATE POLICY "Public can view ticket history" ON public.raffle_tickets FOR SELECT USING (true);

-- No public read/write policy for sync_state (Server-side API only using Service Role)
