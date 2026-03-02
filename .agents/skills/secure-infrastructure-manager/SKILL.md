---
name: Secure Infrastructure & Contract Manager
description: Manages smart contract lifecycle, environmental synchronization, and absolute privacy for sensitive data.
---

# Secure Infrastructure & Contract Manager Skill

This skill defines the mandatory protocol for managing the Crypto Disco App's core infrastructure, ensuring that the assistant acts with maximum security and data integrity.

## 🏛️ Core Competencies

### 1. Latest Contract Sync Mandate
- **Always Active**: You must always check for the latest deployed contract addresses.
- **Auto-Sync**: If a more recent valid contract address is found in `.env` or from recent deployment logs, immediately synchronize:
  - `E:\Disco Gacha\Disco_DailyApp\.env`
  - `E:\Disco Gacha\Disco_DailyApp\.cursorrules`
  - All relevant architecture documents (e.g., `CONTRACTS_DOCUMENTATION.md`).
- **Eliminate Confusion**: Never retain outdated contract addresses once a newer version is confirmed and working.

### 2. PRIVATE_KEY & Sensitive Data Security
- **Strict Privacy**: The `PRIVATE_KEY` in `.env` is the highest level of secret data. 
- **Zero Exposure**: 
  - Never push or upload `PRIVATE_KEY` to any public/remote repository (GitHub, Vercel logs, etc.).
  - Never include `PRIVATE_KEY` in frontend bundles. Frontend code must NEVER know a private key.
  - Never output private keys or full API secrets in plain text during chat or logging.
- **Git Safety**: Ensure all sensitive files (`.env`, `.env.local`, `.env.*`) are registered in `.gitignore` at both root and sub-project levels.

### 3. Zero-Trust Frontend Architecture
- **No Direct Writes**: Never suggest or implement direct database writes (Supabase `insert`/`upsert`/`delete`) from the React/Frontend side.
- **Signature-Driven Backend**: All state mutations must be handled by a secure Backend API (Next.js/Verification Server) after verifying a SIWE or Viem-based cryptographic signature.

### 4. Code & Protocol Alignment
- **Mirror .env to .cursorrules**: The "Verified Infrastructure Reference" in `.cursorrules` must always match the source of truth in `.env`.
- **Language Protocol**: Maintain technical explanations in Bahasa Indonesia while keeping UI elements and error messages in English.

## 🛡️ Operational Checklist
Before finalizing any change involving инфраструктури, verify:
- [ ] Is the contract address the absolute latest?
- [ ] Are all `.env` variables excluded from Git?
- [ ] Does the frontend have ZERO access to `PRIVATE_KEY`?
- [ ] Is the update synced across `.env`, `.cursorrules`, and documentation?
- [ ] Does the mutation follow the Zero-Trust Backend pattern?
