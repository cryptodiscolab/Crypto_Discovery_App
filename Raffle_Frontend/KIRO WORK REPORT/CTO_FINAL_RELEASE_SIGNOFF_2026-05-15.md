# CTO Final Release Sign-Off - 2026-05-15

Workspace: `E:\Disco Gacha\Disco_DailyApp`  
Scope: Raffle Frontend, contract ABI integration, Supabase RLS, pending sync recovery, verifier health  
Decision: **CONDITIONAL RELEASE CANDIDATE**

This is the current CTO source-of-truth after remediation. Historical audit findings remain in the previous reports, but this document reflects the latest verified state on 2026-05-15.

## 1. Executive Decision

The project is **not yet 100% release ready**, but it is now a **conditional release candidate**.

The high-risk automated gates that were blocking the audit have been fixed and re-run:

- route registry parity,
- static ABI parity,
- live deployed ABI selector parity,
- live Supabase RLS smoke check,
- TypeScript,
- production build,
- production preview HTML smoke,
- gitleaks,
- verification-server health and security matrix.

The remaining blockers are release governance and manual/browser validation, not known compile-time or selector-level blockers.

## 2. Fixes Completed

### Contract / ABI Runtime Safety

- Static frontend `functionName` references now resolve against canonical ABI/local allowlist.
- Live Base Sepolia selector parity passes against deployed runtime/proxy implementation bytecode.
- Phantom deployed-missing calls were removed or disabled from runtime:
  - `doBatchTasks`,
  - `batchAddPoints`,
  - `setRaffleContract`,
  - `approveSponsorship`,
  - `rejectSponsorship`.
- Legacy on-chain sponsorship moderation controls are disabled because the deployed DailyApp contract does not expose those selectors.
- MasterX raffle pointer update is treated as deploy-managed because the deployed MasterX contract does not expose `setRaffleContract`.
- Bulk on-chain XP sync now fails fast with a clear operator message because the deployed MasterX contract does not expose `batchAddPoints`.

### Pending Sync Recovery

- Added recovery ledger coverage for sponsorship raffle creation.
- Added recovery coverage for raffle rejection/refund backend sync failure.
- Added recovery coverage for mission create payment success with backend failure.
- Backend endpoints and recovery hook now recognize the new pending sync job types.

### Supabase / RLS

- Added repeatable live RLS smoke script: `scripts/check-live-rls.cjs`.
- Live `agents_vault` anon exposure was fixed by enabling RLS and removing unrestricted SELECT policy.
- Local RLS hardening migration now protects both `agent_vault` and `agents_vault`.
- Sensitive table anon reads are blocked in the live smoke test.
- Safe public config reads remain allowed.

### Release Tooling

- Added live ABI selector script: `scripts/check-live-abi-selectors.cjs`.
- Added npm gates:
  - `npm run check-live-abi`,
  - `npm run check-live-rls`.
- API route checker now strips comments before extracting route references.
- `ENV_REGISTRY.md` cron entry is synced with `vercel.json`.
- `logs.txt` was removed from Git tracking.

## 3. Verification Passed

```text
node scripts/check-api-routes.cjs
PASS: 25/25 route references resolved
```

```text
node scripts/check-abi-parity.cjs
PASS: 123/123 function references resolved
```

```text
node scripts/check-live-abi-selectors.cjs --chain base-sepolia
PASS: Live selector parity passed for 125 selector(s)
```

```text
node scripts/check-live-rls.cjs
PASS: Live RLS smoke check passed
```

```text
node scripts/audits/check_sync_status.cjs
PASS: DB reachable, sentinel healthy, deployed verification server online, security matrix 13/13
```

```text
node node_modules/typescript/bin/tsc --noEmit
PASS
```

```text
npm run build
PASS with known chunk-size warnings
```

```text
npm run preview -- --host 127.0.0.1 --port 4173
PASS: production HTML returned from local preview
```

```text
npm run gitleaks-full
PASS: no leaks found
```

```text
git diff --check
PASS on touched remediation files
```

## 4. Remaining Blockers

### P0 - Clean Release Branch

Status: **Done** ✅

Created `release/v3.64.0` with 4 focused thematic commits:
1. `fix(abi)`: disable phantom contract calls, align admin UI with deployed selectors
2. `fix(recovery)`: wire pending sync into sponsorship raffle, reject, mission create
3. `chore(tooling)`: add live ABI/RLS check scripts, update package scripts
4. `docs`: CTO re-audit report, outstanding fix plan, final release signoff

Merged to `main`. Worktree is clean.

### P0 - Production-Like Browser E2E

Status: **Open — requires manual QA**

Build and preview smoke passed. Wallet/browser E2E needs manual validation with a funded test wallet. This is a QA team responsibility, not a code blocker.

Required flows:

- connect wallet,
- create sponsorship raffle,
- reject raffle with refund-first `cancelRaffle`,
- campaign join,
- daily claim,
- SBT upgrade,
- admin contract config write,
- pending sync recovery UI,
- notification flow.

### P1 - Social Verifier Scenario Test

Status: **Open if social tasks are in release scope**

Verifier health is green, but Farcaster/X task verification still needs a real fixture test if social tasks are part of this release.

### P2 - Bundle Optimization

Status: **Deferred with waiver**

Production build passes, but Vite still reports large Web3/vendor chunks above 500 kB. This is a performance optimization task, not a correctness blocker, if explicitly waived.

## 5. CTO Waiver / Release Condition

Release may proceed as **GREEN release candidate** with these conditions:

**Completed:**
- [x] clean release branch produced (`release/v3.64.0`, merged to `main`)
- [x] all automated gates pass (routes, ABI, TypeScript, build, gitleaks, RLS)
- [x] pending sync recovery wired into all high-risk flows
- [x] bundle-size warning accepted as P2 waiver

**Remaining (QA team responsibility):**
- [ ] high-risk wallet/browser E2E completed or explicitly waived by product/engineering leadership
- [ ] social verifier scenario test completed if social tasks are enabled

The project is **release-ready for staging/preview deployment**. Production mainnet release pending manual E2E QA pass.
