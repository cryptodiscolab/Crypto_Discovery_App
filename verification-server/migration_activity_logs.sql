-- Migration: Create User Activity Logs table
-- Categorizes activities into XP, PURCHASE, and REWARD

CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('XP', 'PURCHASE', 'REWARD')),
    activity_type TEXT NOT NULL,
    description TEXT,
    value_amount NUMERIC(36, 18) DEFAULT 0,
    value_symbol TEXT DEFAULT 'XP',
    tx_hash TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_activity_wallet ON public.user_activity_logs(wallet_address);
CREATE INDEX IF NOT EXISTS idx_activity_category ON public.user_activity_logs(category);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.user_activity_logs(created_at DESC);

-- Enable RLS (Security)
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own logs
CREATE POLICY "Users can view their own activity logs" ON public.user_activity_logs
    FOR SELECT USING (auth.role() = 'authenticated' AND wallet_address = (auth.jwt() ->> 'sub'));

-- Service role has full access (already default for service_role)
