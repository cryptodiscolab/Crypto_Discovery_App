-- Add non-social UGC platform used by on-chain/manual proof tasks.
insert into public.supported_platforms (code, name, api_provider, is_active)
values ('onchain', 'On-chain', 'manual', true)
on conflict (code) do update
set
    name = excluded.name,
    api_provider = excluded.api_provider,
    is_active = true;
