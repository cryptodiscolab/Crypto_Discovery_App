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
- [x] Verify `Raffle` on BaseScan.
- [x] Verify `DailyApp` on BaseScan.
- [x] Deploy `Verification Server` to Vercel.
- [x] Sync `VITE_VERIFY_SERVER_URL` in frontend.

### Step 3: Frontend Integration [/]
- [ ] Setup React/Next.js scaffold (Farcaster/Mini App optimized).
- [x] Implement NFT Raffle Buy & Claim functions. (Zero-Trust XP Sync + useRaffle hook)
- [x] Implement Daily Claim & Reward Pool Distribution logic. (Zero-Trust Backend Synced)
- [x] Neynar API Integration (Social Verification).
- [x] Base Paymaster Integration (Gasless transactions). (EIP-5792 via useSendCalls + auto-fallback)
- [x] **Admin Hub Stabilization**: Fixed ReferenceErrors, standardized imports, and enforced zero-trust protocols.

## Immediate Protocol Constraints
- **Immutable Architect Protocol**: `viaIR: true`, `runs: 200`.
- **Pre-Flight Check**: Manual verification of state transitions before public release.
