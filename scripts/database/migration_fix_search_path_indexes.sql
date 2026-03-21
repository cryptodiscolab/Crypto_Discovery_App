ALTER FUNCTION public.get_auth_wallet SET search_path = '';

DROP INDEX IF EXISTS public.idx_claims_user;
DROP INDEX IF EXISTS public.idx_campaigns_refund;
DROP INDEX IF EXISTS public.idx_api_action_log_wallet;
DROP INDEX IF EXISTS public.idx_campaigns_active;
DROP INDEX IF EXISTS public.idx_daily_tasks_onchain_id;
DROP INDEX IF EXISTS public.idx_agents_vault_parent_task_id;
DROP INDEX IF EXISTS public.idx_campaign_tasks_campaign_id;
DROP INDEX IF EXISTS public.idx_campaigns_platform_code;
DROP INDEX IF EXISTS public.idx_project_revenue_logs_raffle_id;
DROP INDEX IF EXISTS public.idx_user_claims_campaign_id;
DROP INDEX IF EXISTS public.idx_user_task_claims_task_id;
