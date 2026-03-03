---
name: Secure Infrastructure & Contract Manager
description: Manages smart contract lifecycle, environmental synchronization, and absolute privacy for sensitive data.
---

# Secure Infrastructure & Master Protocol Architect

Skill ini adalah landasan keamanan teknis yang mewajibkan Agent untuk tunduk sepenuhnya pada **.cursorrules (Master Architect Protocol)**. Segala pengelolaan infrastruktur, smart contract, dan data sensitif harus dilakukan dengan standar keamanan tertinggi dan kepatuhan mutlak pada aturan ekosistem.

## 📜 Fondasi Utama: Master Architect Protocol (.cursorrules)
Setiap keputusan infrastruktur (misal: pemilihan RPC, update alamat kontrak, atau manajemen database) harus disinkronkan langsung dengan `.cursorrules`. Pelanggaran protokol ini dianggap sebagai risiko keamanan kritis.

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

### 5. PRIVACY & LATEST CONTRACT MANDATE
- **Contract Updates**: ALWAYS use the latest, most updated, and complete smart contracts. If a newer valid contract is found (e.g., from `.env` or recent deployments), immediately update `.env`, `.cursorrules`, and architecture documents to prevent confusion.
- **PRIVATE_KEY SAFETY**: THE `PRIVATE_KEY` in the `.env` file is CRITICAL SENSITIVE DATA. It MUST:
  - NEVER be uploaded or pushed to any repository.
  - NEVER be included in any frontend bundle (e.g., as `VITE_PRIVATE_KEY` - FORBIDDEN).
  - NEVER be shared or exposed in logs, chat, or 3rd party tools.
- **Privacy & Git-Safety**: ALL sensitive data (Private Keys, API Keys, `.env` files, production database URLs) MUST be added to `.gitignore`.
- **Confidentiality**: NEVER push, upload, or expose sensitive files or data to public repositories (GitHub), frontend bundles, or any 3rd party analysis tools.
- **Verification**: Double-check `.gitignore` entries before every push to ensure no leakage.

## 🛡️ Operational Checklist
Before finalizing any change involving infrastructure, verify:
- [ ] Is the contract address the absolute latest?
- [ ] Are all `.env` variables excluded from Git?
- [ ] Does the frontend have ZERO access to `PRIVATE_KEY`?
- [ ] Is the update synced across `.env`, `.cursorrules`, and documentation?
- [ ] Does the mutation follow the Zero-Trust Backend pattern?
- [ ] Is there any bilingual UI that needs fixing (English only for UI)?
