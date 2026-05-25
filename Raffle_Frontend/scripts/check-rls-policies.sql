-- RLS Policy Drift Detection
-- Run this in Supabase SQL editor to verify the live policies match expected hardening.
-- Returns rows for any policy that does NOT match the expected pattern.

-- 1. Tables that MUST have RLS enabled
WITH required_rls AS (
    SELECT unnest(ARRAY[
        'user_activity_logs',
        'user_task_claims',
        'admin_audit_logs',
        'user_privileges',
        'agent_vault',
        'agents_vault',
        'system_settings',
        'point_settings',
        'sbt_thresholds',
        'allowed_tokens',
        'campaigns',
        'user_profiles',
        'pending_sync_jobs',
        'system_error_logs'
    ]) AS table_name
),
rls_status AS (
    SELECT
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
)
SELECT
    'RLS_NOT_ENABLED' AS issue,
    r.table_name
FROM required_rls r
LEFT JOIN rls_status s ON r.table_name = s.table_name
WHERE s.rls_enabled IS NOT TRUE

UNION ALL

-- 2. Tables that MUST NOT have public-read policies (admin-only)
SELECT
    'PUBLIC_READ_ON_ADMIN_TABLE' AS issue,
    p.tablename
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN ('admin_audit_logs', 'agent_vault', 'agents_vault', 'pending_sync_jobs', 'system_error_logs')
  AND p.cmd = 'SELECT'
  AND p.qual = 'true'

UNION ALL

-- 3. user_activity_logs and user_task_claims must NOT have unrestricted public reads
SELECT
    'PUBLIC_READ_ON_USER_LOGS' AS issue,
    p.tablename
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN ('user_activity_logs', 'user_task_claims')
  AND p.cmd = 'SELECT'
  AND p.qual = 'true'

UNION ALL

-- 4. agents_vault and system_error_logs MUST have explicit deny-all policy (resolves lint rls_enabled_no_policy)
SELECT
    'MISSING_DENY_ALL_POLICY' AS issue,
    t.table_name
FROM (VALUES ('agents_vault'), ('system_error_logs')) AS t(table_name)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = t.table_name
      AND p.policyname IN (
          t.table_name || '_deny_all',
          'No public access ' || t.table_name
      )
)

ORDER BY 1, 2;
