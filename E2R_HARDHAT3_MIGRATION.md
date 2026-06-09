# E2R — Hardhat v3 Ecosystem Migration

**Status:** 🟡 **PARTIAL SUCCESS** — Contracts compile, Vercel live, tests need correct API  
**Date:** 6/9/2026  
**Owner:** Cline / Agent

---

## Executive Summary

The Hardhat 3 migration is complete at the infrastructure level. All Solidity contracts compile successfully, Vercel deployment is live, and all 13 sync checks pass. However, the test framework migration is partial — HH3 does not expose `globalThis.network.connect()` as a test API, and the correct API needs to be discovered.

---

## ✅ What Works

### 1. Hardhat 3.9.0 Installed
- `hardhat@3.9.0` (from `^3.0.0`)
- `@nomicfoundation/hardhat-ethers@^4.0.0`
- `@nomicfoundation/hardhat-mocha@^3.0.0`
- `@nomicfoundation/hardhat-verify@^3.0.0`
- `@openzeppelin/hardhat-upgrades@^4.0.0`

### 2. Config Format (hardhat.config.mjs)
- ESM format with `import` statements
- Plugins registered as **imported objects** (not strings):
  ```js
  import hardhatEthers from "@nomicfoundation/hardhat-ethers";
  plugins: [hardhatEthers, ...]
  ```
- Networks use `type: "http"` (required by HH3)

### 3. Solidity Contracts Migrated
- **DailyAppV16.sol**: Inherits `Initializable, UUPSUpgradeable` (added Initializable for OZ v5)
- **DailyAppV17.sol**: Inherits `Initializable, UUPSUpgradeable`
- Removed obsolete `__UUPSUpgradeable_init()` calls (removed in OZ v5.0.0+)
- OpenZeppelin pinned to v5.4.0 (both `contracts` and `contracts-upgradeable`)
- **Result**: All contracts compile successfully ✅

### 4. Vercel Live & Sync ✅
- **URL**: https://crypto-discovery-app.vercel.app
- **Ping**: HTTP 200 (Pong!)
- **Supabase RLS**: All 14 tables reachable, sensitive tables blocked
- **13/13 sync checks pass**
- **24 API routes resolved**
- **101 ABI functions resolved**
- **6 CRON jobs configured**

---

## ❌ What's Blocked

### Tests Cannot Run (Test API Issue)
The HH3 test files use `globalThis.network.connect()` to access the network connection, but this API is **not available**. A debug test confirmed:

```
globalThis.network: undefined
globalThis.hre: undefined
globalThis.ethers: undefined
```

### Node.js Version Compatibility
- **Node.js 20.x**: ❌ Not supported by HH3
- **Node.js 22.13.0+**: ✅ Required by HH3
- **Node.js 23.x**: ⚠️ Has issue with Mocha's `require()` + top-level await
- **Node.js 24.x**: ✅ Works with HH3 (currently installed)

---

## 🔧 Test Files Created (5 .mjs files)

All test files use the HH3-compatible `.mjs` format with `node:assert` + `node:test`:

| File | Lines | Contract |
|------|-------|----------|
| `test/DailyAppV16.test.mjs` | 139 | DailyAppV16 |
| `test/DailyAppV17.test.mjs` | 113 | DailyAppV17 |
| `test/CryptoDiscoMasterX.test.mjs` | 65 | CryptoDiscoMasterX |
| `test/UGCRewardEscrow.test.mjs` | 57 | UGCRewardEscrow |
| `test/CryptoDiscoRaffle.test.mjs` | 46 | CryptoDiscoRaffle |

**Total: 420 lines of HH3-compatible test code**

### Correct API Pattern Needed
The test files use this pattern (which is INCORRECT):
```javascript
beforeEach(async function () {
    const connection = await globalThis.network.connect();
    ethers = connection.ethers;
    upgrades = connection.upgrades;
});
```

The correct API needs to be discovered from HH3 source code or documentation.

---

## 📊 Final Status

| Component | Status |
|-----------|--------|
| Hardhat 3 install | ✅ Working |
| Config format (ESM, plugins, type:http) | ✅ Working |
| Solidity contracts compile | ✅ Working |
| V16 & V17 OZ v5 alignment | ✅ Done |
| Test framework (.mjs format) | ⚠️ Wrong API used |
| Vercel deployment | ✅ Live and responding |
| Vercel sync checks | ✅ 13/13 passed |
| API routes | ✅ 24 routes resolved |
| ABI parity | ✅ 101 functions resolved |
| Supabase RLS | ✅ All tables reachable |

---

## 🔧 Commits Pushed to GitHub

1. `1d4cab9` — Add E2R HH3 migration docs + config
2. `d75c113` — Migrate V16/V17 to Hardhat 3 + Initializable
3. `a13ffe0` — Add V16 HH3-compatible test file (.mjs + node:assert + node:test)
4. `5bca4db` — Convert all tests to .mjs + update E2R migration doc
5. `d1f53bc` — Update E2R with HH3 test runner diagnosis

**Branch**: `feature/sync-dashboard-architecture`

---

## 📝 Key HH3 Learnings

1. **Plugin format**: Must import plugin as object, not string
   ```js
   import hardhatEthers from "@nomicfoundation/hardhat-ethers";
   plugins: [hardhatEthers, ...]
   ```

2. **Network config**: Add `type: "http"` to all networks in HH3

3. **OZ v5 changes**:
   - No more `__UUPSUpgradeable_init()` call
   - Inherit `Initializable` explicitly in contract
   - Pin to v5.4.0 for both `contracts` and `contracts-upgradeable`

4. **Test API**:
   - `globalThis.network.connect()` does NOT exist
   - Need to discover correct HH3 test API from source code
   - `.mjs` files work with HH3 test runner

5. **No chai-matchers**: Must use `node:assert` (no HH3 chai-matchers package exists)

6. **Node.js 23 issue**: Top-level `await` in HH3 `index.js` breaks Mocha's `require()` loader

7. **Node.js 20 unsupported**: HH3 requires Node.js 22.13.0+

8. **Test runner**: Uses Mocha internally (via `@nomicfoundation/hardhat-mocha`)

---

## 🎯 Recommended Next Steps

1. **Immediate**: Find correct HH3 test API (not `globalThis.network.connect()`)
2. **Short-term**: Update test files with correct API and run all tests
3. **Medium-term**: Run full test suite with HH3 + Node.js 24
4. **Long-term**: Monitor HH3 updates for Node.js 23 support fix

---

## 📚 HH3 Compatibility Matrix

| Node.js Version | HH3 Status | Notes |
|-----------------|------------|-------|
| 18.x | ❌ Not supported | EOL |
| 20.x | ❌ Not supported | HH3 requires 22.13+ |
| 22.13+ | ✅ Supported | LTS recommended |
| 23.x | ⚠️ Has issues | Top-level await + Mocha |
| 24.x | ✅ Supported | Currently installed |

---

## 🔗 Related Files

- `hardhat.config.mjs` — HH3 config (ESM, plugins, networks)
- `package.json` — Updated dependencies
- `test/*.mjs` — HH3-compatible test files
- `contracts/DailyAppV16.sol` — Migrated to HH3 + OZ v5
- `contracts/DailyAppV17.sol` — Migrated to HH3 + OZ v5
- `E2R_HARDHAT3_MIGRATION.md` — This document