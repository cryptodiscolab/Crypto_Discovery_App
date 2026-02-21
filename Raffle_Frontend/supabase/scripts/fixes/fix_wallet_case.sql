-- 1. Normalize existing wallet addresses
update user_profiles
set wallet_address = lower(wallet_address);

-- 2. Add unique constraint to prevent future duplicates (case-sensitive duplicates shouldn't exist after lower())
alter table user_profiles
add constraint unique_wallet unique (wallet_address);
