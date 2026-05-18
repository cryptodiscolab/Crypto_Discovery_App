# Crypto Disco: Phase 2 Roadmap

## Core Infrastructure (Operational)
- [x] **MasterX**: Revenue distribution and point system.
- [x] **Raffle**: Ticket-based NFT raffle system.
- [x] **DailyAppV15**: Security-hardened task system (deployed 2026-05-12).

## Phase 2.5: Security Hardening & Real-Time Sync [x]
- [x] Full codebase audit (50 TS errors fixed, 39 API responses sanitized)
- [x] Contract audit: 2 CRITICAL + 6 HIGH vulnerabilities fixed
- [x] DailyAppV15 deployed with: emergencyWithdraw protection, burnPoints cap, cross-chain replay prevention
- [x] MasterX patched: holder counter underflow guard, addPoints rate limit
- [x] Raffle patched: unclaimed prize reclaim, winner deduplication
- [x] Real-time XP sync: DB→On-chain via cron (30min) + event trigger
- [x] Security headers: HSTS, X-Frame-Options, nosniff, Referrer-Policy
- [x] Zero-hardcode: all addresses from .env, dev wallet consolidated

## Phase 2: Satellite Contracts & Frontend Integration

### Step 1: Satellite Deployment [x]
- [x] Develop `DailyApp.sol` (Lightweight Task System).
- [x] Deploy `DailyApp.sol` to Base Sepolia.
- [x] Link `DailyApp` as an authorized satellite in `MasterX`.

### Step 2: Verification [x]
- [x] Verify `MasterX` on BaseScan.
- [x] Verify `Raffle` on BaseScan (Manual Proof-of-Work v3.31.0).
- [x] Verify `DailyApp` on BaseScan.
- [x] Deploy `Verification Server` to Vercel.
- [x] Sync `VITE_VERIFY_SERVER_URL` in frontend.

### Step 3: Frontend Integration [x]
- [x] Setup React/Next.js scaffold (Farcaster/Mini App optimized).
- [x] Implement NFT Raffle Buy & Claim functions. (Zero-Trust XP Sync)
- [x] Implement Daily Claim & Reward Pool Distribution logic. (**Verification-First v3.27.0**: tx_hash proof, no passive triggers)
- [x] Neynar API Integration (Social Verification).
- [x] Base Paymaster Integration (Gasless transactions).
- [x] **Admin Hub Command Center**: Integrated Real-time P&L, Economy Metrics, and Sentinel Audits.
- [x] **UGC ETH Reward Sync & Live Pricing (v3.38.4)**: Native ETH payouts with real-time USDC conversion oracle.
- [x] **ABI Consistency Audit & Sync (v3.38.8)**: Full stack ABI parity.
- [x] **UGC & Price Oracle Restoration (v3.38.10)**: `renewSponsorship` fix and drift identification.
- [x] **Global Mobile UI Hardening ("Native+") v3.40.18**: Full responsive audit, 11px standardized typography, and notch-proof safe area implementation.
- [x] **Identity Hardening & Growth Loop v2 (v3.42.0)**: Base Social Verification (Basenames) and 500 XP Referral Vesting with 10% passive dividends.
- [x] **Database Hardening & Clean Sweep UX (v3.42.2)**: Systematic `.maybeSingle()` migration for PGRST116 resilience and "Disappearing Task" interface implementation.
- [x] **Admin System Hardening & ABI Synchronization (v3.42.8)**: Corrected ABI phantom function calls, removed dead React states in System Configs, and replaced browser alerts with standard toasts.
- [x] **Task Master ABI Parity & Signature Alignment (v3.46.0)**: Rebuilt `abis_data.txt` (157 entries), fixed `setSponsorshipParams` (4 args), `buySponsorshipWithToken` (string arrays), and migrated to direct `setTokenPriceUSD` oracle flow.
- [x] **Create Mission Wallet Compatibility Fix (v3.46.1)**: Refactored `PayAndCreateMissionButton` in Profile to use sequential transactions, removing dependency on experimental `EIP-5792` batch protocols to support standard wallets (MetaMask/Rabby).
- [x] **Ecosystem Environment Sync & Automation (v3.50.0)**: Built a global `sync-all-envs.cjs` script to automate synchronization across 16 `.env` files. Integrated `sync env` as a mandatory agent trigger in `.cursorrules` to ensure absolute parity.
- [x] **Gas Tracker Hardening & Global Visibility (v3.51.0)**: Implemented explicit descending threshold chain in `useGasTracker`, defense-in-depth handler guards, SBT mint protection, and a real-time color-coded gas indicator pill in the global header. Expanded `global-sync-env.js` to include 8 missing critical keys.
- [x] **Ghost Claim Recovery & Activity Log Hardening (v3.51.2)**: Automated self-healing for missing activity logs and hardened XP reward lifecycle.
- [x] **Premium Task & Raffle Logic Hardening (v3.52.0)**: Hardened 24h reset logic, 7-day UGC expiry, and initial premium metadata stamps.
- [x] **Nexus UI & Metadata Parity Overhaul (v3.53.0)**: 100% parity between Task and Raffle interfaces. Dynamic Home Page stats from Supabase, standardized Cyberpunk stamps (ID, Creator, Created, Expires), and structural hardening of countdown layouts.
- [x] **Nexus Command Center (NCC) v1.0 — Ecosystem Control Plane (v3.54.0)**: Integrated Kanban, Mind Map, and Graphify visualization. Local-first dashboard with Data Inlining (CORS-proof) and automated Red/Yellow priority task discovery.
- [x] **Accountant Ledger & Financial Audit System (v3.59.1)**: Implemented real-time double-entry audit trail, live on-chain balancing report (Safe/MasterX/DailyApp/Raffle), and manual treasury withdrawal execution module. Established full documentation parity via `ACCOUNTANT_LEDGER_SOT.md`.
- [x] **Ecosystem Hardening & Parity Audit (v3.59.2)**: Implemented centralized Hardening Center for live drift monitoring. Enforced SBT-gating on Leaderboard SOT. Developed high-precision Parity Audit API with Runtime ABI Guards. Finalized NFT Metadata IPFS propagation logic.
- [x] **Multi-Token Sponsorship (V14) & Decimal Hardening (v3.59.3)**: Integrated DailyApp V14 supporting USDC/ETH pools. Established 6-decimal normalization standard for all monetary parameters. Hardened SponsoredTaskCard visibility logic for persistent reward access.
- [x] **UGC Mission Hardening & Lurah Proactive Monitoring (v3.59.1)**: Implemented link regex guards, multi-action bounds, and stuck mission detection. Fixed Telegram webhook routing to correct Verification Server endpoint. Achieved full WSL environment parity with 13/13 audit checks passed.
- [x] **Final Polish & Performance Optimization (v3.59.4)**: Filtered UGC sub-tasks from main list, implemented DB-First Raffle Indexing to eliminate N+1 RPC calls, and added missing `create_task` and `daily_task_completion` reward keys.
- [x] **Raffle Admin Hardening & Platform Economics (v3.59.5)**: Implemented dynamic fee controls (Rake 20%, Claim 5%, Surcharge 10%) and Creator Revenue Portal for atomic 80% withdrawals. Enforced Zero-Hardcode mandate across all raffle administrative workflows.
- [x] **TypeScript Ecosystem Hardening & Git Hygiene (v3.60.2)**: Completed 100% TSX migration for Admin Dashboard components. Resolved strict type errors (`never[]`, implicit `any`) in the main user frontend. Hardened `.gitignore` and automated build artifact cleanup to ensure a 100% clean Git tree.
- [x] **Daily Retention Hardening & Tier Reconciliation (v3.60.4)**: Achieved 100% on-chain parity between `MasterX` and `DailyApp` via `reconcile_tiers.cjs`. Hardened Daily Bonus logic with mandatory identity gating (`is_base_social_verified`).
- [x] **Serverless API Hardening & Ecosystem Hardening (v3.61.0)**: 100% TypeScript migration for Vercel Serverless Functions (`api/`), Zero-Trust signature enforcement, and Kiro Audit remediation.
- [x] **Admin Architecture Consolidation & Repository Hygiene (v3.63.0)**: Unified `TaskManager` components, implemented strict task interfaces, and archived legacy technical debt (Python/SQL) to ensure a pristine production environment.
- [x] **Multi-Asset Revenue Hardening & Financial Parity (v3.63.10-Hardened)**: Refactored dynamic aggregation of pending SBT funding totals, enforced robust BigInt payment verification in `admin-bundle.ts`, and highlighted selected reward tokens in `WalletPortfolio.tsx` with dynamic decimals.
- [x] **UGC Payment Auditing, Pure English UI & Premium UX (v3.64.0-Hardened)**: Overhauled the UGC creation pipeline with strict English localization across Warpcast, Twitter, TikTok, Instagram, and On-chain instructions. Integrated client-side insufficient balance checkpoints with the global `SwapModal` overlay and dynamic USDC fee calculations based on `DailyAppV15.sol`.
- [x] **UGC Mission Public API Migration & Authorization Fix (v3.64.1-Hardened)**: Transferred database onboarding from the highly restricted `/api/admin-bundle` (action: `CREATE_UGC_MISSION`) to the secure public `/api/user-bundle` (action: `sync-ugc-mission`). This removes the global `403 Forbidden` admin-gating constraint for ordinary sponsors, ensuring smooth, non-privileged mission creation while maintaining transaction integrity, cryptographic safety, and EIP-191 signatures.
- [x] **Hermes & LiteLLM Ecosystem Cleanout (v3.64.3-Hardened)**: Purged LiteLLM and Hermes Agent installations from the WSL environment and project directory to reduce technical debt, while fully preserving all Freemodel and DeepSeek API keys in the `.env` configuration file.
- [x] **Supreme Source of Truth (SOT) Hierarchy Consolidation (v3.64.4-Hardened)**: Integrated a supreme, deterministic Source of Truth (SOT) Hierarchy into `.cursorrules` and `CLAUDE.md` to establish an absolute command chain, resolving potential contradictions across contracts, dynamic database settings, and static guidelines.

## Identified ABI Drift (DAILY_APP) - [REPAIRED v3.38.25]
All identified drifts have been synchronized with `DailyAppV12Secured.json`.

| Function Name (Contract) | Status in ABI | Requirement |
|-------------------------|---------------|-------------|
| `renewSponsorship` | ✅ FIXED | Core sponsorship renewal |
| `syncMasterXPoints` | ✅ FIXED | XP synchronization with MasterX |
| `markTaskAsVerified` | ✅ FIXED | Task verification logic |
| `mintNFT` | ✅ FIXED | NFT onboarding |
| `upgradeNFT` | ✅ FIXED | NFT progression |
| `getTask` | ✅ FIXED | Task data retrieval |
| `canDoTask` | ✅ FIXED | User eligibility checks |
| `setSponsorshipParams` | ✅ FIXED | Sponsorship parameters |

- [x] AI-Driven Fraud Prevention Layer (Implemented via *Lurah Ekosistem*).

## Phase 3: Swap & Profit Engine (v3.47.0) [x]
- [x] Integrate Li.Fi Widget/SDK for multi-chain bridging and swaps.
- [x] Implement Integrator Fee (0.5%) sent to `MASTER_X_ADDRESS`.
- [x] Refactored to SDK-First custom UI to bypass Vercel Rollup build crash.
- [x] Add "Insufficient Balance" triggers in Profile and Raffle flows.

## Phase 3 Hotfix: Triple Bug Remediation (v3.47.1) [x]
- [x] **Task Two-Step Flow**: `TaskList.jsx` — GO TO TASK → 15s timer → CLAIM REWARD. Tasks must open external link before XP claim is allowed.
- [x] **Swap Quote Fix**: `SwapModal.jsx` — Fixed SDK re-init loop via `useRef`, added `toAddress` param (LiFi SDK v2 requirement), added visible error state + Jumper fallback.
- [x] **NFT Mint Contract Fix**: `SBTUpgradeCard.jsx` — Fixed wrong contract call (was `MASTER_X.upgradeTier`, now `DAILY_APP.mintNFT`). Contract call parity = data source must match write target.

## Phase 4: Ecosystem Growth & Advanced Governance [⏸️ ON HOLD]
> [!IMPORTANT]
> Phase 4 is currently **ON HOLD** per user request (2026-04-29). Focus remains on maintaining 100% parity across the established Nexus Command Center ecosystem.

- [ ] Tiered NFT Staking (Non-Riba based Utility).
- [ ] Community Treasury DAO (Revenue sharing logic - *Contract Implemented*).
- [x] **Mission Quest & Daily Goal Bonus**: Extra XP rewards for users who complete specific task milestones (e.g., 3 tasks per day). (v3.59.4)
- [ ] Multi-chain Expansion Strategy (Optimism/Arbitrum).

## Nexus Command Center Stabilization (v3.54.5) [x]
- [x] **Tier Economy Synchronization**: 100% parity achieved between `MasterX` and `DailyApp` XP thresholds.
- [x] **Parity Audit Layer**: Automated on-chain drift detection implemented in NCC (Base Sepolia).
- [x] **Sentinel Monitoring**: `ncc-sentinel.cjs` active, ensuring Healthy/Nominal status reporting.
- [x] **Live Lurah (v3.55.0)**: Deployed `api/lurah-cron.js` and scheduled proactive Telegram alerting on Vercel.
- [x] **Raffle Refund Protocol (v2.1)**: Implemented on-chain refund for rejected UGC raffles.
- [x] **Economy Parity Audit**: Verified 100% threshold alignment between MasterX and DailyApp.
- [x] **Concurrent UI Responsiveness (v3.56.0)**: Integrated `React.startTransition` for all heavy modal triggers to maintain <50ms INP across the ecosystem.
- [x] **Raffle Ecosystem Hardening & Zero-Trust Sync (v3.56.7)**: Resolved `UUID` schema constraint in Raffle history, implemented Zero-Trust message integrity across verification endpoints, and hardened database RPC error propagation for 100% XP parity.
- [x] **Global Sync Hardening & Nexus Audit (v3.63.1)**: Finalized global end-to-end sync.
- [x] **Build Integrity Hardening & Regression Repair (v3.63.2)**: Upgraded Nexus Orchestrator with TS Compiler API.
- [x] **Zero-Hardcode Address Parity & Raffle Sync Fix (v3.63.3)**: Corrected address misuse in `user-bundle.ts` and enforced Zero-Hardcode mandate.
- [x] **Admin Architecture Consolidation & Repository Hygiene (v3.63.0)**: Unified `TaskManager` components, implemented strict task interfaces, and archived legacy technical debt (Python/SQL) to ensure a pristine production environment.
- [x] **Serverless API Stabilization & ESM Module Resolution Fixes (v3.63.5-Hardened)**: Resolved persistent 500 (FUNCTION_INVOCATION_FAILED) serverless errors by enforcing strict ECMAScript Module (ESM) resolution compliance in the Vercel Node runtime.
- [x] **Database Security Remediation & View Hardening (v3.63.6-Hardened)**: Hardened the database ecosystem by neutralizing 15 high-risk `SECURITY DEFINER` functions and converting critical public-facing views to `SECURITY INVOKER` to strictly enforce RLS and prevent unauthorized access.
- [x] **High-Fidelity Auditing & Multi-Asset Infrastructure (v3.63.7-Hardened)**: Achieved millisecond-level audit precision across the ecosystem, integrated Native ETH/WETH/USDC support for all mission workflows, and resolved critical TypeScript errors in the Admin/UGC dashboards.
- [x] **Multi-Asset Revenue Hardening & Financial Parity (v3.63.10-Hardened)**: Refactored dynamic aggregation of pending SBT funding totals, enforced robust BigInt payment verification in `admin-bundle.ts`, and highlighted selected reward tokens in `WalletPortfolio.tsx` with dynamic decimals.
- [x] **UGC Payment Auditing, Pure English UI & Premium UX (v3.64.0-Hardened)**: Overhauled the UGC creation pipeline with strict English localization across Warpcast, Twitter, TikTok, Instagram, and On-chain instructions. Integrated client-side insufficient balance checkpoints with the global `SwapModal` overlay and dynamic USDC fee calculations based on `DailyAppV15.sol`.
- [x] **UGC Mission Public API Migration & Authorization Fix (v3.64.1-Hardened)**: Transferred database onboarding from the highly restricted `/api/admin-bundle` (action: `CREATE_UGC_MISSION`) to the secure public `/api/user-bundle` (action: `sync-ugc-mission`). This removes the global `403 Forbidden` admin-gating constraint for ordinary sponsors, ensuring smooth, non-privileged mission creation while maintaining transaction integrity, cryptographic safety, and EIP-191 signatures.
- [x] **UGC Multi-Asset Dynamic Conversion & Fee Parity (v3.64.2-Hardened)**: Overhauled `CreateMissionPage.tsx` calculations to calculate and display real-time USD/USDC equivalent amounts for all multi-asset parameters (Reward Pool, Dynamic Listing Fee, Reward per User, and Total Due). Enforced perfect dynamic conversion display using real-time price feeds for whitelisted assets (Native ETH, WETH, USDC) on the Base network.
- [x] **Hermes & LiteLLM Ecosystem Cleanout (v3.64.3-Hardened)**: Purged unused LiteLLM and Hermes Agent installations from the WSL environment and project codebase, while securely preserving all Freemodel and DeepSeek API keys in the `.env` profile.
## Immediate Protocol Constraints
- **Immutable Architect Protocol**: `viaIR: true`, `runs: 200`.
- **Pre-Flight Check**: Manual verification of state transitions before public release.

## Agent Self-Improvement Mandates (Added v3.47.1)
- **BP-001 — Contract Call Parity**: Always trace data lineage. Read from DAILY_APP → Write to DAILY_APP.
- **BP-002 — SDK Single Init**: SDK `createConfig` must be called once per app lifecycle (useRef guard).
- **BP-003 — No Silent Errors**: All async SDK calls must surface visible UI error state, not just console.error.
- **BP-004 — Two-Step Task Gate**: Off-chain tasks with task_link require GO_TO_TASK → timer → CLAIM flow.
