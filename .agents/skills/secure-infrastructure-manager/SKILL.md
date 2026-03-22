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
- **Surgical Fix Mandate**: Dilarang menghapus seluruh kode saat perbaikan. Hanya ganti baris yang error saja.

### 3. Bahasa & Komunikasi
- **Technical Discussions**: Gunakan **Bahasa Indonesia**.
- **System Labels/UI**: Gunakan **Bahasa Inggris (English)**.

| **DailyApp V13** | `0x87a3d1203Bf20E7dF5659A819ED79a67b236F571` | `0xfA75627c1A5516e2Bc7d1c75FA31fF05Cc2f8721` | `VITE_V12_CONTRACT_ADDRESS_SEPOLIA` |
| **MasterX (XP)** | `0x78a566a11AcDA14b2A4F776227f61097C7381C84` | `0xa4E3091B717DfB8532219C93A0C170f8f2D7aec3` | `VITE_MASTER_X_ADDRESS_SEPOLIA` |
| **Raffle** | `[RESERVED]` | `0xc20DbecD24f83Ca047257B7bdd7767C36260DEbB` | `VITE_RAFFLE_ADDRESS_SEPOLIA` |
| **CMS V2** | `[RESERVED]` | `0xd992f0c869E82EC3B6779038Aa4fCE5F16305edC` | `VITE_CMS_CONTRACT_ADDRESS_SEPOLIA` |
| **PRD v3.38.25** | `[ACTIVE]` | `PRD/DISCO_DAILY_MASTER_PRD.md` | `DOC_SOT` |

## 🏛️ Core Competencies

### 1. Latest Contract Sync Mandate
- **Always Active**: Selalu periksa alamat kontrak terbaru di `.env` dan `.cursorrules`.
- **Auto-Sync**: Jika ditemukan kontrak baru, segera update `.env`, `.cursorrules`, dan PRD.

### 2. PRIVATE_KEY & Sensitive Data Security
- **Strict Privacy**: `PRIVATE_KEY` di `.env` adalah rahasia tertinggi.
- **Zero Exposure**: JANGAN PERNAH upload ke Git atau masukkan ke bundle frontend (`VITE_`).
- [x] **Git Safety**: Pastikan `.env` dan `.env.local` ada di `.gitignore`.
- [x] **No-Screenshot Mandate**: DILARANG KERAS men-staged atau meng-upload file screenshot/media hasil audit ke Git.
- [x] **Zero-Leak Mandate**: DILARANG KERAS mempublikasikan variabel atau file yang mengandung `role_key`, `service_role_key`, `secret`, atau kredensial mentah lainnya. Gunakan `.env`.
- [x] **Defensive Address Cleaning**: DILARANG menggunakan alamat kontrak yang masih mengandung tanda kutip, spasi, atau karakter tersembunyi. WAJIB dibersihkan via `cleanAddr` atau `.trim()`.
- [x] **ENV-SANITY Mandate**: ALL environment variables fetched for serverless initialization (e.g., `SUPABASE_URL`, `SERVICE_KEY`) MUST be cleaned of "Silent Corruption" (literal double quotes and hidden newlines) using `.trim()`.
- [x] **SDK-First Principle**: Mandatory usage of official SDKs for Auth and Social flows to ensure State/PKCE integrity.
- [x] **Multi-Project Vercel Sync**: Wajib melakukan sinkronisasi environment variable atomik di seluruh project terkait (`dailyapp-verification-server`) menggunakan Vercel CLI via Clean-Pipe protocol.
- [x] **Pre-Push Scan**: Wajib menjalankan `npm run gitleaks-check` sebelum push untuk mendeteksi kebocoran `.env`, `PRIVATE_KEY`, atau `role_key`.

### 3. Zero-Trust Frontend Architecture
- **No Direct Writes**: DILARANG menulis langsung ke Supabase (`insert`/`upsert`) dari frontend.
- **Signature-Driven Backend**: Semua mutasi data harus melalui API Backend setelah verifikasi signature (`viem`).

### 4. Database Schema Integrity
- **SQL Migration Mandate**: Setiap fitur baru yang bergantung pada tabel database WAJIB menyertakan file SQL Migration.
- **Graceful Error Handling**: Frontend harus mendeteksi jika tabel belum ada dan memberikan instruksi admin yang jelas.
- **ABI & Implementation Parity**: Setiap kali melakukan perubahan logika di Smart Contract, ABI di `abis_data.txt` HARUS diupdate secara atomik.

### 5. ABI Architecture Standard (Proxy Pattern)
ABIs WAJIB diekspor menggunakan **Proxy pattern** di `src/lib/contracts.js` untuk mencegah Rollup AST stack overflow.

### 6. Seasonal & Administrative Management
- **Lurah Hub Control**: Pastikan infrastruktur mendukung setter dinamis di `DailyApp` (Fees, Bonus, Auto-Approve).
- **Trigger-Based Integrity**: Gunakan `trg_sync_xp_on_claim` di Supabase sebagai otoritas tunggal perhitungan `total_xp`.
- **XP-Burn Coordination**: Sinkronisasi mutasi XP di database secara negatif saat terjadi `TierUpgraded` event.
- **Supabase Security Mandate**:
    - Dilarang membuat tabel tanpa kebijakan RLS yang ketat.
    - Gunakan view `v_user_full_profile` (SECURITY INVOKER) untuk seluruh display data user.

### 7. Multi-Network Isolation (/test-env)
- **Sepolia Sandbox**: Semua fitur baru WAJIB melewati `/test-env` yang menggunakan `CHAIN_ID: 84532` (Base Sepolia).
- **Zero-Risk Development**: JANGAN menjalankan script mainnet di luar direktori produksi.
- **Sync Rule**: Setiap kali melakukan push ke Mainnet, pastikan `/test-env` sudah memberikan hasil sukses.

### 8. Database Schema Awareness Protocol
- **Schema-First Research**: Sebelum modifikasi logika database, Agent WAJIB melakukan `list_dir` pada `scripts/` untuk mencari utility atau query `information_schema`.
- **Sync Verification Mandate (CRITICAL)**: Agent WAJIB mengeksekusi `node scripts/audits/verify-db-sync.cjs` setiap kali memulai atau menyelesaikan task database/backend.
- **Legacy Column Cleanup**: Laporkan kolom redundan dan unifikasi melalui SQL migration.

## 📋 Checklist Security & Infra (v3.38.25)
- [ ] Apakah kontrak yang digunakan adalah versi terbaru (PRD v3.38.25)?
- [ ] Apakah `PRIVATE_KEY` sudah aman dari paparan publik/frontend?
- [ ] Apakah Gitleaks scan (`npm run gitleaks-check`) sudah dijalankan dan Pass?
- [ ] Apakah mutasi data mengikuti pola Zero-Trust Backend?
- [ ] Apakah ABI diekspor menggunakan Proxy pattern?
- [ ] Verify `Point-Sync` integrity between code and `point_settings`.
- [ ] Verify `Zero-Hardcode` compliance for all system constants.
- [ ] Audit RLS for `user_activity_logs`.
- [ ] Verify signature checks on all `*-bundle.js` write actions.
- [ ] Apakah `npm run build` berhasil tanpa error?
- [ ] **Social Reliability**: Have we implemented iterative pagination (500 items) for Farcaster/Twitter?
- [ ] **Profile UX**: Are social linking buttons interactive and state-aware?
- [ ] **Clean Asset Protocol**: Apakah seluruh file screenshot/media hasil audit sudah dihapus?
- [ ] **Atomic Script Enforced**: Apakah script operasional sudah berada di folder kategori yang benar di `scripts/`?
- [ ] **Local Server Resource Hygiene**: Apakah seluruh server lokal (Vite/Express) sudah dimatikan setelah verifikasi selesai?


## 🚨 Pantangan
- Menggunakan kontrak lama (Deprecated versions).
- Memasukkan `PRIVATE_KEY` atau `SERVICE_ROLE_KEY` ke variabel `VITE_`.
- Update database langsung dari client-side React.
- **Menggunakan inline ABI atau direct JSON export untuk ABI.**
- **Manual Security URL**: Menghasilkan URL OAuth atau Social Linking secara manual jika SDK resmi (Supabase) tersedia.
- **Corrupted Env Usage (Silent Corruption)**: Menggunakan variabel lingkungan tanpa `.trim()` atau pembersihan "sampah" karakter (literal double quotes/newlines).

---
*Protokol ini sinkron dengan .cursorrules dan PRD v3.38.25*
