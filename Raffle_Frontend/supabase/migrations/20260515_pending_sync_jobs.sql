-- Migration: pending_sync_jobs
-- Purpose: Recovery ledger for transactions that succeeded on-chain but failed
--          to sync to the backend (XP, activity logs, status updates).
--
-- A reconciliation cron should periodically pick up status='pending' rows,
-- retry the corresponding sync, and update status to 'resolved' or 'failed'.

CREATE TABLE IF NOT EXISTS public.pending_sync_jobs (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    action_type TEXT NOT NULL,            -- 'raffle_buy' | 'raffle_claim' | 'daily_claim' | 'sbt_upgrade' | 'sbt_mint' | 'mission_create' | 'raffle_create' | 'raffle_reject'
    tx_hash TEXT,                          -- on-chain receipt hash (may be null if pre-receipt failure)
    chain_id INTEGER,
    contract_address TEXT,
    payload JSONB,                         -- raw context needed to retry the backend call
    error_message TEXT,                    -- sanitized last failure reason
    retry_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'resolved' | 'failed' | 'abandoned'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_attempted_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_sync_wallet ON public.pending_sync_jobs (wallet_address);
CREATE INDEX IF NOT EXISTS idx_pending_sync_status ON public.pending_sync_jobs (status);
CREATE INDEX IF NOT EXISTS idx_pending_sync_tx_hash ON public.pending_sync_jobs (tx_hash);
CREATE INDEX IF NOT EXISTS idx_pending_sync_action ON public.pending_sync_jobs (action_type);

-- RLS
ALTER TABLE public.pending_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Users can read their own pending jobs (for "sync pending" UI state)
DROP POLICY IF EXISTS "Users read own pending sync jobs" ON public.pending_sync_jobs;
CREATE POLICY "Users read own pending sync jobs"
    ON public.pending_sync_jobs
    FOR SELECT
    USING (lower(wallet_address) = lower(coalesce(auth.jwt()->>'sub', '')));

-- Service role does all writes via backend bundle.
-- (No public INSERT/UPDATE/DELETE policy → only service role can mutate.)

COMMENT ON TABLE public.pending_sync_jobs IS 'Recovery ledger for two-phase tx flows where chain succeeded but backend sync failed. Reconciliation cron retries pending rows.';
