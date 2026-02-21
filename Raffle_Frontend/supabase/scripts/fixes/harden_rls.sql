-- ========================================================
-- CRYPTO DISCO APP - RLS SECURITY HARDENING (CONCRETE)
-- ========================================================
-- Purpose: Disable insecure Header-Based RLS and enforce Service Role API access.
-- Following .cursorrules Protocol 8.1 & 8.2

-- 1. DROP INSECURE HEADER-BASED POLICIES
DROP POLICY IF EXISTS "Web3 Manage Own Profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Web3 Insert Own Claims" ON public.user_task_claims;
DROP POLICY IF EXISTS "Users can view own claims" ON public.user_task_claims;
DROP POLICY IF EXISTS "Admin can update settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admin can update platforms" ON public.supported_platforms;
DROP POLICY IF EXISTS "Admin read logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admin can manage tasks" ON public.daily_tasks;
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;

-- Redundant drop for new policies to ensure idempotency
DROP POLICY IF EXISTS "Public Read Profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Service Role Manage Profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Public Read Point Settings" ON public.point_settings;
DROP POLICY IF EXISTS "Service Role Manage Point Settings" ON public.point_settings;
DROP POLICY IF EXISTS "Public Read SBT Thresholds" ON public.sbt_thresholds;
DROP POLICY IF EXISTS "Service Role Manage SBT Thresholds" ON public.sbt_thresholds;
DROP POLICY IF EXISTS "Public Read ENS" ON public.ens_subdomains;
DROP POLICY IF EXISTS "Service Role Manage ENS" ON public.ens_subdomains;
DROP POLICY IF EXISTS "Service Role Manage Audit Logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Public Read Active Tasks" ON public.daily_tasks;
DROP POLICY IF EXISTS "Service Role Manage Tasks" ON public.daily_tasks;
DROP POLICY IF EXISTS "Service Role Manage Task Claims" ON public.user_task_claims;

-- 2. ENFORCE SERVICE ROLE ONLY FOR WRITES (Zero Trust)

-- A. user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Profiles" ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "Service Role Manage Profiles" ON public.user_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- B. point_settings
ALTER TABLE public.point_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Point Settings" ON public.point_settings FOR SELECT USING (true);
CREATE POLICY "Service Role Manage Point Settings" ON public.point_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- C. sbt_thresholds
ALTER TABLE public.sbt_thresholds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read SBT Thresholds" ON public.sbt_thresholds FOR SELECT USING (true);
CREATE POLICY "Service Role Manage SBT Thresholds" ON public.sbt_thresholds FOR ALL TO service_role USING (true) WITH CHECK (true);

-- D. ens_subdomains
ALTER TABLE public.ens_subdomains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read ENS" ON public.ens_subdomains FOR SELECT USING (true);
CREATE POLICY "Service Role Manage ENS" ON public.ens_subdomains FOR ALL TO service_role USING (true) WITH CHECK (true);

-- E. admin_audit_logs
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service Role Manage Audit Logs" ON public.admin_audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- F. daily_tasks
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Active Tasks" ON public.daily_tasks FOR SELECT USING (is_active = true);
CREATE POLICY "Service Role Manage Tasks" ON public.daily_tasks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- G. user_task_claims
ALTER TABLE public.user_task_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service Role Manage Task Claims" ON public.user_task_claims FOR ALL TO service_role USING (true) WITH CHECK (true);

-- LOG AUDIT: Track hardening event
INSERT INTO public.admin_audit_logs (admin_address, action, details)
VALUES (
    'SYSTEM_HARDENING',
    'RLS_SECURITY_UPGRADE',
    jsonb_build_object(
        'timestamp', NOW(),
        'protocol', 'SIWE_API_ONLY',
        'status', 'COMPLETED'
    )
);
