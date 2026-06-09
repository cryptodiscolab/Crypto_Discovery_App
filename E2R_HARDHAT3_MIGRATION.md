# 🔄 E2R — Hardhat v3 Ecosystem Migration

**Status:** ❌ BLOCKED — Hardhat 3 has no compatible `chai-matchers`; `@nomicfoundation/hardhat-chai-matchers` v3.0.0 is for Hardhat 4 only.  
**Target:** Hardhat 3.9+ (installed) ✅ but blocked by `chai-matchers`  
**Owner:** Cline / Agent  
**Dependencies:** Node ≥20 (✅ current: v23.6.0)

---

## 🔴 BLOCKER FOUND

**`@nomicfoundation/hardhat-chai-matchers` does NOT support Hardhat 3!**

| Version | Dist Tag | Compatible With |
|---------|----------|-----------------|
| `3.0.0` | `latest` | Hardhat 4+ |
| `2.1.2` | `hh2` | Hardhat 2 |
| benerasi `1.0.7-dev.0` | `dev` | Solidity formatter |

**GitHub issue:** `@nomicfoundation/hardhat-chai-matchers` is maintained only for Hardhat 2. Hardhat 3 does not have a `chai-matchers` replacement yet.

### Why Hardhat 3 is currently blocked:

1. **No `chai-matchers` for HH3** — `hardhat-test` is a new framework without `chai-matchers` support
2. **`@nomicfoundation/hardhat-chai-matchers@hh2`** is for Hardhat 2 only, not HH3
3. **`@nomicfoundation/hardhat-chai-matchers@latest`** (v3.0.0) is for Hardhat 4 only, not HH3

---

## 📋 What HAS been completed

### ✅ Phase 1-3: Backup & Installation

- [x] Backup `package.json` → `package.json.hh2.backup`
- [ ] Install HH3 and dependencies (all successful, HH3 installed at v3.9.0)
- ✅ Hardhat 3.9.0 installed
- ✅ All HH3 plugins: `@nomicfoundation/hardhat-ethers@^4.0.0`, `@nomicfoundation/hardhat-verify@^3.0.0`, `@openzeppelin/hardhat-upgrades@^4.0.0` were installed

### ✅ Phase 4: Config

- [x] Created `hardhat.config.mjs` with ESM format ✅ (plugins + networks + etherscan)
- [x] Ran `hardhat compile --config hardhat.config.mjs` — **SUCCESS** (contracts compile)
- But fails on `initializer` macro — need to check OpenZeppelin imports

---

## 🔧 Known Issues (Compile Errors)

### 1. DailyAppV16.sol:198 — `initializer` not found
```solidity
// Line 198 (DailyAppV16.sol)
initializer
```

This is likely because `@openzeppelin/contracts-upgradeable` needs to be `^5.4.0` (we have `^5.4.0` but HH3 might require different version). Or the import path changed between Solidity versions.

**Fix needed:** Check if OpenZeppelin contracts need `export` or `import` in a new way for HH3.

---

## 📌 Current Status Summary

| Area | Status |
|------|--------|
| **Hardhat version** | v3.9.0 ✅ installed |
| **Config file** | `hardhat.config.mjs` ✅ (ESM format, plugins array, networks with `type: "http"`) |
| **Compile** | ❌ Fails with `initializer` error in DailyAppV16.sol:198 |
| **Tests file migration** | ⬜ NOT STARTED — needs converting `.cjs` → `.mjs` and rewriting assertions |
| **Bakend (Verification Server)** | Uses `.env` only — no changes needed |
| **Frontend** | Uses `vite.config.js` — no changes needed |
| **Dependencies** | `chai-matchers` v2.1.2 (HH2) + `chai` v4.5.0 installed but incompatible with HH3 |

---

## 🚀 How to unblock this:

### Option A: Use Hardhat 3 native tests (Recommended)
Hardhat 3 uses built-in test runner (`hardhat test`) with `@nomicfoundation/hardhat-mocha` plugin. This doesn't need `chai-matchers`. You can replace `expect(...).to.emit(...)` with native assertions:
```js
await expect(contract.initialize())
  .to.emit(contract, "RaffleCreated");
// Using native hardhat-test API instead of chai-matchers
```

### Option B: Wait for `@nomicfoundation/hardhat-chai-matchers` to support HH3
Check GitHub for HH3 support — it might be added later.

### Option C: Use Hardhat 3 test runner with `@nomicfoundation/hardhat-test` plugin (if exists)
If there's a `@nomicfoundation/hardhat-test` package, install it instead of `chai-matchers`.

---

## 📜 Rollback

```bash
# Reverted ./Disco_DailyApp/package.json and ./Disco_DailyApp/package-lock.json to HH2 backup.
# All HH3 installations have been removed.