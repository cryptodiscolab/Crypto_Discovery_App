-- Add missing payment token mirror for UGC mission payment parity.
-- Frontend/API already send campaigns.payment_token for ETH/USDC verification.

alter table public.campaigns
  add column if not exists payment_token text;

comment on column public.campaigns.payment_token
  is 'Payment token used for UGC mission creation; zero address for native ETH, token address for ERC20 such as USDC.';

notify pgrst, 'reload schema';
