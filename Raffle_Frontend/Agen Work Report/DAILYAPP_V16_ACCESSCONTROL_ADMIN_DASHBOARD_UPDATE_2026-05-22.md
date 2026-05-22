# DailyApp V16 AccessControl Admin Dashboard Update - 2026-05-22

## Scope

Updated the project source-of-truth files after DailyApp V16 deployment and the admin dashboard AccessControl patch.

## Live Contract State

| Item | Value |
|---|---|
| DailyApp V16 proxy | `0xb592D6819Ea310d83034cD80FDDC2e754D0a5353` |
| DailyApp V16 implementation | `0x77f3E2CD30f871723b05Bf36C23a431B7e2d7c61` |
| MasterX | `0x980770dAcE8f13E10632D3EC1410FAA4c707076c` |
| Raffle | `0xE7CB85c307f1c368DCB9FFcfa5f3e02324eaf1f3` |
| Deployer / temporary role target | `0x52260C30697674A7C837feb2Af21BbF3606795C8` |

## Admin Dashboard Update

`Raffle_Frontend/src/features/admin/components/RoleManagementTab.tsx` now exposes `DailyApp V16 AccessControl`.

Supported role actions:

| Action | Function |
|---|---|
| Grant role | `grantRole(bytes32 role, address account)` |
| Revoke role | `revokeRole(bytes32 role, address account)` |

Supported roles:

| Role |
|---|
| `ADMIN_ROLE` |
| `VERIFIER_ROLE` |
| `RAFFLE_ROLE` |
| `SOCIAL_ROLE` |
| `UGC_ROLE` |
| `MOJO_ROLE` |
| `SWAP_ROLE` |
| `PURCHASE_ROLE` |
| `DEFAULT_ADMIN_ROLE` |

## Production Handover Rule

For mainnet or production wallet rotation:

1. Grant the role to the new wallet or contract.
2. Verify `hasRole(role, newTarget)` on-chain.
3. Revoke the old deployer or service-wallet role only after the new target is confirmed.

## Env Rule

Frontend contract resolution must prefer `VITE_DAILY_APP_V16_ADDRESS`. Legacy `VITE_V12_CONTRACT_ADDRESS*` keys are fallback only.

## ABI / Runtime Compatibility Delta

DailyApp frontend ABI sources were synced to the compiled `DailyAppV16` artifact:

| File | Status |
|---|---|
| `Raffle_Frontend/src/lib/daily_app_abi.json` | Synced to `DailyAppV16` ABI |
| `Raffle_Frontend/src/lib/abis_data.txt` | `ABIS.DAILY_APP` synced to `DailyAppV16` ABI |
| `Raffle_Frontend/api/_shared/constants.ts` | DailyApp address resolver prefers `VITE_DAILY_APP_V16_ADDRESS` |
| `Raffle_Frontend/scripts/check-live-abi-selectors.cjs` | DailyApp env key list prefers `VITE_DAILY_APP_V16_ADDRESS` |

V13/V15-only selectors are disabled or routed away from on-chain writes when the active DailyApp is V16. This includes `syncOffchainXP`, `mintNFTWithEntitlement`, `claimRewards`, `setSponsorshipParams`, `approveSponsorship`, `rejectSponsorship`, `buySponsorshipWithToken`, and `userSponsorshipProgress`.

SBT upgrade now calls `DailyAppV16.mintNFT(uint8 tier)` through `useNFTTiers.mintTier(...)`; entitlement voucher minting is legacy-only.

## Verification

| Check | Result |
|---|---|
| `npm run check-abi` | Pass: 101/101 referenced functions resolved |
| `npm run check-live-abi -- --chain base-sepolia` | Pass: 103 live selectors verified |
| Frontend lint | Pass: 0 errors, 18 existing warnings |
| Frontend build | Pass |
| Gitleaks | Pass: no leaks found |
