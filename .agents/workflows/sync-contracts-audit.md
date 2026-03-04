---
description: Sync latest contracts across .env, .cursorrules, and check privacy (gitignore/private_key).
---

# Sync Contracts & Privacy Audit Workflow

This workflow ensures absolute synchronization of the latest smart contracts and absolute protection of sensitive data (`PRIVATE_KEY` and `.env`).

## 📋 Steps to Execute

### 1. Contract Address Verification
Identify the source of truth for the latest contracts.
- [ ] Check `.env` in the Root and Frontend directories.
- [ ] Check recent deployment logs or `ROADMAP.md`.
- [ ] Verify addresses match between `.env` and `.cursorrules`.

### 2. Synchronization of Reference Data
Update all architecture files to match the latest addresses.
- [ ] Edit `E:\Disco Gacha\Disco_DailyApp\.cursorrules` (Section 10: Verified Infrastructure Reference).
- [ ] Edit `E:\Disco Gacha\Disco_DailyApp\CONTRACTS_DOCUMENTATION.md` (if exists).

### 3. Absolute Privacy Audit (Zero-Exposure)
Audit the environment variables for leaks.
- [ ] Verify `PRIVATE_KEY` is not used in ANY frontend code (must use `.env.local` or `.env` and NOT be prefixed with `VITE_` or `NEXT_PUBLIC_`).
- [ ] Verify `.gitignore` contains all `.env`, `.env.local`, and sensitive build artifacts.
- [ ] Confirm no secrets are present in `.js`, `.jsx`, `.ts`, or `.tsx` files.

### 4. Zero-Trust Access Check
Ensure all sensitive mutations follow the backend-only policy.
- [ ] Audit frontend components for `supabase.from('...').insert(...)`.
- [ ] Ensure any sensitive action requires a signature and a call to a Backend API route.

### 5. Deployment Update
- [ ] Update Vercel/Production environment variables if local addresses changed.

---
// turbo-all
// Workflow Complete
