-- Avoid double-incrementing campaign participants.
-- user_claims.trg_check_quota already checks quota and increments current_participants.

create or replace function public.fn_join_campaign_atomic(
  p_campaign_id uuid,
  p_user_address text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_status text;
  v_existing_id uuid;
begin
  if p_campaign_id is null then
    return jsonb_build_object('success', false, 'error', 'CAMPAIGN_ID_REQUIRED');
  end if;

  if p_user_address is null or length(trim(p_user_address)) = 0 then
    return jsonb_build_object('success', false, 'error', 'USER_ADDRESS_REQUIRED');
  end if;

  select id into v_existing_id
  from public.user_claims
  where campaign_id = p_campaign_id
    and lower(user_address) = lower(trim(p_user_address))
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('success', false, 'error', 'Already joined');
  end if;

  select status
  into v_status
  from public.campaigns
  where id = p_campaign_id
  for update;

  if v_status is null then
    return jsonb_build_object('success', false, 'error', 'Campaign not found');
  end if;

  if v_status <> 'active' then
    return jsonb_build_object('success', false, 'error', 'Campaign is not active');
  end if;

  insert into public.user_claims (
    user_address,
    campaign_id,
    is_verified,
    is_claimed,
    payout_status,
    created_at
  ) values (
    lower(trim(p_user_address)),
    p_campaign_id,
    false,
    false,
    'joined',
    now()
  );

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.fn_join_campaign_atomic(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_join_campaign_atomic(uuid, text) to service_role;

notify pgrst, 'reload schema';
