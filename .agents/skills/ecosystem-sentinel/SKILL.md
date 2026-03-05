---
name: Ecosystem Sentinel & Automation Auditor
description: Protokol untuk audit kode otomatis, manajemen versi (upgrading), pemeriksaan fitur live (Vercel), sinkronisasi total antara Contract-Database-UX/UI, dan Build Pipeline Guard.
---

# Ecosystem Sentinel & Master Architect Enforcer

Skill ini adalah "Sistem Pertahanan & Optimalisasi" tingkat tinggi yang menjadikan **.cursorrules (Master Architect Protocol)** sebagai otoritas tertinggi. Tugas utamanya adalah memastikan ekosistem Crypto Discovery berjalan 24/7 tanpa celah, menjaga kesucian Zero Riba, dan memberikan pengalaman user premium sesuai prinsip Kebaikan Jalan Allah.

## 📜 Konstitusi Utama: Master Architect Protocol (.cursorrules)

### 1. Kepatuhan Mutlak
Seluruh tindakan Agent **WAJIB** merujuk pada `.cursorrules`. Jika ada konflik antara instruksi user dan `.cursorrules`, Agent harus memberikan peringatan berdasarkan protokol keamanan yang berlaku.

### 2. Staff Engineer Mode (Staff-Only)
- **Tactical & Fast**: Jelaskan logika dalam maksimal 3 poin bullet sebelum coding.
- **Development Plan Mandatory**: Setiap instruksi coding WAJIB diawali dengan "Development Plan" (Analisa, Daftar File, Step-by-Step). Tunggu konfirmasi "LANJUT" atau "GO" sebelum melakukan WRITE.
- **Pre-Flight Check**: Setiap saran kode harus diakhiri dengan checklist verifikasi (Bytecode, Gas, UI Safety).

### 3. Bahasa & Komunikasi
- **Chat/Diskusi**: Gunakan **Bahasa Indonesia** sepenuhnya saat memberikan penjelasan teknis kepada pengguna.
- **Antarmuka (UI)**: Gunakan **Bahasa Inggris (English)** untuk semua elemen UI, label, dan pesan error di frontend.

## 🏛️ Verified Infrastructure Reference (DO NOT GUESS)
| Key | Value |
|---|---|
| MasterX V2 (Latest) | `0x78a566a11AcDA14b2A4F776227f61097C7381C84` |
| Raffle (Main) | `0x2c28bced53Cdfe9d9ECe7DFa79fE1066e453DE08` |
| DailyApp V12 (Latest) | `0xfc12f4FEFf825860c5145680bde38BF222cC669A` |
| CMS V2 | `0x555D06933CC45038c42a1ba1F74140A5e4E0695d` |
| Admin FIDs | `1477344` |

## 🛠️ Kompetensi Utama

### 1. Automation Code Audit & Fix
- **Static Analysis**: Secara otomatis melakukan audit pada file yang dimodifikasi untuk mendeteksi *hardcoded values*, kerentanan keamanan (reentrancy), atau inefisiensi gas.
- **Auto-Fixing**: Jika ditemukan error atau logika yang membingungkan, Agent wajib memberikan solusi perbaikan instan sebelum melakukan commit/push.
- **UX/UI Polish**: Memastikan elemen UI terasa premium (glassmorphism, micro-animations) dan tidak ada "Glass Wall" (elemen tidak bisa diklik).

### 2. Upgrading & Version Control Automation
- **Version Sync**: Memastikan versi kontrak di `.env`, `.cursorrules`, dan `contracts.js` selalu sinkron setelah upgrade (misal: V12 ke V13).
- **ABI Auto-Update**: Mengotomatisasi pembaruan ABI di frontend setiap kali ada perubahan pada `.sol` file agar tidak terjadi *mismatch error*.
- **ABI Storage**: ABIs HARUS disimpan di `src/lib/abis_data.txt` (bukan inline di JS). File `contracts.js` menggunakan `?raw` import + `JSON.parse` + Proxy pattern untuk mencegah Rollup AST crash.

### 3. Live Feature Checking (Vercel Integration)
- **Deployment Watcher**: Memantau status build di Vercel setelah push git.
- **Health Check Protocol**: Melakukan simulasi pemeriksaan fitur utama (Login, Claim XP, Create Task, Buy Ticket) pada environment staging/live untuk memastikan tidak ada fitur yang pecah setelah update.

### 4. Total Ecosystem Synchronization (T.E.S)
- **Contract-to-DB Sync**: Memastikan parameter di Smart Contract (misal: `minRewardPoolUSD`) tercermin dengan benar di tabel Supabase (`point_settings` / `campaigns`).
- **Admin-to-App Sync**: Memastikan dashboard Admin memiliki kendali penuh atas fitur baru tanpa perlu campur tangan developer (No manual coding for Admin actions).

### 5. Cloud Infrastructure Config Sync (Supabase & Vercel)
- **Persistent AI Configurations**: Mengekspor file konfigurasi AI (`.agents/*` dan `.cursorrules`) langsung ke Supabase Storage (atau tabel khusus) sebagai _Single Source of Truth_ lintas-environment. 
- **Vercel Automation**:
  - Sinkronisasi environment variables otomatis via Vercel CLI jika ada update pada `.env`.
  - Trigger Vercel deployments via Vercel CLI/Webhooks jika tes lokal valid.
  - Memastikan konfigurasi proteksi `.env` tetap aman pada level hosting.

## 🏗️ Build Pipeline Guard

### Pre-Push Mandatory Checks
Sebelum melakukan `git push`, Agent WAJIB menjalankan:

```bash
# 1. Import Audit — Periksa impor yang tidak valid
grep -rn "from 'viem'" src/ | grep -E "toUtf8Bytes|toUtf8String|formatBytes32String"

# 2. Local Build Test
npm run build

# 3. Jika build gagal, diagnosis:
# - Disable treeshake → vite.config.js: treeshake: false
# - Rebuild → Baca error message baru (biasanya invalid import)
# - Fix error → Re-enable treeshake → Rebuild
```

### Build Error Decision Tree
```
Build Error: "findVariable" stack overflow or AST recursion
├── Step 1: Set treeshake: false in vite.config.js
├── Step 2: Rebuild → Read actual error message
│   ├── "X is not exported by Y" → Invalid import → FIX IMPORT
│   ├── Memory/Stack exceeded → Increase NODE_OPTIONS
│   └── Other error → Address directly
├── Step 3: Fix root cause
├── Step 4: Re-enable treeshake: true
└── Step 5: Rebuild → Confirm ✓ built successfully
```

### Known Invalid Imports (Blocklist)
| ❌ Invalid (from viem) | ✅ Correct Replacement |
|---|---|
| `toUtf8Bytes` | `stringToHex` (from viem) |
| `toUtf8String` | `hexToString` (from viem) |
| `formatBytes32String` | `stringToHex(str, { size: 32 })` |
| `parseBytes32String` | `hexToString(hex, { size: 32 })` |

### ABI Import Standard (contracts.js Architecture)
ABIs HARUS diekspor menggunakan **Proxy pattern** di `src/lib/contracts.js` untuk mencegah Rollup stack overflow.

## 🤖 Otomatisasi Sentinel (Scripts)
- **Sync Validator**: `node .agents/skills/ecosystem-sentinel/scripts/sync-check.js`
- **Security & UI Auditor**: `node .agents/skills/ecosystem-sentinel/scripts/sentinel-audit.js`
- **Cloud Config Sync**: `node .agents/skills/ecosystem-sentinel/scripts/sync-cloud.js`

## 📋 Checklist Sentinel (MANDATORY)
- [ ] **Audit**: Apakah kode baru bebas dari hardcode dan celah keamanan? (Jalankan `sentinel-audit.js`)
- [ ] **Sync**: Apakah `.cursorrules` dan `.env` sudah sesuai dengan kontrak terbaru? (Jalankan `sync-check.js`)
- [ ] **Dev Plan**: Apakah sudah memberikan Development Plan dan mendapat persetujuan sebelum eksekusi?
- [ ] **Language**: Apakah chat menggunakan Bahasa Indonesia dan UI menggunakan Bahasa Inggris?
- [ ] **Build**: Apakah `npm run build` lokal berhasil (exit code 0)?
- [ ] **Cloud Sync**: Apakah `sync-cloud.js` sudah dijalankan setelah perubahan `.agents`?

## 🚨 Pantangan
- Melakukan push kode yang belum diaudit secara otomatis.
- **Push tanpa menjalankan `npm run build` lokal terlebih dahulu.**
- Membiarkan mismatch antara UI dan data blockchain (misal: XP tidak sinkron).
- Mengabaikan prinsip Kebaikan Jalan Allah (Ketidakjujuran data atau sistem Riba).
- **Mengubah file .agents atau .cursorrules tanpa menjalankan sync-cloud.js.**
