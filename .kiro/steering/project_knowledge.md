# CRYPTO DISCO — PROJECT KNOWLEDGE BASE
# Auto-included in every Kiro session for this workspace

## ARCHITECTURE OVERVIEW

### Stack
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + wagmi v2
- **Backend**: Vercel Serverless Functions (12 max on Hobby plan)
- **Database**: Supabase (PostgreSQL) with RLS + RPC functions
- **Blockchain**: Base (Sepolia for dev, Mainnet for prod) — Solidity contracts
- **IPFS**: Pinata (via /api/pin-metadata)
- **Identity**: Farcaster (Neynar API) + Twitter OAuth + Basenames

### Contract Architecture (3 core contracts)
- **MasterX** — SBT pool, tier weights, revenue distribution, ticket pricing
- **DailyApp (V15)** — Tasks, NFT minting, daily claims, sponsorships, XP sync
- **CryptoDiscoRaffle** — QRNG raffle (API3), ticket purchases, prize claims

### API Bundle Structure (12 functions — at Hobby limit)
```
api/
├── _shared/constants.ts     ← Env, RPC, ABIs (NOT a function)
├── _shared/types.ts         ← Shared interfaces (NOT a function)
├── _shared/database.types.ts ← Supabase types (NOT a function)
├── admin-bundle.ts          ← 28+ admin actions
├── audit-bundle.ts          ← Cron sync, RPC proxy
├── is-admin.ts              ← Lightweight admin check
├── lurah-cron.ts            ← Ecosystem health monitor
├── notify.ts                ← Farcaster notifications (dual-auth)
├── pin-metadata.ts          ← IPFS pinning
├── ping.ts                  ← Health check
├── raffle-bundle.ts         ← Raffle actions + campaign-join
├── raffle-sync.ts           ← Blockchain event indexer
├── sync-xp-onchain.ts       ← DB→Contract XP sync
├── tasks-bundle.ts          ← Task claim/verify (4 actions)
└── user-bundle.ts           ← User actions (22+ actions)
```

### Key Database Views
- `v_user_full_profile` — Canonical user view (rank_name computed from percentile)
- `user_stats` — Alias for v_user_full_profile
- `v_user_daily_progress` — Daily task completion tracking

### Key RPC Functions
- `fn_increment_xp(p_wallet, p_amount)`
- `fn_increment_raffle_tickets(p_wallet, p_amount)`
- `fn_increment_raffle_wins(p_wallet)`
- `fn_increment_raffles_created(p_wallet)`
- `fn_increment_campaign_participants(p_campaign_id)`
- `fn_compute_leaderboard_tiers()`

## COMMON PITFALLS (Learned from bugs)

### 1. Vercel Function Limit
- Hobby plan = 12 max. Files in `api/` are counted as functions.
- Use `api/_shared/` (underscore prefix) for shared modules — Vercel ignores these.
- To add new endpoints: consolidate into existing bundles as new actions.

### 2. Field Name Conventions
- **Database/API**: snake_case (`rank_name`, `total_xp`, `pfp_url`, `streak_count`)
- **Frontend types**: Often camelCase (`rankName`, `avatarUrl`, `streakCount`)
- **Always add fallbacks**: `profileData.rankName || profileData.rank_name || 'Rookie'`
- **Service layer should normalize**: Extract nested `data.data` from API responses.

### 3. ABI Parity
- Frontend ABIs live in `src/lib/abis_data.txt` (JSON blob, proxy-loaded)
- Backend ABIs are inline in `api/_shared/constants.ts` (minimal — only what's needed)
- **Before calling any contract function**: verify it exists in `abis_data.txt`
- Common renames between contract versions:
  - `getDailyTasks` → removed (use `nextTaskId` + build array)
  - `nextSponsorId` → `totalSponsorRequests`
  - `withdrawTreasury` → `emergencyWithdraw`
  - `setWithdrawalFeeBP` → `setWithdrawalFee`
  - `setDailyBonusAmount` → `setGlobalRewards(daily, referral)`

### 4. API Route Patterns
- Frontend calls: `/api/user/:action` → rewritten to `user-bundle?action=:action`
- Direct calls: `/api/admin-bundle` (POST with action in body) — preferred for admin
- **Never use**: `/api/admin/bundle` (gets rewritten to `?action=bundle` — fragile)
- **Public reads**: Must be handled BEFORE auth check in the handler

### 5. Price Oracle
- Use WETH address `0x4200000000000000000000000000000000000006` for DexScreener
- **Never use** `0xeee...eee` (fake native ETH placeholder — DexScreener returns 0)
- Always add Binance API fallback for ETH price

### 6. Environment Variables
- Frontend: `import.meta.env.VITE_*` (must be prefixed with VITE_)
- Backend: `process.env.*` (accessed via `getEnv()` helper)
- **Never use** `VITE_API_URL` or `VITE_VERIFY_SERVER_URL` in fetch calls — use relative paths
- Contract addresses: `VITE_*_ADDRESS` (mainnet) / `VITE_*_ADDRESS_SEPOLIA` (testnet)

### 7. Admin Dashboard
- All admin actions require: wallet signature + timestamp in message + admin check
- Public read actions (like `get-ugc-config`) must bypass auth
- The `admin-bundle` handler checks `req.body?.action || req.query?.action`

## VERIFICATION CHECKLIST (Run after every change)

1. `getDiagnostics` on modified files — 0 errors
2. Check ABI parity if touching contract calls
3. Verify API route exists in vercel.json rewrites OR is a direct endpoint
4. Confirm snake_case/camelCase alignment between API response and component props
5. No `VITE_API_URL` or external URL prefixes in fetch calls
6. Serverless function count still ≤ 12

## DESIGN PRINCIPLES

- **Zero-Hardcode**: All values from DB/contract, never inline constants
- **Zero-Trust**: Verify signatures, check on-chain state, validate inputs
- **Surgical Fix**: Minimal changes, never rewrite entire files
- **Nexus Parity**: Frontend UI must match Backend state and DB schema
- **Mobile-First**: All UI must work on mobile (no overlapping elements)
- **Native+ Design**: 11px bold uppercase tracking-widest for labels
