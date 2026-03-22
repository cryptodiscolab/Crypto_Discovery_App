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

## Identified ABI Drift (DAILY_APP)
The following functions exist in `DailyAppV12Secured.sol` but are missing or mismatched in the `DAILY_APP` ABI:

| Function Name (Contract) | Status in ABI | Requirement |
|-------------------------|---------------|-------------|
| `renewSponsorship` | ✅ FIXED | Core sponsorship renewal |
| `syncMasterXPoints` | ❌ MISSING | XP synchronization with MasterX |
| `markTaskAsVerified` | ⚠️ MISMATCHED | ABI uses `verifyTask` |
| `mintNFT` | ❌ MISSING | NFT onboarding |
| `upgradeNFT` | ❌ MISSING | NFT progression |
| `getTask` | ❌ MISSING | Task data retrieval |
| `canDoTask` | ❌ MISSING | User eligibility checks |
| `setSponsorshipParams` | ⚠️ MISMATCHED | ABI uses `setSettings` |

## Phase 3: Ecosystem Growth & Advanced Governance [ ]
- [ ] Tiered NFT Staking (Non-Riba based Utility).
- [ ] Community Treasury DAO (Revenue sharing logic - *Contract Implemented*).
- [ ] Multi-chain Expansion Strategy (Optimism/Arbitrum).
- [x] AI-Driven Fraud Prevention Layer (Implemented via *Lurah Ekosistem*).

## Immediate Protocol Constraints
- **Immutable Architect Protocol**: `viaIR: true`, `runs: 200`.
- **Pre-Flight Check**: Manual verification of state transitions before public release.
