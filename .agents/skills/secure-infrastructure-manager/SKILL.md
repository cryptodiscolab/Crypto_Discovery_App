---
name: Secure Infrastructure & Contract Manager
description: Manages smart contract lifecycle, environmental synchronization, and absolute privacy for sensitive data. Includes ABI Proxy architecture and build safety protocols.
---

# Secure Infrastructure & Master Protocol Architect

Skill ini adalah landasan keamanan teknis yang mewajibkan Agent untuk tunduk sepenuhnya pada **.cursorrules (Master Architect Protocol)** sebagai panduan utama.

## 📜 Fondasi Utama: Master Architect Protocol (.cursorrules)

### 1. Kepatuhan Mutlak
Setiap keputusan infrastruktur (pemilihan RPC, update alamat kontrak, atau manajemen database) harus disinkronkan langsung dengan `.cursorrules`.

### 2. Staff Engineer Mode (Staff-Only)
- **Tactical & Fast**: Jelaskan logika infrastruktur dalam maksimal 3 poin bullet.
- **Development Plan Mandatory**: Setiap perubahan kritis (DB schema, RPC, Contract Sync) WAJIB diawali dengan "Development Plan".
- **Pre-Flight Check**: Verifikasi Bytecode Limit (24KB) dan Gas Impact.

### 3. Bahasa & Komunikasi
- **Technical Discussions**: Gunakan **Bahasa Indonesia**.
- **System Labels/UI**: Gunakan **Bahasa Inggris (English)**.

## 🏛️ Verified Infrastructure Reference (DO NOT GUESS)
| Component | Base Mainnet | Base Sepolia (Testnet) |
|---|---|---|
| **DailyApp (Tasks)** | `0xEF8ab11E070359B9C0aA367656893B029c1d04d4` | `0xDe613DE5e6C0fB61012af83343f2b3c5F5461219` |
| **MasterX (Points)** | (Pending) | `0x78a566a11AcDA14b2A4F776227f61097C7381C84` |
| **Raffle (NFT)** | (Pending) | `0x2c28bced53Cdfe9d9ECe7DFa79fE1066e453DE08` |
| **CMS (Content)** | (Pending) | `0x555D06933CC45038c42a1ba1F74140A5e4E0695d` |
| **AirnodeRrpV0** | `0x32A334335EBe9d83dfB33B3EF803328e7529246E` | `0x2ab9f26E18b6103274414940251539D0105e2Add` |

## 🏛️ Core Competencies

### 1. Latest Contract Sync Mandate
- **Always Active**: Selalu periksa alamat kontrak terbaru di `.env` dan `.cursorrules`.
- **Auto-Sync**: Jika ditemukan kontrak baru, segera update `.env`, `.cursorrules`, dan `CONTRACTS_DOCUMENTATION.md`.

### 2. PRIVATE_KEY & Sensitive Data Security
- **Strict Privacy**: `PRIVATE_KEY` di `.env` adalah rahasia tertinggi.
- **Zero Exposure**: JANGAN PERNAH upload ke Git atau masukkan ke bundle frontend (`VITE_`).
- **Git Safety**: Pastikan `.env` dan `.env.local` ada di `.gitignore`.

### 3. Zero-Trust Frontend Architecture
- **No Direct Writes**: DILARANG menulis langsung ke Supabase (`insert`/`upsert`) dari frontend.
- **Signature-Driven Backend**: Semua mutasi data harus melalui API Backend setelah verifikasi signature (`viem`).

### 4. Database Schema Integrity (NEW)
- **SQL Migration Mandate**: Setiap fitur baru yang bergantung pada tabel database (misal: `user_privileges`) WAJIB menyertakan file SQL Migration (`CREATE TABLE IF NOT EXISTS`).
- **Graceful Error Handling**: Frontend harus mendeteksi jika tabel belum ada (fail gracefully) dan memberikan instruksi admin yang jelas (SQL script) daripada sekadar crash.
- **ABI & Implementation Parity (NEW)**: Setiap kali melakukan perubahan logika di Smart Contract, ABI di `abis_data.txt` HARUS diupdate secara atomik agar tidak terjadi "Method Not Found" pada frontend.

### 5. ABI Architecture Standard (Proxy Pattern)
ABIs WAJIB diekspor menggunakan **Proxy pattern** di `src/lib/contracts.js` untuk mencegah Rollup AST stack overflow.

### 6. Seasonal & Tier Upgrade Management (NEW)
- **Lazy Reset Protocol**: Memastikan integrasi frontend mendukung reset tier berbasis `currentSeasonId` secara transparan (Lazy Reset di Contract).
- **XP-Burn Coordination**: Sinkronisasi mutasi XP di database (`user_task_claims`) secara negatif saat terjadi `TierUpgraded` event untuk mencerminkan burn XP.
- **Mandatory Security Audit**:
    - Cek apakah fungsi baru diproteksi oleh `onlyRole(ADMIN_ROLE)`.
    - Cek apakah ada input user yang tidak divalidasi (`require` statements).
    - Cek apakah `.env` tetap bersih dari data hardcoded.
- **Supabase Security Mandate**:
    - Dilarang membuat tabel tanpa kebijakan RLS yang ketat.
    - Gunakan PostgreSQL Function/Trigger untuk data yang butuh integritas tinggi (misal: saldo XP).
- **Professional Sync Protocol**: Memastikan audit data flow dari Contract -> Backend -> Supabase Table berjalan tanpa "data ghosting" (data hilang di tengah jalan).

- **On-Chain Tier Gating**: Verifikasi kepemilikan SBT (Soulbound Token) via `masterX.users(address).tier` sebelum mengizinkan fitur eksklusif di frontend.

### 7. Multi-Network Isolation (/test-env)
- **Sepolia Sandbox**: Semua fitur baru WAJIB melewati `/test-env` yang menggunakan `CHAIN_ID: 84532` (Base Sepolia).
- **Zero-Risk Development**: JANGAN menjalankan script mainnet di luar direktori produksi. Gunakan `/test-env` sebagai area sandbox untuk perbaikan bug dan eksperimen fitur baru.
- **Sync Rule**: Setiap kali melakukan push ke Mainnet, pastikan `/test-env` sudah memberikan hasil sukses (Verified).

### 7. Activity Logging Privacy & Integrity (NEW)
- **Log Privacy**: Gunakan tabel `user_activity_logs` dengan RLS yang memastikan user hanya bisa membaca riwayat miliknya sendiri.
- **Atomic Integrity**: Pastikan mutasi database (XP/Claims) dan entri log riwayat terjadi secara atomik atau terverifikasi silang untuk mencegah data "ghosting".
- **Zero-Trust Activity Logging**: All database mutates must be signature-verified.
- **Dynamic System Governance (Zero-Hardcode)**: System parameters (XP, fees, reward multipliers) MUST be database-driven. Prohibit static infrastructure gating based on hardcoded rewards.
- **Vercel Hobby Plan Guard**: Strictly < 12 Serverless Functions. Consolidate into `*-bundle.js`.

### 8. Database Schema Awareness Protocol (NEW)
- **Schema-First Research**: Sebelum melakukan modifikasi logika yang berinteraksi dengan database, Agent WAJIB melakukan `list_dir` pada direktori `scripts/` untuk mencari file utility pembantu (seperti `check-columns.cjs`) atau melakukan query langsung pada `information_schema.columns` untuk memverifikasi struktur tabel terkini.
- **Sync Verification Mandate (CRITICAL)**: Agent WAJIB mengeksekusi `node scripts/verify-db-sync.cjs` setiap kali memulai atau menyelesaikan task database/backend untuk memastikan struktur tabel dalam kondisi Tersinkronisasi Sempurna 100%. Dilarang melanjutkan jika script ini menghasilkan error.
- **Legacy Column Cleanup**: Jika ditemukan kolom redundan (misal: `xp`, `points` vs `total_xp`), Agent harus segera melaporkan dan merencanakan unifikasi melalui SQL migration. JANGAN PERNAH berasumsi struktur tabel di file `.sql` statis sesuai dengan kondisi live di server.
- **Trigger Alignment**: Pastikan setiap mutasi data yang memiliki trigger database (seperti `sync_user_xp`) divalidasi aliran datanya agar tidak terjadi overwrite yang tidak disengaja.

- [ ] Apakah kontrak yang digunakan adalah versi terbaru (V12 / MasterX V2)?
- [ ] Apakah `PRIVATE_KEY` sudah aman dari paparan publik/frontend?
- [ ] Apakah mutasi data mengikuti pola Zero-Trust Backend?
- [ ] Apakah ABI diekspor menggunakan Proxy pattern?
- [ ] Verify `Point-Sync` integrity between code and `point_settings`.
- [ ] Verify `Zero-Hardcode` compliance for all system constants.
- [ ] Audit RLS for `user_activity_logs`.
- [ ] Verify signature checks on all `*-bundle.js` write actions.
- [ ] Apakah `npm run build` berhasil tanpa error?
- [ ] Apakah file `.agents` sudah di-sync ke cloud (`sync-cloud.js`)?
- [ ] **Database Inspection**: Sudahkah Anda memverifikasi kolom tabel secara langsung di DB sebelum modifikasi logika?

## 🚨 Pantangan
- Menggunakan kontrak lama (Deprecated versions).
- Memasukkan `PRIVATE_KEY` atau `SERVICE_ROLE_KEY` ke variabel `VITE_`.
- Update database langsung dari client-side React.
- **Menggunakan inline ABI atau direct JSON export untuk ABI.**
