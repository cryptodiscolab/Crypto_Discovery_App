-- ============================================
-- AGENTS NEXUS: MULTI-AGENT ORCHESTRATION VAULT
-- ============================================

-- Function to check if a wallet is an admin (Required for RLS)
CREATE OR REPLACE FUNCTION public.is_admin_wallet(wallet TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN LOWER(wallet) IN (
        LOWER('0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B'),
        LOWER('0x52260c30697674a7C837FEB2af21bBf3606795C8')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Table to store agent tasks and state
CREATE TABLE IF NOT EXISTS public.agents_vault (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    task_name TEXT NOT NULL,
    task_description TEXT,
    target_agent TEXT NOT NULL, -- 'claw', 'qwen', 'deepseek', 'antigravity'
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    
    input_data JSONB DEFAULT '{}', -- prompt, file context, settings
    output_data JSONB DEFAULT '{}', -- agent results, code diffs, audit reports
    
    parent_task_id UUID REFERENCES public.agents_vault(id),
    requested_by_wallet TEXT NOT NULL,
    
    metadata JSONB DEFAULT '{}' -- model version, cost, performance metrics
);

-- Enable RLS
ALTER TABLE public.agents_vault ENABLE ROW LEVEL SECURITY;

-- Policies: Only Admins can see and manage agent tasks
CREATE POLICY "Admins can view agents_vault"
    ON public.agents_vault
    FOR SELECT
    USING (is_admin_wallet(requested_by_wallet));

CREATE POLICY "Admins can manage agents_vault"
    ON public.agents_vault
    FOR ALL
    USING (is_admin_wallet(requested_by_wallet));

-- TRIGGER for updated_at
CREATE OR REPLACE FUNCTION update_agents_vault_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_agents_vault_timestamp
BEFORE UPDATE ON public.agents_vault
FOR EACH ROW
EXECUTE FUNCTION update_agents_vault_timestamp();

-- COMMENT for documentation
COMMENT ON TABLE public.agents_vault IS 'Storage for multi-agent coordination, tasks, and historical responses.';
