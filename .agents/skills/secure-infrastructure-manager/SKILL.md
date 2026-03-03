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
- **Zero Exposure Mandate**: 
  - NEVER push or upload `PRIVATE_KEY` to any remote repository.
  - NEVER include `PRIVATE_KEY` in frontend bundles (e.g., as `VITE_PRIVATE_KEY` is FORBIDDEN).
  - NEVER share or expose in logs, chat, or 3rd party tools.
- **Git Safety**: Ensure all sensitive files (`.env`, `.env.local`) are in `.gitignore`. Double-check before every push.

### 3. Zero-Trust Frontend Architecture
- **No Direct Writes**: Never suggest or implement direct database writes (Supabase `insert`/`upsert`/`delete`) from the React/Frontend side.
- **Signature-Driven Backend**: All state mutations must be handled by a secure Backend API (Next.js/Verification Server) after verifying a SIWE or Viem-based cryptographic signature.

### 4. Code & Protocol Alignment
- **Mirror .env to .cursorrules**: The "Verified Infrastructure Reference" in `.cursorrules` must always match `.env`.
- **Language Protocol**: Technical explanations in **Bahasa Indonesia**, UI/Error messages in **English**.
- **RPC Fallback**: Always use a fallback transport (Alchemy + Public Base) to prevent 401/429 errors.

## 🛡️ Operational Checklist
Before finalizing any change involving инфраструктури, verify:
- [ ] Is the contract address the absolute latest?
- [ ] Are all `.env` variables excluded from Git?
- [ ] Does the frontend have ZERO access to `PRIVATE_KEY`?
- [ ] Is the update synced across `.env`, `.cursorrules`, and documentation?
- [ ] Does the mutation follow the Zero-Trust Backend pattern?
