-- Mark previously partial UGC campaign claims as requiring reconciliation.
-- These rows were claimed at the join layer but never finalized with payout amount/status/tx.

update public.user_claims uc
set payout_status = 'sync_failed'
where uc.is_claimed = true
  and (
    uc.payout_status is null
    or uc.payout_status in ('joined', 'processing', 'xp_processing', 'failed')
    or uc.payout_amount is null
  )
  and exists (
    select 1
    from public.user_task_claims utc
    where utc.wallet_address = uc.user_address
      and utc.task_id = 'ugc_campaign_' || uc.campaign_id::text
  );

notify pgrst, 'reload schema';
