-- ==========================================
-- NEXUS ORCHESTRON: Agent Reports Hub
-- ==========================================
-- Table designed to track audit findings from various Nexus sub-agents 
-- (OpenClaw, Qwen, DeepSeek) acting through the Orchestron.
-- Designed for secure, Service Role-only access to prevent public manipulation.

CREATE TABLE IF NOT EXISTS public.nexus_agent_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_role TEXT NOT NULL,          -- e.g., 'OpenClaw', 'Qwen', 'DeepSeek'
    error_type TEXT NOT NULL,          -- e.g., 'ABI', 'DATA', 'SYNTAX', 'SECURITY'
    target_file TEXT,                  -- Optional: the specific file with the issue
    message TEXT NOT NULL,             -- Detail of the issue found
    status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'RESOLVED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.nexus_agent_reports ENABLE ROW LEVEL SECURITY;

-- SECURITY POLICY:
-- 1. Public/Anonymous: NO READ/WRITE ACCESS
-- 2. Authenticated User: NO READ/WRITE ACCESS
-- 3. Service Role (Agent): FULL ACCESS (Internal Only, bypasses RLS by default)

DROP POLICY IF EXISTS "Deny All Public Access" ON public.nexus_agent_reports;
CREATE POLICY "Deny All Public Access" ON public.nexus_agent_reports 
FOR ALL USING (false);

-- Note: The Vercel integration or local Orchestron daemon will connect
-- using the `SERVICE_ROLE_KEY` to read/write to this table safely.
