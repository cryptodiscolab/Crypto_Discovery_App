-- Enforce one backup/indexer claim per wallet per task.
-- Historical duplicates are collapsed to the earliest recorded claim before adding the guard.

with ranked_claims as (
  select
    ctid,
    row_number() over (
      partition by wallet_address, task_id
      order by claimed_at asc nulls last, id asc
    ) as rn
  from public.user_task_claims
)
delete from public.user_task_claims utc
using ranked_claims ranked
where utc.ctid = ranked.ctid
  and ranked.rn > 1;

create unique index if not exists user_task_claims_wallet_task_uidx
on public.user_task_claims (wallet_address, task_id);

comment on index public.user_task_claims_wallet_task_uidx
is 'Prevents replay/duplicate task claim backup rows per wallet and task.';

notify pgrst, 'reload schema';
