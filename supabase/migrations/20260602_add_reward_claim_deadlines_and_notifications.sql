-- Add 3x24h claim windows for UGC rewards and raffle prizes plus notification dedupe log.

alter table public.campaigns
  add column if not exists claim_deadline_at timestamptz,
  add column if not exists escrow_contract_address text,
  add column if not exists escrow_campaign_key text,
  add column if not exists escrow_deposit_tx_hash text,
  add column if not exists escrow_funded_at timestamptz;

alter table public.user_claims
  add column if not exists payout_deadline_at timestamptz,
  add column if not exists payout_authorization_nonce text;

alter table public.raffles
  add column if not exists finalized_at timestamptz,
  add column if not exists claim_deadline_at timestamptz;

update public.campaigns
set claim_deadline_at = coalesce(
  claim_deadline_at,
  end_at + interval '72 hours',
  created_at + (duration_days || ' days')::interval + interval '72 hours',
  now() + interval '72 hours'
)
where claim_deadline_at is null;

update public.user_claims uc
set payout_deadline_at = coalesce(uc.payout_deadline_at, c.claim_deadline_at)
from public.campaigns c
where uc.campaign_id = c.id
  and uc.payout_deadline_at is null;

update public.raffles
set finalized_at = coalesce(finalized_at, updated_at, end_time, now()),
    claim_deadline_at = coalesce(claim_deadline_at, updated_at + interval '72 hours', end_time + interval '72 hours', now() + interval '72 hours')
where is_finalized = true
  and claim_deadline_at is null;

create table if not exists public.reward_claim_notifications (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  reward_type text not null check (reward_type in ('ugc_campaign', 'raffle_prize')),
  reward_id text not null,
  notification_date date not null default current_date,
  notification_kind text not null default 'daily_claim_reminder',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (wallet_address, reward_type, reward_id, notification_date, notification_kind)
);

alter table public.reward_claim_notifications enable row level security;

revoke all on table public.reward_claim_notifications from public, anon, authenticated;
grant all on table public.reward_claim_notifications to service_role;

notify pgrst, 'reload schema';
