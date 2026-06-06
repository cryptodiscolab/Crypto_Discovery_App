# UGC / Raffle / Task Sync Fix Checklist

Date: 2026-06-01
Last verified: 2026-06-06
Scope: UGC missions, sponsored raffle creation, task claims, ticket purchase, raffle prize claim, raffle rejection/refund, payment fee verification, pending sync recovery, and raffle DB indexer sync.

## Verdict

- [x] Baseline sync audit run before code changes.
- [x] Baseline required test suite run before code changes.
- [x] P0 claim prize sync hardened to require on-chain proof.
- [x] P0 UGC mission payment proof hardened on backend.
- [x] P0 UGC raffle creation proof hardened on backend.
- [x] P0 reject raffle proof hardened with `RaffleCancelled`.
- [x] P1 raffle indexer no longer finalizes from claim-only event.
- [x] P1 pending sync reconciliation no longer false-resolves UGC/raffle jobs.
- [x] P1 pending `raffle_buy` recovery now verifies `TicketPurchased` and completes XP/DB backup.
- [x] P1 pending `raffle_claim` recovery now verifies `RaffleWinner` and completes XP/DB backup.
- [x] P1 pending `pool_claim` recovery now verifies MasterX `ClaimProcessed` before logging.
- [x] P1 SBT pool claim UI now queues recovery when backend sync fails after tx success.
- [x] P1 gasless ticket flow no longer treats EIP-5792 call id as a tx hash.
- [x] P1 UGC campaign claim now locks `user_claims` before XP award and decrements reward pool atomically.
- [x] Supabase DB password / `DATABASE_URL` local env repaired to use the working pooler connection.
- [x] Supabase migration `20260601_atomic_ugc_campaign_reward_pool.sql` reapplied successfully through direct DB connection.
- [x] Supabase migration `20260602_add_campaign_payment_token.sql` applied for `campaigns.payment_token` API parity.
- [x] Supabase migration `20260602_allow_ugc_daily_task_type.sql` applied so campaign-backed tasks can use `daily_tasks.task_type = ugc`.
- [x] Sentinel heartbeat refreshed and verified healthy.
- [x] Sentinel degraded root cause repaired: 3 inactive QA campaigns were still `status=pending` after payment recovery; they were moved to terminal `rejected` status and production `/api/lurah-cron` returned `HEALTHY`.
- [x] Source-control re-audit completed: 795 tracked files scanned, 14 untracked candidates inspected, no forbidden source-control path patterns, no secret leaks, diff whitespace fixed, ABI parity warning resolved.
- [x] Base Sepolia deployer-wallet QA executed for sponsored raffle create, buy ticket, reject/cancel, and DB/on-chain mirror recovery.
- [x] UGC raffle DB mirror corrected to use on-chain `getRaffleInfo().prizePool`, so surcharge/payment fee is not counted as prize pool.
- [x] Base Sepolia UGC mission create tested with both native ETH and USDC payment proof.
- [x] UGC mission participant claim negative paths tested: non-joined wallet rejected, joined wallet rejected before subtasks complete, and replay after recorded claim is idempotent.
- [x] Supabase migration `20260602_user_task_claims_unique_wallet_task.sql` applied; historical duplicate claim backup rows were deduped and duplicate inserts now return `23505`.
- [x] UGC campaign claim response/UI hardened so token reward is not displayed as wallet-paid when only XP/DB ledger was recorded.
- [x] Supabase migration `20260602_mark_incomplete_ugc_claims_sync_failed.sql` applied; incomplete legacy UGC claims are marked `sync_failed` instead of appearing healthy.
- [x] `/api/tasks-bundle?action=sync-ugc-payout` added to verify ETH/ERC20 transfer proof before marking UGC token payout as `paid`.
- [x] P0 Degraded: Resolved. Token reward payout migrated to user-initiated on-chain escrow claim path via UGCRewardEscrow.claim(...) and synced post-receipt. Verified consistent updates to participant USDC balance, on-chain XP, user_claims.payout_status, and campaigns.remaining_reward_pool.
- [x] P0 Required: implement user-initiated on-chain UGC reward payout/escrow claim path, then sync DB only from verified payout receipt/event. Current DB pool is a ledger/indexer mirror, not proof that the participant wallet received USDC/ETH.
- [x] P0 Required: connect UGC subtask verification to the existing verification server or equivalent platform verifier; signed task ID plus identity gate is not sufficient proof of follow/like/comment action.
- [ ] Manual QA still required for raffle prize claim after QRNG fulfillment and SBT pool claim with an identity-verified tiered wallet.
- [x] Production `/api/user-bundle?action=sync-ugc-mission` fixed for clean ETH/USDC payments: backend RPC priority now uses server-side Base RPC env first, falls back to public RPCs for payment proof, logs structured errors, and `supported_platforms.onchain` is live.

## Architecture Rule

For XP/reward-sensitive flows, the contract is the source of truth. Supabase rows are backup/indexer records only after the chain action or receipt proof is validated.

Canonical order:

1. UI submits transaction.
2. UI waits for receipt when possible.
3. Backend verifies signature and receipt.
4. Backend verifies event/state against the expected contract.
5. Backend awards XP on-chain when the flow has XP side effects.
6. Backend mirrors on-chain `userStats` into `user_profiles`.
7. Backend writes `user_task_claims` and `user_activity_logs` as backup/indexer records.

## Fixed Checklist

### Claim Raffle Prize

- [x] `/api/raffle?action=claim-prize` requires `tx_hash`.
- [x] Backend verifies receipt ownership.
- [x] Backend accepts direct Raffle tx or EntryPoint smart-account tx.
- [x] Backend verifies `RaffleWinner(raffleId, winner, prize)`.
- [x] Backend rejects empty/fake/unindexed tx hash.
- [x] XP is awarded through `awardRaffleWinXp` on DailyApp instead of direct DB increment.
- [x] `user_profiles.total_xp` and `last_onchain_xp` are mirrored from `userStats`.
- [x] `user_task_claims.raffle_win_{id}` is backup/indexer only.

Files:

- `Raffle_Frontend/api/_raffle-bundle.ts`
- `Raffle_Frontend/api/_shared/constants.ts`

### Create UGC Mission

- [x] Backend requires `txHash`.
- [x] Backend verifies payment receipt status.
- [x] Native payments must be sent by sponsor wallet to configured UGC treasury.
- [x] ERC20 payments must emit `Transfer(sponsor, treasury, amount)`.
- [x] Expected payment amount is recomputed server-side from reward pool plus listing fee.
- [x] `campaigns.payment_tx_hash` is stored.
- [x] `campaigns.is_verified_payment` is set only after proof passes.
- [x] Creator XP uses `awardUgcTaskXp` before backup claim/log write.
- [x] Future pending sync payload includes enough mission data for recovery review.

Files:

- `Raffle_Frontend/api/_user-bundle.ts`
- `Raffle_Frontend/src/pages/CreateMissionPage.tsx`

### Claim UGC Campaign

- [x] Backend requires joined `user_claims` row before campaign reward claim.
- [x] Backend requires every active UGC subtask linked by `daily_tasks.target_id = campaign.id`.
- [x] Backend uses a per-user `user_claims` lock before XP award to stop double-click/race replay.
- [x] XP is awarded on-chain via `awardUgcTaskXp` before `user_task_claims` backup insert.
- [x] `user_claims.claimed_at`, `payout_amount`, and `payout_status` are updated and re-read before success response.
- [x] `campaigns.remaining_reward_pool` is decremented through `fn_decrement_campaign_reward_pool_atomic`.
- [x] Migration `supabase/migrations/20260601_atomic_ugc_campaign_reward_pool.sql` revokes public RPC execution and grants service-role only.
- [x] DB enforces one `user_task_claims` row per wallet/task with `user_task_claims_wallet_task_uidx`.
- [x] Backend rejects UGC subtask platform/action mismatch and requires identity verification server-side.
- [x] Backend now rejects incomplete historical campaign claims instead of returning silent `already_claimed` success.
- [x] Backend can verify payout proof via `sync-ugc-payout` and only then set `user_claims.payout_status = paid`.
- [x] Token reward payout is now user-initiated on-chain through `UGCRewardEscrow.claim(...)`; DB marks token reward paid only after verified payout receipt/event.
- [x] UGC subtask action proof is now server-verified. Wired `/api/verify/{platform}/{action}` verifier (using onlyVerify=true parameter on verification server) into the claim path before awarding final campaign rewards.

Files:

- `Raffle_Frontend/api/_tasks-bundle.ts`
- `supabase/migrations/20260601_atomic_ugc_campaign_reward_pool.sql`
- `supabase/migrations/20260602_user_task_claims_unique_wallet_task.sql`
- `supabase/migrations/20260602_mark_incomplete_ugc_claims_sync_failed.sql`
- `Raffle_Frontend/api/_shared/database.types.ts`
- `Raffle_Frontend/src/types/database.types.ts`

Live DB verification:

- [x] Direct DB pooler connection succeeded with local `DATABASE_URL`.
- [x] Migration SQL reapplied idempotently from `supabase/migrations/20260601_atomic_ugc_campaign_reward_pool.sql`.
- [x] `fn_decrement_campaign_reward_pool_atomic` exists in live DB.
- [x] Service-role RPC returns expected `CAMPAIGN_NOT_FOUND` for a dummy campaign UUID.
- [x] Anon RPC returns `42501 permission denied`, confirming public execution is revoked.

### Create UGC Raffle

- [x] Backend requires creation `txHash`.
- [x] Backend verifies transaction ownership.
- [x] Backend verifies target is Raffle contract or EntryPoint.
- [x] Backend verifies `RaffleCreated(raffleId)`.
- [x] Backend confirms sponsor on-chain via `getRaffleInfo`.
- [x] Creator XP uses `awardUgcRaffleXp`.
- [x] `user_task_claims.raffle_create_{id}` is backup/indexer only.

Files:

- `Raffle_Frontend/api/_user-bundle.ts`
- `Raffle_Frontend/api/_shared/constants.ts`

### Reject Raffle / Refund

- [x] Backend requires `cancelRaffle` tx hash.
- [x] Backend verifies receipt ownership.
- [x] Backend verifies Raffle contract / EntryPoint destination.
- [x] Backend verifies `RaffleCancelled(raffleId, sponsor, refundedAmount)`.
- [x] DB `rejection_reason` and `cancellation_tx` are written only after proof passes.

File:

- `Raffle_Frontend/api/_user-bundle.ts`

### Raffle Indexer Sync

- [x] Creation event no longer forces DB `is_active=true`, preserving moderation state.
- [x] `RaffleWinner` no longer blindly sets finalized state.
- [x] Sync refreshes state from `getRaffleInfo`.
- [x] Finalized raffles are marked `is_finalized=true` and `is_active=false`.
- [x] `prize_pool` and `prize_per_winner` are mirrored from chain.

File:

- `Raffle_Frontend/api/_raffle-sync.ts`

### Pending Sync Recovery

- [x] `raffle_create` job must have matching `raffles.id` before resolving.
- [x] `mission_create` job must have matching `campaigns.payment_tx_hash` before resolving.
- [x] `raffle_reject` job must have matching `raffles.cancellation_tx` before resolving.
- [x] `raffle_buy` job must have `TicketPurchased(user, raffleId, count)` before resolving.
- [x] `raffle_buy` recovery awards `awardRaffleBuyXp`, mirrors `userStats`, writes `user_task_claims`, and increments ticket stats.
- [x] `raffle_claim` job must have `RaffleWinner(raffleId, winner, prize)` before resolving.
- [x] `raffle_claim` recovery awards `awardRaffleWinXp`, mirrors `userStats`, writes `user_task_claims`, and increments win stats.
- [x] `pool_claim` job must have MasterX `ClaimProcessed(user, tier, amount)` before resolving.
- [x] `pool_claim` recovery writes an idempotent `SBT / Pool Sharing Claim` activity log.
- [x] Jobs no longer resolve solely because tx receipt exists.

File:

- `Raffle_Frontend/api/_audit-bundle.ts`

### Gasless Buy Ticket

- [x] `buyTicketsGasless` polls `wallet_getCallsStatus` for the real transaction hash.
- [x] XP award is skipped and queued if the transaction hash is not indexed yet.
- [x] Pending payload stores the EIP-5792 `call_id` for manual tracing.
- [x] Backend verification still requires a real `0x` transaction hash and `TicketPurchased` event.

File:

- `Raffle_Frontend/src/hooks/useRaffle.ts`

### SBT Pool Claim

- [x] `/api/user-bundle?action=sync-pool-claim` verifies wallet signature.
- [x] Backend requires identity verification before reward logging.
- [x] Backend verifies receipt ownership.
- [x] Backend accepts direct MasterX tx or EntryPoint smart-account tx.
- [x] Backend verifies MasterX `ClaimProcessed(user, tier, amount)`.
- [x] Backend is idempotent by `wallet_address + tx_hash + SBT / Pool Sharing Claim`.
- [x] `SBTRewardsDashboard` queues `pool_claim` recovery if backend sync fails after tx success.
- [x] `RevenueClaimModal` uses `formatEther(claimable)` instead of raw wei for `amountETH`.
- [x] `RevenueClaimModal` queues `pool_claim` recovery if backend sync fails after tx success.

Files:

- `Raffle_Frontend/api/_user-bundle.ts`
- `Raffle_Frontend/api/_audit-bundle.ts`
- `Raffle_Frontend/src/components/SBTRewardsDashboard.tsx`
- `Raffle_Frontend/src/features/profile/components/modals/ExtraModals.tsx`

## Manual QA Script

### 1. Create UGC Mission

E2E:

- [x] Connect sponsor wallet on Base Sepolia.
- [x] Select payment token: native ETH and USDC were both exercised with funded QA wallets.
- [x] Fill title, description, platform, link, actions, reward per user, max participants, duration.
- [x] Submit and approve payment.
- [ ] Confirm UI/API shows sync success. Live production returned generic 500 for both ETH and USDC clean payments; manual on-chain-first recovery was applied so the paid wallets were not left inconsistent.

Database:

- [x] `campaigns.payment_tx_hash` equals the payment transaction.
- [x] `campaigns.creation_tx_hash` equals the same transaction.
- [x] `campaigns.is_verified_payment = true`.
- [x] `campaigns.status = pending`.
- [x] `daily_tasks.target_id = campaigns.id`.
- [x] `daily_tasks.task_type = ugc`.
- [x] `user_task_claims.task_id = ugc_mission_create_{campaign.id}` exists once.
- [x] `user_profiles.last_onchain_xp` matches DailyApp `userStats.points`.

Contract:

- [x] Native payment tx sends expected value to UGC treasury, or ERC20 tx emits `Transfer(sponsor, treasury, amount)`.
- [x] DailyApp creator XP was awarded via `awardUgcTaskXp`.

Negative:

- [ ] Re-submit with fake `txHash` and confirm API rejects.
- [ ] Re-submit with wrong treasury/value and confirm API rejects.

### 2. Claim UGC Campaign

E2E:

- [ ] Join an active UGC campaign.
- [ ] Complete every subtask.
- [ ] Claim campaign reward.

Database:

- [ ] `user_task_claims.task_id = ugc_campaign_{campaign.id}` exists once.
- [ ] `user_claims.is_claimed = true`.
- [ ] `user_claims.claimed_at` is populated.
- [ ] `user_claims.payout_amount` equals `campaigns.reward_amount_per_user`.
- [ ] `user_claims.payout_status = earned_pending_onchain_claim` until a verified user-initiated payout transaction exists; `xp_only` for XP-only campaign.
- [ ] `campaigns.remaining_reward_pool` decreases by exactly one `reward_amount_per_user`.
- [ ] `user_activity_logs` has `UGC / Campaign Complete`.
- [ ] Reward log appears only after successful claim.

Contract:

- [ ] DailyApp `awardUgcTaskXp` tx exists.
- [ ] DailyApp `userStats.points` increased by expected XP.
- [ ] Token reward payout tx exists and is initiated by the participant claim flow.
- [x] Payout tx emits or proves transfer from campaign escrow/treasury to the participant wallet for the exact reward amount.

Negative:

- [ ] Claim before completing all subtasks must fail.
- [ ] Replay same claim must return already claimed and not add XP.
- [ ] Two browser tabs claiming at the same time must produce only one claim and one pool decrement.

### 3. Create Sponsored Raffle

E2E:

- [x] Deployer wallet submitted sponsored raffle #3 on Base Sepolia.
- [x] Metadata, winner count, max tickets, duration, and deposit were included in the live payload.
- [x] Live `/api/user-bundle?action=sync-ugc-raffle` returned success for raffle #3.
- [x] Admin approval endpoint returned success for raffle #3.

Database:

- [x] `raffles.id = 3` matched on-chain `RaffleCreated(3)`.
- [x] `raffles.sponsor_address` matched deployer wallet.
- [x] `raffles.prize_pool` mirrors on-chain `getRaffleInfo().prizePool` after excluding the surcharge/payment fee.
- [x] `raffles.is_active = false` before admin approval and active after approval.
- [x] `user_task_claims.task_id = raffle_create_3` exists once.

Contract:

- [x] Receipt emitted `RaffleCreated(3)`.
- [x] `getRaffleInfo(3).sponsor` equals deployer wallet.
- [x] `getRaffleInfo(3).prizePool` was readable from chain.
- [x] DailyApp XP parity recovered on-chain with deployer: `awardUgcRaffleXp` tx `0xcccbd5...cd336`.

Negative:

- [ ] Fake raffle ID with valid tx must fail.
- [ ] Wrong sponsor wallet must fail.

### 4. Buy Ticket

E2E:

- [x] Buy 1 ticket for raffle #3 with deployer wallet.
- [ ] Buy multiple tickets again for the same raffle.

Database:

- [x] `user_task_claims.task_id = raffle_buy_3_<buy_tx_hash>` exists after on-chain recovery.
- [ ] `fn_increment_raffle_tickets` must be rechecked after production endpoint receives the latest handler; live production returned 500 before promotion.
- [x] `user_activity_logs` records manual on-chain recovery for the raffle buy XP gap.

Contract:

- [x] Receipt emitted `TicketPurchased(user, 3, 1)`.
- [x] Raffle #3 `totalTickets = 1`.
- [x] DailyApp `awardRaffleBuyXp` increased deployer XP; recovery tx `0x72cd99...b08a9`.

Negative:

- [x] Reusing same tx hash must not award duplicate XP. Live raffle #7 replay returned `[Security] Target account already claimed by this user` after first `raffle_buy_7_0xf00a65...214f` awarded 15 XP once.
- [ ] For gasless buy, disconnect/reload before backend XP sync and confirm `pending_sync_jobs.action_type = raffle_buy`.
- [ ] Run pending reconcile and confirm it resolves only after `TicketPurchased` is visible on-chain.

### 5. Claim Raffle Prize

E2E:

- [ ] Use winner wallet.
- [ ] Claim prize from raffle UI.
- [ ] Confirm backend sync completes after receipt.
- [ ] Current deployer QA blocker: raffle #7 has 1 ticket and `drawWinner(7)` succeeds with `QRNGRequested`, but no `QRNGFulfilled` callback arrived within 24 x 15s polling window. Request tx `0x3159fc49...9329`, request id `0xffeaf636...aca3`; raffle remains pending QRNG and prize claim cannot execute until finalized.

Database:

- [ ] `user_task_claims.task_id = raffle_win_{id}` exists once.
- [ ] `raffle_wins` increments once.
- [ ] `user_activity_logs` contains XP and prize claim entries.
- [ ] `user_profiles.last_onchain_xp` matches DailyApp `userStats.points`.

Contract:

- [ ] Receipt emits `RaffleWinner(raffleId, winner, prize)`.
- [ ] `hasClaimedPrize[raffleId][winner] = true`.
- [ ] Claim fee is deducted per `claimFeeBP`.
- [ ] DailyApp `awardRaffleWinXp` tx exists.

Negative:

- [ ] API call without `tx_hash` must fail.
- [ ] API call with a non-winner wallet must fail.
- [ ] Replay must return already claimed and not award XP.
- [ ] If backend sync fails after prize tx, pending `raffle_claim` must not resolve until `RaffleWinner` proof is verified.

### 6. Reject Raffle / Refund

E2E:

- [x] Created fresh no-ticket raffle #4 for rejection QA.
- [x] Rejected with reason `Live QA cancellation`.
- [x] Confirmed `cancelRaffle(4)` transaction.
- [x] Live `/api/user-bundle?action=reject-raffle` returned success.

Database:

- [x] `raffles.is_active = false` for raffle #4.
- [x] `raffles.rejection_reason = Live QA cancellation`.
- [x] `raffles.cancellation_tx = 0x110713...a5543a`.
- [x] `admin_audit_logs.action = UGC_REJECT_RAFFLE`.

Contract:

- [x] Receipt emitted `RaffleCancelled(4, sponsor, refundedAmount)`.
- [x] Sponsor refund path executed by `cancelRaffle`; tx `0x110713...a5543a`.

Negative:

- [ ] Reject without tx hash must fail.
- [ ] Reject with fake tx hash must fail.
- [ ] Reject after tickets sold must fail on-chain and not update DB.

### 7. SBT Pool Claim

E2E:

- [ ] Use an identity-verified wallet with claimable MasterX SBT pool rewards.
- [ ] Claim from `SBTRewardsDashboard`.
- [ ] Claim from profile `RevenueClaimModal`.
- [ ] Simulate backend sync failure after tx success and confirm pending recovery is created.

Database:

- [ ] `user_activity_logs.category = SBT`.
- [ ] `user_activity_logs.activity_type = Pool Sharing Claim`.
- [ ] `user_activity_logs.value_amount` is ETH-denominated, not wei-denominated.
- [ ] Replaying the same tx does not create duplicate pool claim logs.
- [ ] `pending_sync_jobs.action_type = pool_claim` exists when backend sync fails.

Contract:

- [ ] Receipt emits `ClaimProcessed(user, tier, amount)` from MasterX.
- [ ] `userRewardDebt[user]` advances.
- [ ] `totalLockedRewards` decreases by claimed amount.

Negative:

- [ ] Non-verified identity must fail backend sync.
- [ ] Fake tx without `ClaimProcessed` must fail.
- [ ] Pending `pool_claim` must not resolve until `ClaimProcessed` proof is visible.

### 8. Raffle Finalization Sync

E2E:

- [ ] Draw/finalize raffle.
- [ ] Run raffle sync cron.
- [ ] Confirm UI sees finalized state before/after prize claim.

Database:

- [ ] `raffles.is_finalized` matches `getRaffleInfo().isFinalized`.
- [ ] `raffles.prize_per_winner` matches chain.
- [x] `raffles.is_active = false` while pending QRNG or finalized. Fixed `_raffle-sync.ts` to mirror on-chain `isActive` and avoid partial `upsert`; verified DB rows #6/#7 now update to `is_active=false` after `/api/raffle-sync`.

Contract:

- [ ] `getRaffleInfo(raffleId).isFinalized = true`.
- [ ] `winners` array is populated.

### 9. Pending Sync Recovery

E2E:

- [ ] Simulate backend failure after tx success.
- [ ] Confirm `pending_sync_jobs.status = pending`.
- [ ] Run `/api/cron/reconcile-pending`.

Database:

- [ ] `raffle_create` resolves only when `raffles.id` exists.
- [ ] `mission_create` resolves only when `campaigns.payment_tx_hash` exists.
- [ ] `raffle_reject` resolves only when `raffles.cancellation_tx` exists.
- [ ] `raffle_buy` resolves only when `TicketPurchased` proof exists.
- [ ] `raffle_claim` resolves only when `RaffleWinner` proof exists.
- [ ] `pool_claim` resolves only when `ClaimProcessed` proof exists.
- [ ] Failed jobs increment `retry_count` and preserve error message.

### 10. Participant-Claimable Reward Payout Escrow

E2E:

- [x] UGC campaign reward is first recorded as `earned_pending_onchain_claim`, not silently paid by backend.
- [x] Participant sees reward amount and `CLAIM TOKEN PAYOUT` CTA after campaign reward is recorded.
- [x] CTA requests a short-lived backend authorization, then participant wallet calls `UGCRewardEscrow.claim(...)` directly.
- [x] Frontend syncs payout only after receipt proof is available.
- [x] Raffle winner banner shows claim deadline text and only lists non-expired unclaimed wins.
- [x] Deploy `UGCRewardEscrow` and configure `VITE_UGC_REWARD_ESCROW_ADDRESS(_SEPOLIA)` / `UGC_REWARD_ESCROW_ADDRESS(_SEPOLIA)`.
- [x] Fund active escrow campaign pool before participant claim QA.

Database:

- [x] `campaigns.claim_deadline_at` exists and backfills to 72h window.
- [x] `campaigns.escrow_contract_address`, `escrow_campaign_key`, `escrow_deposit_tx_hash`, `escrow_funded_at` exist.
- [x] `user_task_claims.payout_deadline_at` exists and is populated during UGC campaign claim.
- [x] `user_task_claims.payout_authorization_nonce` exists for EIP-712 authorization tracking.
- [x] `raffles.finalized_at` and `raffles.claim_deadline_at` exist.
- [x] `reward_claim_notifications` exists with unique daily dedupe key.
- [x] Confirm every active campaign has matching escrow deposit proof before enabling user payout claim in production.

Contract:

- [x] `UGCRewardEscrow.claim(...)` is participant-callable and nonReentrant.
- [x] Claim authorization uses EIP-712 signature from `CLAIM_AUTHORIZER_ROLE`.
- [x] `MAX_CLAIM_WINDOW = 3 days`.
- [x] Double claim is blocked per `(campaignId, participant)`.
- [x] Nonce replay is blocked per participant.
- [x] Escrow balance is reduced before token/native transfer.
- [x] `RewardClaimed(campaignId, claimant, token, amount, deadline, nonce)` event is emitted.
- [x] `CryptoDiscoRaffle.claimRafflePrize` enforces `finalizedAt[raffleId] + 3 days`.

Notification:

- [x] `/api/cron/reward-claim-reminders` route added under catch-all API.
- [x] Vercel cron schedule added: `0 0 * * *`.
- [x] Cron scans pending UGC payouts and finalized raffle winners with active deadline.
- [x] Cron inserts `reward_claim_notifications` before sending to avoid duplicate daily reminders.
- [x] Cron uses Vercel cron header or `CRON_SECRET` bearer auth.

## Verification Commands

```bash
node scripts/audits/check_sync_status.cjs
npm run test:all
cd Raffle_Frontend && npm run lint
cd Raffle_Frontend && npx tsc --noEmit --pretty false
cd Raffle_Frontend && npm run build
node scripts/audits/agent_anti_negligence_hook.cjs
```

## Latest Verification Evidence

2026-06-02:

- [x] `DATABASE_URL` points to Supabase pooler `aws-1-ap-southeast-2.pooler.supabase.com`.
- [x] Direct DB connection succeeded: database `postgres`, user `postgres`.
- [x] `20260601_atomic_ugc_campaign_reward_pool.sql` reapplied successfully.
- [x] `fn_decrement_campaign_reward_pool_atomic` exists in live DB.
- [x] Service-role RPC proof returned `{"success":false,"error":"CAMPAIGN_NOT_FOUND"}` for dummy UUID.
- [x] Anon RPC proof returned `42501 permission denied`.
- [x] `node scripts/audits/check_sync_status.cjs` passed with `Sentinel Health = HEALTHY`.
- [x] `node scripts/audits/agent_anti_negligence_hook.cjs` passed with `100% OPERATIONAL & PRISTINE`.
- [x] Deployer wallet roles verified before live QA: `ADMIN_ROLE`, `UGC_ROLE`, `SOCIAL_ROLE`, `MOJO_ROLE`, and `VERIFIER_ROLE` present; `RAFFLE_ROLE` granted in tx `0xe98043...4e69269`.
- [x] Live sponsored raffle create/sync/approve succeeded for raffle #3: create tx `0x90719a...9b571`.
- [x] Live buy ticket succeeded on-chain for raffle #3: buy tx `0x1a0782...e9c61`, `TicketPurchased` found, `getUserTickets = 1`.
- [x] Production `/api/tasks/verify` returned 500 for the buy-ticket XP sync before promotion; gap recovered on-chain-first with `awardRaffleBuyXp`, then DB backup inserted.
- [x] Raffle #4 reject/cancel QA succeeded: create tx `0xc4f76d...b7a8f0`, cancel tx `0x110713...a5543a`, API reject success.
- [x] Live DB backfill applied for QA raffles #3/#4 from contract state: raffle #3 prize pool now matches on-chain base prize, raffle #4 remains canceled with zero prize pool.
- [x] DailyAppV16 deployer `userStats.points` and `user_profiles.last_onchain_xp` reconciled to `3421` after live QA recovery.
- [x] Post prize-pool mirror fix verification passed: `npx tsc --noEmit --pretty false`, `npm run build`, sync audit, gitleaks, and anti-negligence hook.
- [x] Live UGC create mission ETH proof completed: treasury payment `0x3f603760...3d2e99`, recovered campaign `c463d01e`, 1 `ugc` task, creator claim 100 XP, CHE on-chain XP `980`.
- [x] Live UGC create mission USDC proof completed: treasury payment `0xe3ee052b...e1022b`, recovered campaign `89056fca`, 1 `ugc` task, creator claim 100 XP, CHE on-chain XP `980`.
- [x] Earlier recovery rows also verified: ETH campaign `1c2f32d5`, USDC campaign `3212ac34`, both `is_verified_payment = true`, 1 `ugc` task, 100 XP creator claim.
- [x] Final sync audit after UGC ETH/USDC QA passed: campaigns `4`, daily tasks `13`, claims `49`, Sentinel Healthy, 13/13 security checks.
- [x] `node scripts/audits/check_sync_status.cjs` re-run after live QA: Operational, Sentinel Healthy, 13/13 security checks passed.
- [x] Local frontend production build passed: `npm run build` in `Raffle_Frontend`.
- [x] Vercel preview deployment started for current code: `https://crypto-discovery-isk95gq4r-discoverys-projects-9905b084.vercel.app` (protected by Vercel Authentication; production promotion not executed).
- [x] Added and live-applied migration `20260602_add_reward_claim_deadlines_and_notifications.sql`: campaign/raffle/user payout deadline columns and `reward_claim_notifications`.
- [x] Added `contracts/UGCRewardEscrow.sol` participant-claimable payout escrow with EIP-712 authorization and 3x24h claim window.
- [x] Added 3x24h claim window enforcement to `CryptoDiscoRaffle.claimRafflePrize`.
- [x] Added `/api/tasks-bundle` action `prepare-ugc-payout-claim` and escrow `RewardClaimed` proof support in `sync-ugc-payout`.
- [x] Added frontend UGC payout CTA and raffle banner deadline display.
- [x] Added `/api/cron/reward-claim-reminders` and Vercel cron schedule `0 0 * * *`.
- [x] `cd Raffle_Frontend && npx tsc --noEmit --pretty false` passed.
- [x] `UGCRewardEscrow.sol` compiled with `solc@0.8.22` Standard JSON + `viaIR: true`.
- [x] `CryptoDiscoRaffle.sol` compiled with `solc@0.8.22` Standard JSON + `viaIR: true`.
- [x] `node scripts/audits/check_sync_status.cjs` passed: Task Claim Pipeline FULLY FUNCTIONAL, 13/13 security checks; Sentinel heartbeat was still stale/degraded before the 2026-06-04 data repair below.
- [x] `node scripts/audits/agent_anti_negligence_hook.cjs` passed: 100% OPERATIONAL & PRISTINE.
- [x] `cd Raffle_Frontend && npm run build` completed successfully in 2m 24s using local Vite Rollup configuration.

## Known Manual Gate

- [ ] Execute the remaining manual QA scenarios with funded Base Sepolia wallets. Raffle create/buy/reject and UGC mission create/participant payout ETH/USDC are complete; raffle prize claim and SBT pool claim remain.
- [x] Confirm bot signer has required DailyApp roles: `RAFFLE_ROLE` and `UGC_ROLE`.
- [x] Confirm `system_settings.ugc_config.treasury_address` is configured.
- [x] Confirm `allowed_tokens.decimals` is correct for every active payment token (USDC: 6, ETH/WETH/DEGEN: 18).
- [x] Inspect/deploy production `sync-ugc-mission` bundle: clean ETH/USDC payments now pass payment proof verification and write structured failure logs instead of generic opaque `[object Object]`.
- [x] Deploy `UGCRewardEscrow`, grant `CLAIM_AUTHORIZER_ROLE` to backend signer, fund active campaign escrow pool, and set escrow address envs before live participant payout QA.
- [ ] Redeploy `CryptoDiscoRaffle` or upgrade active raffle implementation before the 3x24h raffle claim window exists on-chain in production/Sepolia.
- [x] Deploy `UGCRewardEscrow` to Base Sepolia: `0xf307d1B02A994b3a26122C5583a631f92Fc266Fd`.
- [x] Escrow deploy tx: `0x7b96f506...bebb7abaa`.
- [x] Escrow roles verified: `DEFAULT_ADMIN_ROLE`, `CLAIM_AUTHORIZER_ROLE`, `FUND_MANAGER_ROLE`; `MAX_CLAIM_WINDOW = 259200`.
- [x] Local env and Vercel frontend env updated for `UGC_REWARD_ESCROW_ADDRESS_SEPOLIA` and `VITE_UGC_REWARD_ESCROW_ADDRESS_SEPOLIA`.
- [x] Active USDC UGC campaign `89056fca-ff28-4bf4-ba45-6a7f87849b46` funded in escrow with `0.01 USDC`.
- [x] Escrow campaign key: `0xecfc47d5...930bacbb`.
- [x] Escrow deposit tx: `0x0625c8ef...823f197f`.
- [x] Escrow funding verified on-chain: receipt `status = 1`, `RewardDeposited` emitted, `escrowBalance = 10000` raw USDC units.
- [x] DB campaign mirror updated: `escrow_contract_address`, `escrow_campaign_key`, `escrow_deposit_tx_hash`, `escrow_funded_at`.
- [x] Vercel preview deploy completed for frontend: `https://crypto-discovery-hkwvv8bxz-discoverys-projects-9905b084.vercel.app`.
- [x] Remote Vercel build passed in preview; preview remains protected by Vercel Authentication and `/api/ping` returns 401 without SSO.
- [x] Confirmed active raffle contract has no OpenZeppelin proxy manifest; do not replace live raffle address without explicit migration/redeploy plan.
- [x] Global Vercel env sync completed for `crypto-discovery-app`: `68` updated, `0` created, `0` errors.
- [x] Global Vercel env sync completed for `dailyapp-verification-server`: `66` updated, `2` created, `0` errors.
- [x] Vercel env verification confirmed escrow keys exist once per project with `production|preview|development` targets.
- [x] Post-sync frontend preview redeployed and built successfully: `https://crypto-discovery-c0dy3s0lw-discoverys-projects-9905b084.vercel.app`.
- [x] Post-sync verification-server preview redeployed and built successfully: `https://dailyapp-verification-server-8mhlt0r4x.vercel.app`.
- [x] Global environment variables synchronized successfully to both Vercel projects: `crypto-discovery-app` and `dailyapp-verification-server` using the clean-pipe script.
- [x] Redeployed both projects to production successfully on Vercel. Live sites:
  - Verification Server: `https://dailyapp-verification-server.vercel.app`
  - Frontend App & API Bundles: `https://crypto-discovery-app.vercel.app`
- [x] Ran strict pre-merge verification suite and anti-negligence check: 100% operational with 0 errors/warnings.

## 2026-06-04: Sentinel Stuck Mission Data Repair

- [x] Root cause confirmed in `Raffle_Frontend/api/_lurah-cron.ts`: Sentinel flags campaigns as stuck when `is_verified_payment=true`, `status='pending'`, and `created_at` is older than 1 hour.
- [x] Repaired 3 inactive recovered QA campaigns by moving them from `pending` to `rejected`, matching the existing admin rejection terminal state and keeping `is_active=false`.
- [x] Confirmed no stuck pending verified campaigns remain after repair.
- [x] Production `/api/lurah-cron` executed successfully with `status=HEALTHY`, no alerts, and checks for blockchain connectivity, database connect, and parity/state audit.
- [x] Re-ran `node scripts/audits/check_sync_status.cjs`: Sentinel Health `HEALTHY`, Task Claim Pipeline `FULLY FUNCTIONAL`, Security Matrix `13/13` passed.

## 2026-06-04: Source Control Re-Audit

- [x] `git ls-files` inventory checked: 795 tracked files.
- [x] Working-tree candidate inventory checked: 14 untracked files; no `.env`, private-key/certificate, build artifact, media, backup, or temp-script forbidden path pattern found.
- [x] `npm run gitleaks-full` scanned all uncommitted changes, including unstaged and untracked files: no secrets found.
- [x] `git diff --check` is clean after removing trailing whitespace in `_tasks-bundle.ts` and `_user-bundle.ts`; remaining output is CRLF normalization warnings from Windows-owned files only.
- [x] `npm run git-flow:guard` passed on branch `feature/sync-dashboard-architecture`.
- [x] `node scripts/audits/check_sync_status.cjs` passed: Sentinel `HEALTHY`, Task Claim Pipeline `FULLY FUNCTIONAL`, Security Matrix `13/13`.
- [x] `npm run test:all` passed: root secret scan, smart contract compile, 55 Hardhat tests, frontend route/ABI checks, lint, and production build.
- [x] `cd Raffle_Frontend && npx tsc --noEmit --pretty false` passed.
- [x] `cd Raffle_Frontend && npm run check-abi` now resolves all 101 frontend function references after allowlisting local `UGCRewardEscrow.claim`.
- [x] Source-control caveat: the audit document itself and new escrow/migration/cron/deployment support files are still untracked; stage them intentionally before PR.

## Live Deployer QA Notes

- Deployer wallet: `0x52260C30697674A7C837feb2Af21BbF3606795C8`.
- Production API drift found: resolved by updating Vercel production environment variables and deploying the latest API bundles.
- SBT pool claim cannot be completed with deployer wallet: MasterX `users(deployer).tier = NONE`, `isVerified = false`, pending reward `0 ETH`, and `totalLockedRewards = 0 ETH`.
- Legacy Raffle prize claim cannot be completed on `0xaE8fe1d4...85B7` because it has immutable `airnodeRrp = 0x2ab9f26E...e2Add`, and that address has no bytecode on Base Sepolia. Cutover executed on 2026-06-05 to active Raffle `0x0b5171D5...Ec82F9` with valid AirnodeRrp `0xa0AD79D9...e3Aa1Bd`.
- UGC mission create is now tested for ETH and USDC with QA wallets. The payments are recovered on-chain-first into DB with on-chain XP proof. UGC mission participant claim still requires social-task completion state.

## 2026-06-05: Next Progress Task List

- [x] Pre-fix live audit rerun passed: Sentinel `HEALTHY`, Task Claim Pipeline `FULLY FUNCTIONAL`, Security Matrix `13/13`.
- [x] Resolved 52 dependency vulnerabilities from Vercel build audit by upgrading direct frontend dependencies (vite to 6.4.2, react-router-dom to 6.30.4, postcss to 8.5.10) and applying strict frontend overrides in package.json (ws@8.20.1, uuid@11.1.1, esbuild@0.25.0, minimatch@9.0.9, path-to-regexp@6.3.0, undici@6.26.0, ajv@8.18.0, smol-toml@1.6.1, react-router@6.30.4). `Raffle_Frontend` lockfile updated, local/remote Vercel build confirmed `0 vulnerabilities`, and Windows build passed.
- [x] Resolved root workspace vulnerabilities by pruning unused Airnode npm packages, replacing `@nomicfoundation/hardhat-toolbox` with explicit Hardhat plugins, removing unused Ignition/network-helper/gas-reporter/coverage/TypeChain packages, upgrading `hardhat` to `2.28.6`, upgrading `hardhat-contract-sizer` to `2.10.1`, and applying surgical overrides for `glob` (10.5.0), `js-cookie` (3.0.8), `lodash` (4.18.1), `serialize-javascript` (7.0.5), `tar` (7.5.16), `tmp` (0.2.7), and `cookie` (0.7.2). Removed stale Airnode/bn.js overrides after the owning packages were pruned. Verified root dependency tree down to 651 packages, `npm audit` down to 0 moderate/high/critical vulnerabilities, and 14 remaining low vulnerabilities from Hardhat 2 / verify / upgrades transitive packages that require a breaking Hardhat 3 migration to fully eliminate. Contract compilation and 55 Hardhat tests passed with zero regressions.
- [x] Fixed UGC participant fresh-join blocker: `/api/tasks-bundle` now supports signed `join-ugc-campaign`, validates wallet/campaign/timestamp, and calls live `fn_join_campaign_atomic` before a participant can start a sponsored task.
- [x] Fixed UI join flow: `UGCCampaignCard` now asks the participant to sign a campaign join before opening the subtask link, then records the local task-start timer.
- [x] Fixed stale payout CTA risk: `TasksPage` now reads and subscribes to `user_claims`, then passes payout state to `UGCCampaignCard`.
- [x] Fixed invalid payout CTA for broken legacy rows: the UGC card now only enables `CLAIM TOKEN PAYOUT` for `earned_pending_onchain_claim` or `paid`, and shows a disabled `PAYOUT PAUSED` review state for `sync_failed`.
- [x] Frontend/API verification after fix passed: `npx tsc --noEmit --pretty false`, `npm run check-routes`, `npm run check-abi`, and `npm run build`.
- [x] Post-fix sync/security verification passed: `node scripts/audits/check_sync_status.cjs` and `node scripts/audits/agent_anti_negligence_hook.cjs`.
- [x] Recovered the legacy QA participant row for campaign `89056fca-ff28-4bf4-ba45-6a7f87849b46` from `sync_failed` to `earned_pending_onchain_claim` with payout amount `0.01 USDC`, a refreshed 72h deadline, and `campaigns.remaining_reward_pool = 0`.
- [x] Completed participant-wallet UGC payout QA on Base Sepolia using `Che_Operation`: participant called `UGCRewardEscrow.claim(...)`, `RewardClaimed` emitted in tx `0xb9ebf69e...b1c3277`, escrow USDC raw balance moved `10000 -> 0`, participant USDC raw balance moved `360908 -> 370908`.
- [x] Synced payout DB mirror after on-chain proof: `user_claims.payout_status = paid`, `payout_amount = 0.01`, payout tx hash stored, `user_activity_logs` contains `UGC Campaign Payout`, and production `sync-ugc-payout` returns 200 idempotent `already_synced`.
- [x] Re-ran post-payout verification: `node scripts/audits/check_sync_status.cjs` passed with Sentinel `HEALTHY`, Task Claim Pipeline `FULLY FUNCTIONAL`, and Security Matrix `13/13`; `node scripts/audits/agent_anti_negligence_hook.cjs` passed `100% OPERATIONAL & PRISTINE`.
- [x] Refreshed production Sentinel heartbeat via `/api/lurah-cron`: returned `HEALTHY`, no alerts, and post-refresh audit shows fresh heartbeat.
- [x] Fixed Sentinel stale false-positive after root dev-tool pruning on 2026-06-05: local audit/health-bot threshold now aligns with Vercel Hobby daily cron using `SENTINEL_STALE_HOURS` (default `26` hours), instead of flagging `/api/lurah-cron` stale between daily runs.
- [x] Production negative QA partial pass: non-joined wallet claim rejected `403`, UGC platform spoof rejected `400`, already-claimed campaign returns idempotent `200` with `payout_status=paid`, and already-paid payout prepare returns idempotent `200`.
- [x] Production deploy gate cleared: `join-ugc-campaign`, schema-compatible UGC claim handling, backend RPC priority, and `supported_platforms.onchain` are deployed to `https://crypto-discovery-app.vercel.app`.
- [x] Fresh non-legacy participant-wallet ETH UGC payout QA passed on new campaign `1f82a6a2`: payment proof `0x93dc5e56...0f05e3`, escrow deposit `0x1931f689...93abe6`, subtask XP tx `0x1781b636...bb1fb9`, campaign claim XP tx `0x85ef2d75...b45a78`, participant escrow claim `0x24c3bc1b...6a889b`, and `RewardClaimed` emitted for claimant `0x52260c30...6795c8`.
- [x] Fresh ETH payout DB consistency passed: `user_claims.payout_status = paid`, `payout_amount = 0.00001 ETH`, `payout_deadline_at = 2026-06-08T00:51:07Z`, `campaigns.remaining_reward_pool = 0`, and `user_activity_logs` contains `UGC Campaign Payout`.
- [x] Fresh ETH payout idempotency passed: re-running `claim-ugc-campaign`, `prepare-ugc-payout-claim`, and `sync-ugc-payout` after payout returned safe 200 responses with `already_claimed`, `already_paid`, and `already_synced`.
- [x] Finished UGC escrow negative regression QA in local Hardhat on-chain simulation: replay/double claim with the same signature reverts `AlreadyClaimed`, reused claimant nonce on another campaign reverts `NonceUsed`, expired authorization reverts `InvalidDeadline`, and deadlines beyond 3x24h also revert `InvalidDeadline`, with escrow funds preserved.
- [ ] Create or select a Base Sepolia wallet with verified SBT tier and pending pool reward, then execute SBT pool claim through UI/API and verify `ClaimProcessed` plus DB mirror.
- [x] Resolve raffle QRNG/finalization blocker root cause: active Raffle was deployed with a no-code AirnodeRrp address. Code guards now detect this before live QA/deploy.
- [x] Execute explicit Raffle redeploy/cutover plan on-chain: deployed patched `CryptoDiscoRaffle` `0x1501273b...C1d32C` with valid Base Sepolia AirnodeRrp `0xa0AD79D9...e3Aa1Bd`; deploy tx `0xbe5d81bd...79aa6e`; set QRNG tx `0x979132a7...8e72a1`; RRP sponsorship tx `0x9589b714...1d2af4`; initialized tx `0x2d8bf306...ff914d`; linked MasterX tx `0x361b4d7c...6a7049`; satellite tx `0x62673bd0...37b102`; DailyApp `RAFFLE_ROLE` tx `0xc0c7f547...4b598b`.
- [x] Completed Raffle environment cutover: Vercel/frontend/API now points to `0x1501273b...C1d32C`; old DB raffle rows #1-#4 archived; production redeployed to `https://crypto-discovery-app.vercel.app`.
- [x] Fixed Raffle QRNG sponsor wallet mismatch: derived sponsor wallet for the new sponsor/requester contract is `0x40eF15db...8d92`, replacing stale `0x7186e5D3...7d61`; funded derived wallet with `0.02 ETH` in tx `0xe51f8345...fdd1`; updated QRNG params tx `0x6dbe0376...6996`; refreshed RRP sponsorship tx `0x87ad50a3...4ccc`; updated Vercel `SPONSOR_WALLET`.
- [x] Raffle create/buy XP QA passed on active cutover contract: raffle #7 create tx `0xc115e22c...a662`, buy tx `0xf00a65bf...214f`, creation XP +200 and buy XP +15 recorded once.
- [x] Raffle pending-state DB sync fixed: `_raffle-sync.ts` now updates existing rows instead of partial upsert, parses booleans safely, and mirrors `is_active=false` for draw-pending rows #6/#7.
- [x] Fixed X social verification regression: Supabase OAuth 2.0 linking now uses canonical provider `x`, frontend/API still normalize task platform alias `x -> twitter` for the legacy verification server contract, Twitter task fallback now fetches `twitter_id` even when Farcaster FID exists, and social verification payloads restore flat `userId` compatibility for the verification server.
- [ ] Complete Raffle claim prize QA after Airnode callback is restored: no `QRNGFulfilled` emitted for #6 request `0xfbe11f...d015` or #7 request `0xffeaf6...aca3` as of latest checked block `42436054`.
- [x] Raffle 3x24h claim-window migration path selected: new active Raffle deployment includes `CLAIM_WINDOW = 3 days`; remaining work is env/DB/API promotion and live claim QA.
- [ ] Plan Hardhat 3 migration separately before trying to force root `npm audit` to 0 low: remaining 14 low vulnerabilities are tied to required Hardhat 2 / `@nomicfoundation/hardhat-verify` / `@openzeppelin/hardhat-upgrades` transitive packages, while `upgrades` is still used by UUPS deployment/tests and `verify` is still used by contract verification scripts. Current root security gate is clean at `0 moderate/high/critical`.
- [ ] After participant QA, run production preview smoke for Tasks, UGC campaign card, raffle win banner, and SBT rewards dashboard before promoting any new deployment.
- [ ] Open PR from `feature/sync-dashboard-architecture`; include test evidence, source-control audit evidence, and remaining manual-gate notes.

## 2026-06-03: Twitter/X Verification System Audit & Parameter Mismatch Fix

- [x] Run full ecosystem sync audit check (`check_sync_status.cjs`): Task claim pipeline is 100% operational with no pending sync reconciliations or schema discrepancies.
- [x] Audited Twitter/X verification server service ([twitter.service.js](file:///e:/Disco%20Gacha/Disco_DailyApp/verification-server/services/twitter.service.js)) for crash resilience. Verified that all client requests check `this.readOnlyClient` and throw clean error objects instead of triggering uncaught `TypeError` crashes when `TWITTER_BEARER_TOKEN` is unset or empty.
- [x] Audited backend identity lock and anti-sybil enforcement ([_user-bundle.ts](file:///e:/Disco%20Gacha/Disco_DailyApp/Raffle_Frontend/api/_user-bundle.ts#L2930-L3024)): verified cryptographic signature checks and Supabase JWT ownership checks securely prevent spoofing during OAuth linkage.
- [x] Identified and fixed a major parameter mismatch in [useVerification.ts](file:///e:/Disco%20Gacha/Disco_DailyApp/Raffle_Frontend/src/hooks/useVerification.ts): previously, Farcaster FID was sent as the Twitter User ID (`userId`) to `/api/tasks-bundle` during sponsored task checks. If Farcaster wasn't linked, it fell back to `0`, causing all Twitter verifications to fail backend validation with linkage mismatches.
- [x] Hardened the [verifyTask](file:///e:/Disco%20Gacha/Disco_DailyApp/Raffle_Frontend/src/hooks/useVerification.ts#L12) function: it now checks the global `localStorage` cache (`fc_cache_{address}`) for instant resolution, falling back to a direct Supabase query to dynamically find and pass the correct social identity values (`twitter_id`, `tiktok_username`, `instagram_username`).
- [x] Validated compiler status of the frontend codebase: ran `npm run build` inside `Raffle_Frontend`, which compiled successfully without any TypeScript or compilation errors.
- [x] Re-audited user-reported X verification failure on 2026-06-05: [useOAuth.ts](file:///e:/Disco%20Gacha/Disco_DailyApp/Raffle_Frontend/src/hooks/useOAuth.ts) now calls Supabase OAuth 2.0 with `signInWithOAuth({ provider: 'x' })` and preserves app-facing X labels plus backend `twitter_id` storage.
- [x] Repaired X/Twitter task platform parity: [useVerification.ts](file:///e:/Disco%20Gacha/Disco_DailyApp/Raffle_Frontend/src/hooks/useVerification.ts), [useVerifiedAction.ts](file:///e:/Disco%20Gacha/Disco_DailyApp/Raffle_Frontend/src/hooks/useVerifiedAction.ts), and [_tasks-bundle.ts](file:///e:/Disco%20Gacha/Disco_DailyApp/Raffle_Frontend/api/_tasks-bundle.ts) now normalize stored task platform `x` to backend verifier platform `twitter`.
- [x] Repaired stale social-ID fallback: Twitter verification now performs a Supabase profile lookup when only `twitter_id` is missing, even if the local social cache already contains Farcaster FID; this prevents `Missing required field: userId` on X tasks.
- [x] Restored verification-server payload compatibility: Twitter social verification now forwards flat `userId` from `twitterId`/`socialId` when needed, so both direct task flow and verified action flow reach the same backend contract.
- [x] Repaired OAuth popup false-close regression: [useOAuth.ts](file:///e:/Disco%20Gacha/Disco_DailyApp/Raffle_Frontend/src/hooks/useOAuth.ts) no longer polls `popup.closed`, because Chromium/COOP can report an active X authorization window as closed during cross-origin redirects; the flow now relies on `/oauth-callback` postMessage plus a bounded timeout.
- [x] Hardened backend OAuth provider normalization in [_user-bundle.ts](file:///e:/Disco%20Gacha/Disco_DailyApp/Raffle_Frontend/api/_user-bundle.ts#L3015): `wallet_address` is trimmed/lowercased, `twitter` provider alias normalizes to `x`, unsupported providers return `400 Unsupported OAuth provider`, and all identity-lock branches use the normalized provider.
- [x] Deployed commit `80e4cf3` to production Vercel. Live production now serves index `/assets/index-C1gER8jm.js`, OAuth callback chunk `OAuthCallbackPage-Bs5OVJSZ.js`, profile chunk `ProfilePage-BJHOo5oL.js`, and OAuth hook chunk `useOAuth-8kpVgB0G.js`; live chunk no longer contains `OAuth popup closed by user` or `popup.closed`.
- [x] Verified live backend edge-case behavior after production deploy: `/api/user-bundle?action=sync-oauth` with an unsupported provider returns `400 {"error":"Unsupported OAuth provider"}` instead of falling into the older 500 path.
- [x] Post-deploy checks passed: `check_sync_status.cjs` reports `ALL SYSTEMS SYNCHRONIZED & OPERATIONAL`, Task Claim Pipeline `FULLY FUNCTIONAL`, Security Matrix `13/13`; `agent_anti_negligence_hook.cjs` reports `100% OPERATIONAL & PRISTINE`.
- [ ] Manual interactive QA remains required for a real X OAuth account: hard refresh production, connect wallet, authorize X popup, sign wallet message, then verify `user_profiles.twitter_id/twitter_username`, `user_activity_logs` `X Link`, and UI `CONNECTED` state.
