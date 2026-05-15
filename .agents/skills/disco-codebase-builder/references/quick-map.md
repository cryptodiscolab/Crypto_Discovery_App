# Quick Map

Use this file only when a task needs fast routing.

## Canonical Docs

| Need | Read |
|---|---|
| Navigation | `.agents/WORKSPACE_MAP.md` |
| Master rules | `.cursorrules` |
| Product truth | `PRD/DISCO_DAILY_MASTER_PRD.md` |
| Feature flows | `PRD/FEATURE_WORKFLOW_SOT.md` |
| Task/XP flows | `PRD/TASK_FEATURE_WORKFLOW.md` |
| Ledger/economy | `PRD/ACCOUNTANT_LEDGER_SOT.md` |
| Recent audit state | `Raffle_Frontend/KIRO WORK REPORT/FINAL_AUDIT_STATUS.md` and latest session report |

## Code Areas

| Area | Path |
|---|---|
| Main app | `Raffle_Frontend/` |
| Frontend source | `Raffle_Frontend/src/` |
| Admin components | `Raffle_Frontend/src/features/admin/` |
| Hooks | `Raffle_Frontend/src/hooks/` |
| Contract config/ABIs | `Raffle_Frontend/src/lib/contracts.js`, `Raffle_Frontend/src/lib/abis_data.txt` |
| Serverless API | `Raffle_Frontend/api/` |
| Shared API code | `Raffle_Frontend/api/_shared/` |
| Audits | `scripts/audits/` |
| Sync scripts | `scripts/sync/` |
| Contracts | `DailyApp.V.12/contracts/` |

## Verification Ladder

Use the narrowest check that proves the change:

| Change | Checks |
|---|---|
| API syntax | `node -c Raffle_Frontend/api/<file>.js` or TS build check |
| API/runtime imports | verify relative imports include `.js` |
| Frontend TS | `cd Raffle_Frontend && npx tsc --noEmit` |
| Frontend build | `cd Raffle_Frontend && npm run build` |
| Repo health | `node scripts/audits/check_sync_status.cjs` |
| DB/backend | `node scripts/audits/verify-db-sync.cjs` |
| Secrets | `npm run gitleaks-check` |

For heavy builds, consider `NODE_OPTIONS="--max-old-space-size=4096"` on the user's low-spec environment.

## Active Contract Registry Snapshot

Treat this as a hint, not proof. Verify against `.env`, `.cursorrules`, and `WORKSPACE_MAP.md` before contract work.

| Contract | Base Sepolia |
|---|---|
| DailyApp V15 | `0x0D6f339795EeA5129461388F25dE4f87e92b8DA2` |
| DailyApp V14 | `0x888fE02bd09642de385E55DdC6D8a7Ab5580f834` |
| DailyApp V13.2 | `0x81D65Cc9267e2eBF88D079e3598Ec78f48aE4B5D` |
| MasterX | `0x980770dAcE8f13E10632D3EC1410FAA4c707076c` |
| Raffle | `0xE7CB85c307f1c368DCB9FFcfa5f3e02324eaf1f3` |
| CMS V2 | `0xd992f0c869E82EC3B6779038Aa4fCE5F16305edC` |

Mainnet addresses are reserved unless verified otherwise.
