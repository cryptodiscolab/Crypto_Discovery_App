# Bug Guards

Use this file when diagnosing errors or changing risky paths.

## Error Keyword Routing

| Keyword | Read First |
|---|---|
| `gas`, `revert`, `execution reverted` | `src/hooks/useNFTTiers*`, `src/hooks/useSBT*`, `src/lib/contracts.js`, ABI |
| `mint`, `SBT`, `tier`, `upgrade` | `SBTUpgradeCard`, `useNFTTiers`, `useSBT`, `FEATURE_WORKFLOW_SOT` tier section |
| `raffle`, `ticket`, `claim prize`, `sponsor` | `useRaffle`, `raffle-bundle`, `raffle-integration/SKILL.md` |
| `XP`, `claim`, `task`, `mission` | `TaskList`, `useVerifiedAction`, `tasks-bundle`, `TASK_FEATURE_WORKFLOW.md` |
| `admin`, `dashboard`, `moderation` | `admin-bundle`, `src/features/admin/`, latest Kiro report |
| `database`, `Supabase`, `RLS`, `leaderboard` | `user-bundle`, `database.types`, Supabase skills, DB sync scripts |
| `env`, `address`, `ABI`, `function not found` | `.env*` carefully without exposing secrets, `contracts.js`, `abis_data.txt`, `WORKSPACE_MAP.md` |

## Known Failure Patterns

- Cross-contract mismatch: data read from DailyApp must write to DailyApp; do not mint via MasterX when config came from DailyApp.
- SDK re-init loop: initialize SDKs once per lifecycle with module guard or ref guard.
- Silent catch: async failures need visible UI error state, not only `console.error`.
- One-step claim: tasks with links need open-link and timer before claim.
- ABI drift: avoid index-only access; use named properties with fallback indices.
- TypeScript `never[]`: state arrays need explicit types or interfaces.
- ESM runtime: API relative imports need `.js`; TS-only items need `import type`.
- Direct Supabase frontend writes: sensitive writes must route through backend.
- Env silent corruption: trim env values in serverless code.
- Markdown table hallucination: read table headers before editing any table row.

## Closure Rules

Before saying done:

1. State what was verified.
2. State what was not verified and why.
3. Run gitleaks for security-sensitive or push-ready work.
4. Update PRD/SOT/skill only if behavior or architecture changed.
5. Leave no local server running.
