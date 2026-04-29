# Crypto Disco: Phase 2 Roadmap

## Core Infrastructure (Operational)
- [x] **MasterX**: Revenue distribution and point system.
- [x] **Raffle**: Ticket-based NFT raffle system.

## Phase 2: Satellite Contracts & Frontend Integration

### Step 1: Satellite Deployment [/]
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
- [ ] Multi-chain Expansion Strategy (Optimism/Arbitrum).

## Nexus Command Center Stabilization (v3.54.5) [x]
- [x] **Tier Economy Synchronization**: 100% parity achieved between `MasterX` and `DailyApp` XP thresholds.
- [x] **Parity Audit Layer**: Automated on-chain drift detection implemented in NCC (Base Sepolia).
- [x] **Sentinel Monitoring**: `ncc-sentinel.cjs` active, ensuring Healthy/Nominal status reporting.
- [x] **Live Lurah (v3.55.0)**: Deployed `api/lurah-cron.js` and scheduled proactive Telegram alerting on Vercel.
- [x] **Raffle Refund Protocol**: Implemented on-chain refund for rejected UGC raffles (v2.1).
- [x] **Economy Parity Audit**: Verified 100% threshold alignment between MasterX and DailyApp.

## Immediate Protocol Constraints
- **Immutable Architect Protocol**: `viaIR: true`, `runs: 200`.
- **Pre-Flight Check**: Manual verification of state transitions before public release.

## Agent Self-Improvement Mandates (Added v3.47.1)
- **BP-001 — Contract Call Parity**: Always trace data lineage. Read from DAILY_APP → Write to DAILY_APP.
- **BP-002 — SDK Single Init**: SDK `createConfig` must be called once per app lifecycle (useRef guard).
- **BP-003 — No Silent Errors**: All async SDK calls must surface visible UI error state, not just console.error.
- **BP-004 — Two-Step Task Gate**: Off-chain tasks with task_link require GO_TO_TASK → timer → CLAIM flow.
