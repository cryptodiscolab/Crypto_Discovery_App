# Work Report: v3.64.21-Hardened — Contract Redeployment + Backup System
**Date:** 2026-05-23  
**Agent:** Cline (Claude Sonnet)  
**Commit:** `3b31e88` → `main`  
**Status:** ✅ COMPLETED & PUSHED

---

## Summary
Full security hardening session: redeployed MasterX + Raffle with Ownable2Step, upgraded DailyAppV16 with pause/nonReentrant, implemented automated DB backup system, fixed all sync issues.

---

## Contracts Changed

### CryptoDiscoMasterX (NEW — Ownable2Step)
- **Old:** `0x980770dAcE8f13E10632D3EC1410FAA4c707076c`
- **New:** `0x5916E4A76Ec2a790373FDC2C7410d5065856F142`
- **Change:** `Ownable` → `Ownable2Step` (two-step ownership transfer)

### CryptoDiscoRaffle (NEW — Ownable2Step)
- **Old:** `0xE7CB85c307f1c368DCB9FFcfa5f3e02324eaf1f3`
- **New:** `0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7`
- **Change:** `Ownable` → `Ownable2Step`

### DailyAppV16 (UUPS Proxy — unchanged address)
- **Proxy:** `0xb592D6819Ea310d83034cD80FDDC2e754D0a5353` (unchanged)
- **New Impl:** `0xFEAA096a0b5334F9F4C46Fc1624d647c2f97D251`
- **Changes:** Added inline `_paused` state + `whenNotPaused` modifier + `pause()`/`unpause()`. Added inline `_locked` + `nonReentrant` on `withdrawTreasury`.

---

## 7 Init Transactions
1. DailyAppV16 → MasterX linked (`setMasterX`)
2. DailyAppV16 → Raffle `DAILY_APP_ROLE` granted
3. MasterX → Raffle satellite whitelisted
4. QRNG params configured
5. First raffle initialized (raffleId=1)
6. Raffle entry price set
7. MasterX ownership transferred (Ownable2Step pending)

---

## Backup System

### Manual: `scripts/backup/backup_supabase.cjs`
```bash
node scripts/backup/backup_supabase.cjs
# Saves to: backups/YYYY-MM-DDTHH-mm-ss/ (local)
# Also uploads to: Supabase Storage db-backups/YYYY-MM-DDTHH-mm-ss/
# Telegram notification on completion/failure
```

### Automated: `Raffle_Frontend/api/cron/backup.ts`
- Runs daily at **05:00 UTC** via Vercel Cron
- Auto-rotates: keeps last **30** backups
- Covers: **15 tables**, initial backup = **735 rows**

### Initial Backup Result
```
Location (cloud): db-backups/2026-05-23T02-14-29 (Supabase Storage)
Location (local):  backups/2026-05-23T02-14-29/
Tables: 15 | Rows: 735 | Duration: ~18.8s
```

---

## Scripts Created (for other agents)

| Script | Purpose | Usage |
|---|---|---|
| `scripts/backup/backup_supabase.cjs` | Manual DB backup to Supabase Storage | `node scripts/backup/backup_supabase.cjs` |
| `scripts/deployments/init_new_contracts.cjs` | Initialize newly deployed contracts | `node scripts/deployments/init_new_contracts.cjs` |
| `scripts/deployments/upgrade_v16_impl.cjs` | UUPS upgrade DailyAppV16 | `node scripts/deployments/upgrade_v16_impl.cjs` |
| `scripts/sync/update_vercel_contracts.cjs` | Update Vercel env: contract addresses | `node scripts/sync/update_vercel_contracts.cjs` |
| `scripts/sync/sync_vercel_envs.cjs` | Sync all env vars to Vercel via API | `VERCEL_TOKEN=xxx node scripts/sync/sync_vercel_envs.cjs` |
| `scripts/sync/push_vercel_env_cli.cjs` | Push env vars via Vercel CLI | `node scripts/sync/push_vercel_env_cli.cjs` |

---

## Other Fixes Applied

- **CORS:** `verification-server/api/index.js` — origins whitelisted (Vercel + localhost only)
- **ABI:** `daily_app_abi.json` — 145 entries, +4 events (pause/unpause/Paused/Unpaused)
- **abis_data.txt** — rebuilt via `rebuild_abis_data.cjs`
- **package.json:** `@sentry/react@10.53.1` (exact), `axios@1.16.1` (exact)
- **npm install** — run in Raffle_Frontend
- **Vercel redeploy** — manual + env vars updated
- **git add -A && git push** — 20 files, 1824 insertions

---

## Pre-Commit Checks
```
✅ Anti-Negligence Hook: 100% PRISTINE
✅ Gitleaks: No leaks found
✅ backups/ in .gitignore (user PII - never commit)
✅ Vercel token removed from sync_vercel_envs.cjs
✅ Commit: 3b31e88  main → main
```

---

## Lessons Learned / Tips for Next Agent

1. **`vercel env add` hanya menerima 1 environment per call** — tidak bisa `production preview development` sekaligus
2. **Transaction hash (64 hex char) akan di-flag** oleh anti-negligence hook sebagai private key pattern — gunakan abbreviated form `0x40d5804...65ba78f2`
3. **`backups/` WAJIB ada di .gitignore** — berisi PII user, tidak boleh pernah di-commit
4. **Selalu gunakan RTK prefix** untuk semua shell commands: `rtk git status`, `rtk ls`, etc.
5. **`update_vercel_contracts.cjs`** adalah cara paling reliable untuk update Vercel env vars (spawnSync per-environment)
