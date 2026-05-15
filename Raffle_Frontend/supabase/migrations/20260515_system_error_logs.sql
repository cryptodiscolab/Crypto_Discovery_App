-- Migration: system_error_logs
-- Purpose: Persistent error/incident log for admin dashboard.
-- Captures sanitized backend failures across transactions, sync, cron, social verify,
-- raffle, SBT, and payment flows.

CREATE TABLE IF NOT EXISTS public.system_error_logs (
    id BIGSERIAL PRIMARY KEY,
    severity TEXT NOT NULL DEFAULT 'error',       -- 'error' | 'warn' | 'critical' | 'info'
    surface TEXT NOT NULL,                         -- 'api' | 'cron' | 'frontend' | 'contract'
    bundle TEXT,                                   -- 'user-bundle' | 'admin-bundle' | 'tasks-bundle' | 'raffle-bundle' | 'audit-bundle' | 'sync-xp-onchain' | 'lurah-cron'
    action TEXT,                                   -- the action/handler that failed
    wallet_address TEXT,                           -- user wallet if applicable
    tx_hash TEXT,                                  -- transaction hash if applicable
    request_id TEXT,                               -- unique request identifier for correlation
    error_code TEXT,                               -- machine-readable error code
    message_sanitized TEXT NOT NULL,               -- human-readable sanitized error (no secrets/PII)
    metadata JSONB,                                -- additional context (chain_id, contract, args hash, etc.)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_error_severity ON public.system_error_logs (severity);
CREATE INDEX IF NOT EXISTS idx_system_error_surface ON public.system_error_logs (surface);
CREATE INDEX IF NOT EXISTS idx_system_error_bundle ON public.system_error_logs (bundle);
CREATE INDEX IF NOT EXISTS idx_system_error_wallet ON public.system_error_logs (wallet_address);
CREATE INDEX IF NOT EXISTS idx_system_error_created ON public.system_error_logs (created_at DESC);

-- RLS: Only service role and admin can read/write.
ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;

-- No public policies — only service_role can access.
-- Admin reads go through admin-bundle backend endpoint.

COMMENT ON TABLE public.system_error_logs IS 'Persistent sanitized error/incident log for admin dashboard. No PII or secrets stored.';
