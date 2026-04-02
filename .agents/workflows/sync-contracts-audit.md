---
description: Sync latest contracts across .env, .cursorrules, Vercel, and eradicate legacy addresses.
aliases: ["/sync", "/sync-ecosystem"]
---

# End-to-End Ecosystem Synchronization Workflow

This workflow executes an ironclad *"Ecosystem Exorcism & Sync"* to ensure 100% parity across Local Environments, Agent Protocols, JS Caching, and Vercel Cloud without "Silent Corruption".

## 📋 Steps to Execute

### 1. Pre-Flight Contract Integrity Cross-Check
- [ ] Read `.cursorrules` (Section 10) and `.env` (Local) to determine the absolute canonical SOT.
- [ ] Validate that **Mainnet** addresses are safely set to `[RESERVED]` unless physically launched.
- [ ] Run `node scripts/audits/check_sync_status.cjs` for a baseline health check.

### 2. Hardcore Clean-Up (Exorcism)
Use `grep_search` to find and surgically eliminate ANY hardcoded legacy addresses from frontend assets and debug scripts.
- [ ] Target Legacy App: `0xfA75627c1A5516e2Bc7d1c75FA31fF05Cc2f8721`
- [ ] Target Legacy MasterX: `0xa4E3091B717DfB8532219C93A0C170f8f2D7aec3`
- [ ] Purge and replace occurrences in `Raffle_Frontend/src/lib/abis_data.txt`, `scripts/deployments/`, and `scripts/debug/`.
- [ ] **Specialized Env Audit (v3.40.11)**: Manually audit/purge legacy addresses from:
  - `.env.example`, `.env.local`, `.env.vercel`, `.env.vercel.preview`, `.env.vercel.production`, `.env.verification.vercel`.
- [ ] Ensure AI protocol docs (`CLAUDE.md`, `gemini.md`, `PRD`) are fully updated with the canonical addresses.

### 3. Agent Mandate Refresh
Update the AI behavior files to prevent regression.
- [ ] Update `secure-infrastructure-manager/SKILL.md` table to strictly reflect `.cursorrules`. **Verify Column Headers before replacing!**
- [ ] Update `ecosystem-sentinel/SKILL.md` table.
- [ ] Stempel waktu: Tambahkan stempel `<Date>T<Time>+07:00` pada entri kontrak (Contoh: `Last Synced`).

### 4. Vercel Atomic Clean-Pipe Sync
Force Vercel production to follow the Local SOT without GUI copy-pasting (which introduces `\r\n` corruption).
- [ ] Execute `node scripts/sync/global-sync-env.js` (Run in background terminal up to 5-10 mins).
- [ ] Ensure both `crypto-discovery-app` and `dailyapp-verification-server` report "Synced to production".

### 5. Final Ecosystem Health & Absolute Privacy Audit
- [ ] Run `npm run gitleaks-check` to execute Zero-Exposure scan for leaking `PRIVATE_KEY` or `SERVICE_ROLE_KEY`.
- [ ] Re-run `node scripts/audits/check_sync_status.cjs` and verify 13/13 Security Matrix checks pass.
- [ ] Execute markdown compilation: `npx marked -i PRD/DISCO_DAILY_MASTER_PRD.md -o PRD/DISCO_DAILY_MASTER_PRD.html`.

---
// turbo-all
// Workflow Complete
