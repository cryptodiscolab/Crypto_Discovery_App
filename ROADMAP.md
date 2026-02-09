# Crypto Disco: Phase 2 Roadmap

## Core Infrastructure (Operational)
- [x] **MasterX**: Revenue distribution and point system.
- [x] **Raffle**: Ticket-based NFT raffle system.

## Phase 2: Satellite Contracts & Frontend Integration

### Step 1: Satellite Deployment [/]
- [x] Develop `DailyApp.sol` (Lightweight Task System).
- [ ] Deploy `DailyApp.sol` to Base Sepolia.
- [ ] Link `DailyApp` as an authorized satellite in `MasterX`.

### Step 2: Verification [ ]
- [ ] Verify `MasterX` on BaseScan.
- [ ] Verify `Raffle` on BaseScan.
- [ ] Verify `DailyApp` on BaseScan.

### Step 3: Frontend Integration [ ]
- [ ] Setup React/Next.js scaffold (Farcaster/Mini App optimized).
- [ ] Implement NFT Raffle Buy & Claim functions.
- [ ] Implement Daily Claim & Reward Pool Distribution logic.
- [ ] Neynar API Integration (Social Verification).
- [ ] Base Paymaster Integration (Gasless transactions).

## Immediate Protocol Constraints
- **Immutable Architect Protocol**: `viaIR: true`, `runs: 200`.
- **Pre-Flight Check**: Manual verification of state transitions before public release.
