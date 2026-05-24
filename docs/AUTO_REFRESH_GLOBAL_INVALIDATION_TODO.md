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

- [ ] Reuse existing API surfaces only:
  - [ ] `/api/user-bundle`
  - [ ] `/api/tasks-bundle`
  - [ ] `/api/admin-bundle` where admin-only refresh is needed
  - [ ] Existing raffle/swap/user service calls already wired in the frontend
  - [ ] Existing `/api/leaderboard`
- [ ] Do **not** add new files under `api/` or `Raffle_Frontend/api/`.
- [ ] Do **not** increase Vercel Serverless Function count.
- [ ] Do **not** move sensitive writes to the frontend.
- [ ] Keep backend as the write + `logActivity` source of truth.
- [ ] Use Supabase Realtime only as an invalidation trigger, not as a trusted write path.
- [ ] Use TanStack Query invalidation/refetch as the frontend cache refresh layer.

---

## 2. Current State Inventory

### 2.1 Profile Activity

- [x] `useProfile(address)` already queries `['profile', address]`.
- [x] `useProfile(address)` already subscribes to `user_profiles` changes for the active wallet.
- [x] Profile query already enables:
  - [x] `refetchOnWindowFocus`
  - [x] `refetchOnReconnect`
  - [x] 60s interval fallback
- [ ] Confirm all profile-mutating flows invalidate `['profile', address]` after mutation success.

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
- [ ] Confirm every backend event below calls `logActivity` with category + metadata:
  - [ ] Swap
  - [ ] Payment
  - [ ] Purchase
  - [ ] Referral XP vesting
  - [ ] Referral dividend XP
  - [ ] Raw XP grant
  - [ ] Daily claim
  - [ ] UGC task claim
  - [ ] UGC raffle creation
  - [ ] UGC raffle participation
  - [ ] Buy ticket
  - [ ] Reward claim
  - [ ] SBT tier upgrade minting

### 2.3 Leaderboard

- [x] `LeaderboardPage` already fetches `/api/leaderboard?limit=100`.
- [x] `LeaderboardPage` already subscribes to `user_profiles` changes.
- [x] Realtime callback already refetches leaderboard without introducing a new endpoint.
- [ ] Confirm all XP-changing flows update `user_profiles.total_xp` through the canonical DB RPC so the existing realtime listener fires.
- [ ] Add/query-key wrapper later only if the page is migrated to TanStack Query; avoid unnecessary refactor for now.

### 2.4 SBT Tier Upgrade Minting

- [ ] Inventory current SBT hooks/components before implementation:
  - [ ] `SBTUpgradeCard` or current tier upgrade card component
  - [ ] `useSBT`
  - [ ] `useNFTTiers`
  - [ ] `PointsContext` / profile points source
- [ ] Ensure successful mint/upgrade invalidates or refetches:
  - [ ] `['profile', address]`
  - [ ] profile points / XP context
  - [ ] SBT/tier reads
  - [ ] `['activity-logs', address]`
  - [ ] leaderboard view
- [ ] Ensure on-chain write waits for transaction receipt before DB status refresh.
- [ ] Ensure backend logs SBT activity with category `SBT` and `tx_hash`.

### 2.5 Swap

- [ ] Inventory current swap component/hooks before implementation:
  - [ ] `SwapModal` or current swap surface
  - [ ] portfolio/balance hooks
  - [ ] activity log write path
- [ ] After successful swap settlement, refresh:
  - [ ] wallet/token balances
  - [ ] swap quote state if still open
  - [ ] `['activity-logs', address]`
  - [ ] `['profile', address]` if XP/reward/economy fields changed
  - [ ] leaderboard only if XP changed
- [ ] Ensure swap activity log stores dynamic asset metadata:
  - [ ] symbol
  - [ ] decimals
  - [ ] amount in/out
  - [ ] `tx_hash`
  - [ ] route/provider metadata where available

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

- [ ] Treat successful backend mutation response, confirmed transaction receipt, and Supabase Realtime event as equivalent invalidation triggers.
- [ ] Prefer narrow invalidation first, then prefix invalidation only for grouped caches such as activity logs.
- [ ] Never trust realtime payloads as canonical data; realtime should only trigger a refetch from existing trusted read paths.
- [ ] Debounce repeated invalidations from the same transaction or claim so one user action does not create a refetch storm.
- [ ] Keep all sensitive writes behind existing backend bundles; frontend may only call existing endpoints or refetch existing queries.
- [ ] If a domain has no React Query key yet, use its current local `refetch()`/`fetch*()` function instead of adding an API.

---

## 5. Implementation To-Do by Surface

### 5.1 Profile Page / Profile Activity

- [ ] Centralize post-mutation refresh calls around existing React Query client.
- [ ] Invalidate `['profile', address]` after any profile-affecting action.
- [ ] Avoid direct Supabase writes from profile UI for sensitive state.
- [ ] Confirm realtime filter lowercases wallet address consistently.
- [ ] Confirm profile refetch does not spam network when multiple realtime events arrive quickly.

### 5.2 ActivityLogSection

- [ ] Keep prefix invalidation for `['activity-logs', address]` so all category caches refresh.
- [ ] Confirm `category='ALL'` maps to backend default correctly.
- [ ] Confirm new activity categories are display-only additions and do not require API changes.
- [ ] Verify duplicate logs do not appear when explicit `user_activity_logs` and claim fallback both exist.
- [ ] Add manual test cases for each event type listed in Section 4.

### 5.3 SBT Tier Upgrade Minting

- [ ] Read mandatory SBT files before implementation:
  - [ ] `useNFTTiers`
  - [ ] `useSBT`
  - [ ] SBT upgrade component
  - [ ] contract/address registry
- [ ] Ensure mint handler has early gas/eligibility guards.
- [ ] Wait for transaction receipt before DB/profile refresh.
- [ ] Trigger existing refetch callbacks for points, tiers, user info, and profile.
- [ ] Ensure `SBT` activity log includes `tx_hash`.
- [ ] Confirm leaderboard updates only via existing profile XP/tier state changes.

### 5.4 Leaderboard

- [ ] Keep existing `/api/leaderboard` endpoint; do not create a replacement endpoint.
- [ ] Keep `user_profiles` realtime subscription as the global leaderboard trigger.
- [ ] If migrated later to React Query, use `['leaderboard', { limit: 100 }]` and invalidate that key.
- [ ] Add debounce/throttle if high-frequency profile updates cause excessive refetching.
- [ ] Verify current user row updates after XP, SBT tier, raffle wins, and daily streak changes.

### 5.5 Tasks / UGC Tasks

- [ ] After claim success or `already_claimed: true`, invalidate/refetch:
  - [ ] task list
  - [ ] `['activity-logs', address]`
  - [ ] `['profile', address]`
  - [ ] points context
  - [ ] leaderboard if XP changed
- [ ] Confirm completed tasks disappear immediately from UI.
- [ ] Confirm linked tasks still use the two-step open-link/countdown/claim flow.
- [ ] Confirm UGC task logs use category `UGC` or `XP` consistently with product semantics.

### 5.6 UGC Raffle / Buy Ticket / Reward Claim

- [ ] After raffle creation, refresh raffle list/detail and creator activity logs.
- [ ] After buy ticket, refresh:
  - [ ] raffle detail
  - [ ] ticket count / participant state
  - [ ] balances
  - [ ] `['activity-logs', address]`
  - [ ] `['profile', address]` if XP or stats changed
- [ ] After reward claim, refresh:
  - [ ] reward claim state
  - [ ] balances
  - [ ] activity logs
  - [ ] profile / leaderboard if XP changed
- [ ] Ensure raffle events use existing raffle API/bundle paths only.

### 5.7 Swap

- [ ] After swap transaction receipt, refresh wallet balances using existing balance hooks.
- [ ] Refresh activity logs after backend logging confirms swap record.
- [ ] Refresh profile only when swap grants XP, affects payment status, or updates user stats.
- [ ] Do not create a dedicated swap refresh API.
- [ ] Ensure failed swaps do not create success logs.
- [ ] Ensure payment/purchase swap-derived events use existing display categories such as `SWAP`, `PURCHASE`, or `REWARD` consistently.

### 5.8 Daily Claim / XP / Referral XP

- [ ] After daily claim success, refresh:
  - [ ] `['profile', address]`
  - [ ] points context / XP display
  - [ ] `['activity-logs', address]`
  - [ ] leaderboard local fetch or query key
- [ ] Confirm daily claim writes XP through the canonical backend/RPC path and not direct frontend Supabase writes.
- [ ] Confirm streak and last-claim timestamps appear after the same refresh cycle.
- [ ] After raw XP grant or system XP award, refresh profile, points, activity logs, and leaderboard.
- [ ] After referral vesting threshold is reached, refresh:
  - [ ] referrer profile XP
  - [ ] referred user profile status if visible
  - [ ] referral activity log category
  - [ ] leaderboard
- [ ] After referral dividend XP, ensure `REFERRAL_DIVIDEND` logs are visible through existing activity log queries.
- [ ] Verify referral XP values come from database settings / RPC flow, not hardcoded frontend constants.

### 5.9 Payment / Purchase / Balance-Affecting Events

- [ ] After payment confirmation, refresh:
  - [ ] wallet/token balances
  - [ ] payment or purchase status UI
  - [ ] `['activity-logs', address]`
  - [ ] profile only if user stats or XP changed
- [ ] After purchase confirmation, refresh:
  - [ ] balances
  - [ ] domain state for the purchased item/ticket/reward
  - [ ] activity logs
  - [ ] profile/leaderboard only if XP, tier, streak, or stats changed
- [ ] Ensure payment and purchase logs include dynamic asset metadata:
  - [ ] symbol
  - [ ] decimals
  - [ ] normalized amount
  - [ ] `tx_hash`
  - [ ] chain id
- [ ] Do not add a new payment history endpoint; reuse existing ledger/activity paths.

### 5.10 Global Realtime + Fallback Polling Hardening

- [ ] Keep wallet filters case-insensitive by normalizing EVM addresses to lowercase before subscription/refetch matching.
- [ ] Add a single shared debounce policy for rapid realtime events if repeated logs/profile updates occur in one transaction.
- [ ] Keep fallback polling windows modest:
  - [ ] profile: existing 60s fallback is acceptable
  - [ ] activity logs: existing 30s fallback is acceptable
  - [ ] leaderboard: refetch on profile realtime, optionally debounce if noisy
- [ ] Surface degraded realtime state in console/debug logs without blocking the user flow.
- [ ] Confirm browser console has no Supabase channel subscription errors during profile, task, raffle, and swap flows.

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

- [ ] `git diff --name-only` confirms no new API files were added.
- [ ] Existing API bundle/function count remains unchanged.
- [ ] Daily claim updates:
  - [ ] profile XP
  - [ ] activity history
  - [ ] leaderboard row
- [ ] SBT tier upgrade updates:
  - [ ] profile tier
  - [ ] SBT state
  - [ ] activity history
  - [ ] leaderboard tier badge
- [ ] Task/UGC claim updates:
  - [ ] task disappears
  - [ ] XP/profile refreshes
  - [ ] activity log appears
- [ ] Raffle buy ticket updates:
  - [ ] ticket state
  - [ ] purchase/activity log
  - [ ] balances when applicable
- [ ] Reward claim updates:
  - [ ] reward state
  - [ ] activity log
  - [ ] profile/leaderboard if XP changed
- [ ] Swap updates:
  - [ ] token balances
  - [ ] swap activity log
  - [ ] payment/purchase status if relevant
- [ ] Browser console has no realtime subscription errors.
- [ ] No Supabase service-role or sensitive writes exist in frontend code.
- [ ] Gitleaks passes before commit/push.

---

## 8. Success Criteria

- [ ] User does not need manual page reload after profile, XP, task, SBT, swap, raffle, or reward actions.
- [ ] Activity history reflects every material event within realtime or fallback polling window.
- [ ] Leaderboard reflects XP/tier/streak changes through existing `/api/leaderboard` refetch.
- [ ] SBT minting refreshes profile/tier state after transaction confirmation.
- [ ] Swap/payment/purchase events refresh balances and logs without new APIs.
- [ ] Vercel function count does not increase.
- [ ] All refresh paths preserve Zero-Trust: backend writes, frontend invalidates.
