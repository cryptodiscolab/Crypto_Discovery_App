---
name: disco-codebase-builder
description: "Build, fix, audit, document, or deploy the Crypto Disco DailyApp codebase with repo-specific protocol awareness. Use for any task in this workspace touching Raffle_Frontend, api bundles, Supabase, smart contracts, PRD/SOT docs, agents/skills, Vercel, XP/rewards, raffle/UGC, admin dashboards, wallet/Web3 flows, security hardening, build failures, or architecture sync. Optimized for token-efficient self-evolving work: read only the relevant canonical docs, apply surgical changes, run targeted verification, and update living knowledge when code changes."
---

# Disco Codebase Builder

## Prime Directive

Operate as a token-disciplined senior engineer for Crypto Disco DailyApp. Prefer the newest canonical source, verify before editing, make surgical changes, and close the loop with targeted checks plus documentation sync when behavior changes.

## Token-Efficient Boot

Read the smallest set that proves the task context:

1. Always start with `.agents/WORKSPACE_MAP.md` for navigation and `.cursorrules` for master rules.
2. For feature behavior, read only relevant sections of `PRD/DISCO_DAILY_MASTER_PRD.md` and `PRD/FEATURE_WORKFLOW_SOT.md`.
3. For task/XP work, read `PRD/TASK_FEATURE_WORKFLOW.md` and `.agents/skills/xp-reward-lifecycle/SKILL.md`.
4. For raffle/UGC work, read `.agents/skills/raffle-integration/SKILL.md` and latest `Raffle_Frontend/KIRO WORK REPORT/*.md` relevant headings.
5. For DB/Auth/RLS work, use `.agents/skills/supabase/SKILL.md`, `.agents/skills/supabase-audit/SKILL.md`, and DB-related SOT only.
6. For UI work, read `DESIGN.md` if present, then `.agents/skills/design-protocol/SKILL.md`.

Do not bulk-read old PRD versions unless investigating historical drift.

## Working Loop

1. Classify the task: frontend, API, DB, contract, docs, deploy, audit, or mixed.
2. Read code before writing: modified file, immediate caller, shared utilities, and route/ABI/env registry if relevant.
3. Run pre-fix audit for architecture, contract, env, DB, or security tasks:
   `node scripts/audits/check_sync_status.cjs`
4. Implement narrowly. Do not create new API functions when a bundle action can be added.
5. Verify with the cheapest meaningful checks first, then escalate:
   `node -c` for JS bundles, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run gitleaks-check`.
6. Update docs only when behavior, architecture, route maps, contracts, economics, DB schema, or protocol rules changed.
7. Summarize honestly: changed files, verification run, skipped checks, and residual risk.

## Non-Negotiables

- Chat in Bahasa Indonesia; UI copy and code-facing labels in English.
- Zero-hardcode: no literal XP/rewards/fees/prices/contract addresses in business logic. Use `point_settings`, `system_settings`, env resolvers, contract registry, or allowed token metadata.
- Zero-trust: sensitive writes go through backend APIs with signature/timestamp/receipt checks. Never write sensitive Supabase data directly from React.
- Vercel Hobby guard: stay at or under the existing 12 function architecture. Put new behavior in existing `*-bundle` actions or `_shared`.
- API ESM runtime: relative imports in `Raffle_Frontend/api/` must include `.js`; TypeScript-only references use `import type`.
- ABI parity: before contract calls, verify function exists in `src/lib/abis_data.txt` and route through `src/lib/contracts.js` proxy pattern.
- Data parity: keep Frontend, Backend, DB, ABI, Contract, Admin, and PRD aligned.
- Git hygiene: no env files, media/screenshots, dumps, logs, temp scripts, or build artifacts. Run gitleaks before push or security-sensitive closure.
- RTK first: on this Windows workspace, prefer `.\.bin\rtk.exe <subcommand>` instead of bare `rtk` because RTK may not be on the active PowerShell PATH. If project filters warn as untrusted, read `.rtk/filters.toml`, then run `.\.bin\rtk.exe trust` only after confirming the filters are safe. Use native PowerShell only when the specific RTK subcommand fails or cannot express the operation, and state that fallback.
- Local hygiene: stop local dev servers after verification.
- No heavy UI animation libraries; use CSS/Tailwind. Avoid glass-wall overlays with pointer event discipline.

## Domain Rules

### XP, Tasks, Identity
- Daily claim sync is receipt-verified through `Raffle_Frontend/api/_user-bundle.ts` action `daily-claim`; DB activity category remains `XP`, and `DAILY` is only a virtual API/UI category for dashboard/history filters.
- Off-chain XP must call `fn_increment_xp(p_wallet, p_amount)` with raw base XP from `point_settings`.
- Do not calculate anti-whale scaling in JS; the DB RPC owns final XP.
- Two-step task flow is mandatory for linked tasks: open link, countdown, then claim.
- Dynamic system tasks like `raffle_buy_*` resolve base keys such as `raffle_buy` from `point_settings`, not `daily_tasks`.
- Social identity must stay 1 account : 1 wallet. Base/Farcaster/X gates must be enforced both UI-side and backend-side.

### Raffle and UGC
- Use `CONTRACTS.RAFFLE` and proxy ABIs, never hardcoded addresses.
- Raffle rejection is refund-first: call `cancelRaffle()` on-chain before DB rejection.
- Purchase/win/create events need backend logging with `tx_hash`, value metadata, and XP sync where applicable.
- Multi-asset UI must use dynamic symbol/decimals from allowed token data. Do not hardcode ETH/USDC labels where token data exists.

### Admin, Ledger, Economy
- Admin writes require signature and `admin_audit_logs`.
- Ledger events use `user_activity_logs` with `PURCHASE`, `REWARD`, or `EXPENSE`.
- PnL and zero-riba constraints are product rules. Do not introduce interest/APY/inflationary staking.
- Financial dashboards must not suggest spending above net surplus.

### UI
- Native+ labels: `text-[11px] font-black uppercase tracking-[0.2em] leading-none`.
- Body/content: `text-[13px] font-medium leading-relaxed`.
- Values: `text-[12px] font-bold tracking-wide`.
- Fixed nav/header: `z-[9999] pointer-events-auto`; background overlays use `pointer-events-none`.
- Respect mobile safe areas with `.pb-safe`/`.pt-safe`.

## Conflict Handling

Use newest source in this order unless live code proves otherwise:

1. `PRD/DISCO_DAILY_MASTER_PRD.md`
2. `.cursorrules`
3. `.agents/WORKSPACE_MAP.md`
4. `PRD/FEATURE_WORKFLOW_SOT.md`
5. latest Kiro report
6. older PRDs and legacy skills

If a rule conflicts with the active Codex system/developer instructions, follow Codex instructions and preserve the repo rule's intent where possible.

## Self-Evolution

When a new bug pattern, route map, contract upgrade, audit command, or hard-won lesson appears:

1. Add the smallest useful note to the most relevant existing SOT/skill.
2. Prefer updating `references/quick-map.md` for this skill instead of bloating `SKILL.md`.
3. Keep entries actionable: trigger, files to read, fix guard, verification.
4. Do not create paper-only protocol; pair rules with code, scripts, or checks when possible.

## References

- `references/quick-map.md`: compact file map, commands, and task-to-doc routing.
- `references/bug-guards.md`: recurring failure patterns and required pre-read targets.
