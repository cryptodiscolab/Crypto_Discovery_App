# E2R — Hardhat v3 Ecosystem Migration

**Status:** 🟡 **PARTIAL SUCCESS** — Contracts compile, tests blocked by Node.js 23 incompatibility  
**Target:** Hardhat 3.9+ ✅ **DONE** | Tests ❌ **BLOCKED** (Node.js 23 + Mocha)  
**Date:** 6/9/2026  
**Owner:** Cline / Agent

---

## ✅ What's Working

### 1. Hardhat 3.9.0 Installed
- `hardhat@3.9.0` (from `^3.0.0`)
- `@nomicfoundation/hardhat-ethers@^4.0.0`
- `@nomicfoundation/hardhat-mocha@^3.0.0`
- `@nomicfoundation/hardhat-verify@^3.0.0`
- `@openzeppelin/hardhat-upgrades@^4.0.0`

### 2. Config Format Fixed
- `hardhat.config.mjs` (ESM format)
- Plugins registered as **imported objects** (not strings):
  ```js
  import hardhatEthers from "@nomicfoundation/hardhat-ethers";
  plugins: [hardhatEthers, ...]
  ```
- Networks use `type: "http"` for HH3

### 3. Solidity Contracts Updated
- **`DailyAppV16.sol`**: Inherits `Initializable, UUPSUpgradeable` (added Initializable)
- **`DailyAppV17.sol`**: Inherits `Initializable, UUPSUpgradeable` (added Initializable)
- Removed obsolete `__UUPSUpgradeable_init()` calls (removed in OZ v5.0.0+)
- OpenZeppelin contracts pinned to v5.4.0 (both `contracts` and `contracts-upgradeable`)

### 4. Compilation Works ✅
```bash
$ node node_modules/hardhat/dist/src/cli.js compile --config hardhat.config.mjs
✅ All contracts compile successfully
```

### 5. Vercel Live & Sync ✅
- **URL**: https://crypto-discovery-app.vercel.app
- **Ping**: HTTP 200 (Pong!)
- **Supabase RLS**: All 14 tables reachable, sensitive tables blocked
- **All 13 sync checks pass** (Sentry, axios, .env.example, backup.ts, middleware.ts, test files, RLS migration)
- **6 CRON jobs configured** (sync-events, reward-claim-reminders, sync-xp-onchain, lurah-cron, reconcile-pending, backup)

### 6. Test Files Converted to HH3 .mjs Format
- `test/DailyAppV16.test.mjs` — Uses `node:assert` + `node:test`
- `test/DailyAppV17.test.mjs` — Uses `node:assert` + `node:test`
- `test/CryptoDiscoMasterX.test.mjs` — Uses `node:assert` + `node:test`
- `test/UGCRewardEscrow.test.mjs` — Uses `node:assert` + `node:test`
- `test/CryptoDiscoRaffle.test.mjs` — Uses `node:assert` + `node:test`
- **Note**: .mjs files created but blocked by HH3 + Node.js 23 incompatibility (see below)

---

## 🔴 Blocker: Tests Cannot Run

### Root Cause
**`hardhat/dist/src/index.js`** has a top-level `await` that Mocha's `require()` loader cannot handle in Node.js 23:

```js
// hardhat/dist/src/index.js
await getOrCreateGlobalHardhatRuntimeEnvironment();
```

This causes `ERR_REQUIRE_ASYNC_MODULE` when Mocha tries to load test files.

### Error Message
```
Error [ERR_REQUIRE_ASYNC_MODULE]: require() cannot be used on an ESM graph with top-level await. Use import() instead. To see where the top-level await comes from, use --experimental-print-required-tla.
```

### What Was Tried
1. `--experimental-require-module` flag — Still fails
2. `--experimental-print-required-tla` — Shows top-level `await` in `index.js:4`
3. Both `.cjs` and `.mjs` test files — Both fail with same error
4. `globalThis.network.connect()` API — Undefined in test context

### Possible Solutions
1. **Downgrade Node.js to v20** — May resolve the issue
2. **Wait for HH3 patch** — Hardhat team may fix the top-level `await` issue
3. **Use HH2 for tests** — Keep HH3 for contracts only
4. **Use Vitest instead of Mocha** — Vitest supports ESM natively

---

## 📊 Final Status

| Component | Status |
|-----------|--------|
| Hardhat 3 install | ✅ Working |
| Config format | ✅ Working (ESM, plugins array, type:http) |
| Solidity contracts | ✅ Compiling |
| V16 & V17 fixes | ✅ Done |
| OpenZeppelin v5 alignment | ✅ Done |
| Test framework | ❌ Blocked (Node.js 23 + Mocha + top-level await) |
| Vercel deployment | ✅ Live and responding |
| Vercel sync checks | ✅ 13/13 passed |
| API routes | ✅ 24 routes resolved |
| ABI parity | ✅ 101 functions resolved |
| Supabase RLS | ✅ All tables reachable |

---

## 🔧 Commits Made

1. `1d4cab9` — Add E2R HH3 migration docs + config
2. `d75c113` — Migrate V16/V17 to Hardhat 3 + Initializable
3. `a13ffe0` — Add V16 HH3-compatible test file (.mjs + node:assert + node:test)
4. `5bca4db` — Convert all tests to .mjs + update E2R migration doc

---

## 📝 Key HH3 Learnings

1. **Plugin format**: Must import plugin as object: `import hardhatEthers from "@nomicfoundation/hardhat-ethers"` then `plugins: [hardhatEthers]`
2. **Network config**: Add `type: "http"` to all networks
3. **OZ v5 changes**: No more `__UUPSUpgradeable_init()` call; inherit `Initializable` explicitly
4. **Test API**: HH3 uses `hre.network.connect().ethers` instead of `import { ethers } from "hardhat"`
5. **No chai-matchers**: Must use `node:assert` (no HH3 chai-matchers package exists)
6. **Test runner**: Uses Mocha internally (via `@nomicfoundation/hardhat-mocha`)
7. **Node.js 23 issue**: Top-level `await` in HH3 `index.js` breaks Mocha's `require()` loader
8. **Workaround**: Use `--experimental-print-required-tla` to diagnose, but no fix available yet

---

## 🎯 Recommended Next Steps

1. **Short-term**: Keep HH2 for running tests, HH3 for contracts only
2. **Medium-term**: Downgrade Node.js to v20 LTS to test HH3 compatibility
3. **Long-term**: Monitor HH3 updates for Node.js 23 support fix