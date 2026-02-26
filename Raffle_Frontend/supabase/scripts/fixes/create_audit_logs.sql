-- ============================================
-- CRYPTO DISCO APP - AUDIT & LOGGING SCHEMA
-- Purpose: Fix "Internal Server Error" caused by missing logs table.
-- ============================================

-- 1. ADMIN AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_address TEXT NOT NULL,
    action TEXT NOT NULL, -- e.g., 'TASK_CLAIMED', 'PROFILE_UPDATE', 'SYNC_COMPLETED'
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for admin tracking
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_address ON public.admin_audit_logs(admin_address, created_at DESC);

-- 2. API ACTION LOGS (Replay Protection)
-- Mandated by Rule §8.2: Check message timestamp against previous usage.
CREATE TABLE IF NOT EXISTS public.api_action_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    action_type TEXT NOT NULL,
    signature_hash TEXT UNIQUE NOT NULL, -- keccak256(signature) to prevent replay
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_api_action_log_wallet ON public.api_action_log(wallet_address, action_type);

-- Enable RLS (Read-only for public, write restricted to SERVICE_ROLE)
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view audit logs" ON public.admin_audit_logs FOR SELECT USING (true);
CREATE POLICY "Public can view action logs" ON public.api_action_log FOR SELECT USING (true);

-- ✅ Audit and Action Log infrastructure established.
