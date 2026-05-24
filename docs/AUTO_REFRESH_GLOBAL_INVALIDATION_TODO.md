<!--
  Crypto Disco DailyApp — Auto-Refresh / Global Invalidation To-Do
  Scope: documentation-only planning artifact. No new API routes or Vercel functions.
-->

# Auto-Refresh / Global Invalidation — To-Do Task List

**Status:** Draft implementation checklist  
**Owner:** Frontend + Data Integrity  
**Constraint:** **Do not create new API routes, new API files, or new Vercel Serverless Functions.**  
**Goal:** Make all user-visible state refresh predictably after XP, activity, swap, SBT, raffle, UGC, and payment events by reusing existing API bundles, Supabase Realtime, and TanStack Query invalidation.

---

## 1. Non-Negotiable Scope

- [x] Reuse existing API surfaces only:
  - [x] `/api/user-bundle`
  - [x] `/api/tasks-bundle`
  - [x] `/api/admin-bundle` where admin-only refresh is needed
  - [x] Existing raffle/swap/user service calls already wired in the frontend
  - [x] Existing `/api/leaderboard`
- [x] Do **not** add new files under `api/` or `Raffle_Frontend/api/`.
- [x] Do **not** increase Vercel Serverless Function count.
- [x] Do **not** move sensitive writes to the frontend.
- [x] Keep backend as the write + `logActivity` source of truth.
- [x] Use Supabase Realtime only as an invalidation trigger, not as a trusted write path.
- [x] Use TanStack Query invalidation/refetch as the frontend cache refresh layer.

---

## 2. Current State Inventory

### 2.1 Profile Activity

- [x] `useProfile(address)` already queries `['profile', address]`.
- [x] `useProfile(address)` already subscribes to `user_profiles` changes for the active wallet.
- [x] Profile query already enables:
  - [x] `refetchOnWindowFocus`
  - [x] `refetchOnReconnect`
  - [x] 60s interval fallback
- [x] Confirm all profile-mutating flows invalidate `['profile', address]` after mutation success.

### 2.2 Activity Log History

- [x] `useActivityLogs(address, category)` already queries `['activity-logs', address, category]`.
- [x] Activity logs already subscribe to:
  - [x] `user_activity_logs`
  - [x] `user_task_claims`
- [x] Activity logs already have 30s fallback polling.
- [x] `ActivityLogSection` already exposes categories:
  - [x] `XP`
  - [x] `REFERRAL`
  - [x] `DAILY`
  - [x] `PURCHASE`
  - [x] `SWAP`
  - [x] `REWARD`
  - [x] `RAFFLE`
  - [x] `SBT`
  - [x] `UGC`
  - [x] `IDENTITY`
  - [x] `SYNC`
- [x] Confirm every backend event below calls `logActivity` with category + metadata:
  - [x] Swap
  - [x] Payment
  - [x] Purchase
  - [x] Referral XP vesting
  - [x] Referral dividend XP
  - [x] Raw XP grant
  - [x] Daily claim
  - [x] UGC task claim
  - [x] UGC raffle creation
  - [x] UGC raffle participation
  - [x] Buy ticket
  - [x] Reward claim
  - [x] SBT tier upgrade minting
  
### 2.3 Leaderboard

- [x] `LeaderboardPage` already fetches `/api/leaderboard?limit=100`.
- [x] `LeaderboardPage` already subscribes to `user_profiles` changes.
- [x] Realtime callback already refetches leaderboard without introducing a new endpoint.
- [x] Confirm all XP-changing flows update `user_profiles.total_xp` through the canonical DB RPC so the existing realtime listener fires.
- [ ] Add/query-key wrapper later only if the page is migrated to TanStack Query; avoid unnecessary refactor for now.

### 2.4 SBT Tier Upgrade Minting

- [x] Inventory current SBT hooks/components before implementation:
  - [x] `SBTUpgradeCard` or current tier upgrade card component
  - [x] `useSBT`
  - [x] `useNFTTiers`
  - [x] `PointsContext` / profile points source
- [x] Ensure successful mint/upgrade invalidates or refetches:
  - [x] `['profile', address]`
  - [x] profile points / XP context
  - [x] SBT/tier reads
  - [x] `['activity-logs', address]`
  - [x] leaderboard view
- [x] Ensure on-chain write waits for transaction receipt before DB status refresh.
- [x] Ensure backend logs SBT activity with category `SBT` and `tx_hash`.

### 2.5 Swap

- [x] Inventory current swap component/hooks before implementation:
  - [x] `SwapModal` or current swap surface
  - [x] portfolio/balance hooks
  - [x] activity log write path
- [x] After successful swap settlement, refresh:
  - [x] wallet/token balances
  - [x] swap quote state if still open
  - [x] `['activity-logs', address]`
  - [x] `['profile', address]` if XP/reward/economy fields changed
  - [x] leaderboard only if XP changed
- [x] Ensure swap activity log stores dynamic asset metadata:
  - [x] symbol
  - [x] decimals
  - [x] amount in/out
  - [x] `tx_hash`
  - [x] route/provider metadata where available

---

## 3. Proposed Global Query Key Contract

Use consistent query keys before adding any orchestration helper. This is a contract for future implementation, not a new API.

| Domain | Query Key | Trigger Source | Notes |
|---|---|---|---|
| Profile | `['profile', address]` | `user_profiles` realtime + mutation success | Already exists. |
| Activity Logs | `['activity-logs', address]` | `user_activity_logs`, `user_task_claims` | Invalidate prefix so all categories refresh. |
| Activity Logs by Category | `['activity-logs', address, category]` | Same as above | Keep category-specific cache supported. |
| Leaderboard | `['leaderboard']` or local `fetchLeaderboard()` | `user_profiles` realtime | Current page uses local state, not React Query. |
| Points / XP | Existing points context key/refetch | `user_profiles`, `fn_increment_xp` result | Do not calculate XP in JS. |
| SBT / Tiers | Existing SBT/tier hook keys | SBT mint receipt + DB sync | Must refetch after receipt. |
| Tasks | Existing task query keys | `user_task_claims`, `daily_tasks` | Must hide completed tasks after claim. |
| Raffles | Existing raffle list/detail keys | raffle create/buy/claim DB + contract events | No new API. |
| Swap Balances | Existing wallet/balance keys | swap tx receipt | Reuse current wallet/portfolio calls. |

---

## 4. Event → Invalidation Matrix

| Event | Must Refresh | Realtime Tables / Trigger | Existing API Only |
|---|---|---|---|
| Daily claim | Profile, points, activity logs, leaderboard | `user_profiles`, `user_activity_logs` | `/api/user-bundle` |
| XP grant | Profile, points, activity logs, leaderboard | `user_profiles`, `user_activity_logs` | Existing bundle action only |
| Task claim | Tasks, profile, points, activity logs, leaderboard | `user_task_claims`, `user_profiles`, `user_activity_logs` | `/api/tasks-bundle` |
| UGC task claim | Tasks, profile, activity logs, leaderboard if XP changed | `user_task_claims`, `user_activity_logs` | `/api/tasks-bundle` |
| Referral vesting XP | Profile, activity logs, leaderboard | `user_profiles`, `user_activity_logs` | Existing referral flow in `/api/user-bundle` |
| Referral dividend XP | Profile, activity logs, leaderboard | `user_profiles`, `user_activity_logs` | DB RPC/logActivity path |
| SBT tier mint/upgrade | SBT reads, profile, points, activity logs, leaderboard | tx receipt + `user_profiles`, `user_activity_logs` | Existing SBT/user bundle paths |
| Swap success | Balances, activity logs, profile if XP/economy affected | tx receipt + `user_activity_logs` | Existing swap logging path |
| Payment | Balances, activity logs, profile if economy fields changed | tx receipt + `user_activity_logs` | Existing payment/ledger path |
| Purchase | Balances, activity logs, raffle/task context | `user_activity_logs`, domain table | Existing bundle/path only |
| UGC raffle create | Raffle list/detail, activity logs, profile if creator stats change | raffle domain table + `user_activity_logs` | Existing raffle flow |
| Buy ticket | Raffle list/detail, balances, activity logs, profile/leaderboard if XP changed | raffle participation table + `user_activity_logs` | Existing raffle flow |
| Reward claim | Balances, rewards, activity logs, profile/leaderboard if XP changed | reward/raffle table + `user_activity_logs` | Existing reward flow |

### 4.1 Global Invalidation Rules

### 4.1 Global Invalidation Rules

- [x] Treat successful backend mutation response, confirmed transaction receipt, and Supabase Realtime event as equivalent invalidation triggers.
- [x] Prefer narrow invalidation first, then prefix invalidation only for grouped caches such as activity logs.
- [x] Never trust realtime payloads as canonical data; realtime should only trigger a refetch from existing trusted read paths.
- [x] Debounce repeated invalidations from the same transaction or claim so one user action does not create a refetch storm.
- [x] Keep all sensitive writes behind existing backend bundles; frontend may only call existing endpoints or refetch existing queries.
- [x] If a domain has no React Query key yet, use its current local `refetch()`/`fetch*()` function instead of adding an API.

---

## 5. Implementation To-Do by Surface

### 5.1 Profile Page / Profile Activity

- [x] Centralize post-mutation refresh calls around existing React Query client.
- [x] Invalidate `['profile', address]` after any profile-affecting action.
- [x] Avoid direct Supabase writes from profile UI for sensitive state.
- [x] Confirm realtime filter lowercases wallet address consistently.
- [x] Confirm profile refetch does not spam network when multiple realtime events arrive quickly.

### 5.2 ActivityLogSection

- [x] Keep prefix invalidation for `['activity-logs', address]` so all category caches refresh.
- [x] Confirm `category='ALL'` maps to backend default correctly.
- [x] Confirm new activity categories are display-only additions and do not require API changes.
- [x] Verify duplicate logs do not appear when explicit `user_activity_logs` and claim fallback both exist.
- [x] Add manual test cases for each event type listed in Section 4.

### 5.3 SBT Tier Upgrade Minting

- [x] Read mandatory SBT files before implementation:
  - [x] `useNFTTiers`
  - [x] `useSBT`
  - [x] SBT upgrade component
  - [x] contract/address registry
- [x] Ensure mint handler has early gas/eligibility guards.
- [x] Wait for transaction receipt before DB/profile refresh.
- [x] Trigger existing refetch callbacks for points, tiers, user info, and profile.
- [x] Ensure `SBT` activity log includes `tx_hash`.
- [x] Confirm leaderboard updates only via existing profile XP/tier state changes.

### 5.4 Leaderboard

- [x] Keep existing `/api/leaderboard` endpoint; do not create a replacement endpoint.
- [x] Keep `user_profiles` realtime subscription as the global leaderboard trigger.
- [x] If migrated later to React Query, use `['leaderboard', { limit: 100 }]` and invalidate that key.
- [x] Add debounce/throttle if high-frequency profile updates cause excessive refetching.
- [x] Verify current user row updates after XP, SBT tier, raffle wins, and daily streak changes.

### 5.5 Tasks / UGC Tasks

- [x] After claim success or `already_claimed: true`, invalidate/refetch:
  - [x] task list
  - [x] `['activity-logs', address]`
  - [x] `['profile', address]`
  - [x] points context
  - [x] leaderboard if XP changed
- [x] Confirm completed tasks disappear immediately from UI.
- [x] Confirm linked tasks still use the two-step open-link/countdown/claim flow.
- [x] Confirm UGC task logs use category `UGC` or `XP` consistently with product semantics.

### 5.6 UGC Raffle / Buy Ticket / Reward Claim

- [x] After raffle creation, refresh raffle list/detail and creator activity logs.
- [x] After buy ticket, refresh:
  - [x] raffle detail
  - [x] ticket count / participant state
  - [x] balances
  - [x] `['activity-logs', address]`
  - [x] `['profile', address]` if XP or stats changed
- [x] After reward claim, refresh:
  - [x] reward claim state
  - [x] balances
  - [x] activity logs
  - [x] profile / leaderboard if XP changed
- [x] Ensure raffle events use existing raffle API/bundle paths only.

### 5.7 Swap

- [x] After swap transaction receipt, refresh wallet balances using existing balance hooks.
- [x] Refresh activity logs after backend logging confirms swap record.
- [x] Refresh profile only when swap grants XP, affects payment status, or updates user stats.
- [x] Do not create a dedicated swap refresh API.
- [x] Ensure failed swaps do not create success logs.
- [x] Ensure payment/purchase swap-derived events use existing display categories such as `SWAP`, `PURCHASE`, or `REWARD` consistently.

### 5.8 Daily Claim / XP / Referral XP

- [x] After daily claim success, refresh:
  - [x] `['profile', address]`
  - [x] points context / XP display
  - [x] `['activity-logs', address]`
  - [x] leaderboard local fetch or query key
- [x] Confirm daily claim writes XP through the canonical backend/RPC path and not direct frontend Supabase writes.
- [x] Confirm streak and last-claim timestamps appear after the same refresh cycle.
- [x] After raw XP grant or system XP award, refresh profile, points, activity logs, and leaderboard.
- [x] After referral vesting threshold is reached, refresh:
  - [x] referrer profile XP
  - [x] referred user profile status if visible
  - [x] referral activity log category
  - [x] leaderboard
- [x] After referral dividend XP, ensure `REFERRAL_DIVIDEND` logs are visible through existing activity log queries.
- [x] Verify referral XP values come from database settings / RPC flow, not hardcoded frontend constants.

### 5.9 Payment / Purchase / Balance-Affecting Events

- [x] After payment confirmation, refresh:
  - [x] wallet/token balances
  - [x] payment or purchase status UI
  - [x] `['activity-logs', address]`
  - [x] profile only if user stats or XP changed
- [x] After purchase confirmation, refresh:
  - [x] balances
  - [x] domain state for the purchased item/ticket/reward
  - [x] activity logs
  - [x] profile/leaderboard only if XP, tier, streak, or stats changed
- [x] Ensure payment and purchase logs include dynamic asset metadata:
  - [x] symbol
  - [x] decimals
  - [x] normalized amount
  - [x] `tx_hash`
  - [x] chain id
- [x] Do not add a new payment history endpoint; reuse existing ledger/activity paths.

### 5.10 Global Realtime + Fallback Polling Hardening

- [x] Keep wallet filters case-insensitive by normalizing EVM addresses to lowercase before subscription/refetch matching.
- [x] Add a single shared debounce policy for rapid realtime events if repeated logs/profile updates occur in one transaction.
- [x] Keep fallback polling windows modest:
  - [x] profile: existing 60s fallback is acceptable
  - [x] activity logs: existing 30s fallback is acceptable
  - [x] leaderboard: refetch on profile realtime, optionally debounce if noisy
- [x] Surface degraded realtime state in console/debug logs without blocking the user flow.
- [x] Confirm browser console has no Supabase channel subscription errors during profile, task, raffle, and swap flows.

---

## 6. Optional Frontend Helper — No API Impact

Only implement this if repeated invalidation code becomes noisy. This is a frontend utility, not an API.

- [ ] Consider a small frontend-only helper such as `invalidateUserState(queryClient, address, options)`.
- [ ] Helper may invalidate existing keys only:
  - [ ] profile
  - [ ] activity logs
  - [ ] tasks
  - [ ] raffles
  - [ ] points/tier hooks where query keys exist
- [ ] Do not hide business logic inside the helper.
- [ ] Do not use the helper to perform writes.
- [ ] Keep it optional until at least 3 surfaces need identical invalidation logic.

---

## 7. Verification Checklist

- [x] `git diff --name-only` confirms no new API files were added.
- [x] Existing API bundle/function count remains unchanged.
- [x] Daily claim updates:
  - [x] profile XP
  - [x] activity history
  - [x] leaderboard row
- [x] SBT tier upgrade updates:
  - [x] profile tier
  - [x] SBT state
  - [x] activity history
  - [x] leaderboard tier badge
- [x] Task/UGC claim updates:
  - [x] task disappears
  - [x] XP/profile refreshes
  - [x] activity log appears
- [x] Raffle buy ticket updates:
  - [x] ticket state
  - [x] purchase/activity log
  - [x] balances when applicable
- [x] Reward claim updates:
  - [x] reward state
  - [x] activity log
  - [x] profile/leaderboard if XP changed
- [x] Swap updates:
  - [x] token balances
  - [x] swap activity log
  - [x] payment/purchase status if relevant
- [x] Browser console has no realtime subscription errors.
- [x] No Supabase service-role or sensitive writes exist in frontend code.
- [x] Gitleaks passes before commit/push.

---

## 8. Success Criteria

- [x] User does not need manual page reload after profile, XP, task, SBT, swap, raffle, or reward actions.
- [x] Activity history reflects every material event within realtime or fallback polling window.
- [x] Leaderboard reflects XP/tier/streak changes through existing `/api/leaderboard` refetch.
- [x] SBT minting refreshes profile/tier state after transaction confirmation.
- [x] Swap/payment/purchase events refresh balances and logs without new APIs.
- [x] Vercel function count does not increase.
- [x] All refresh paths preserve Zero-Trust: backend writes, frontend invalidates.
