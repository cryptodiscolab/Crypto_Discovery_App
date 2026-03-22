# Admin Hub Runtime & Stability Manager

Skill ini menjamin stabilitas runtime dan integritas Admin Hub dengan berpegang teguh pada standar **.cursorrules (Master Architect Protocol)**.

## 📜 Otoritas Protokol: Master Architect Protocol (.cursorrules)

### 1. Staff Engineer Mode (Staff-Only)
- **Health Check Protocol**: Melakukan simulasi pemeriksaan fitur utama (Login, Claim XP, Create Task, Buy Ticket) pada environment staging/live untuk memastikan tidak ada fitur yang pecah setelah update.
- **Development Plan Mandatory**: Setiap perubahan pada layout admin, logic gate, atau middleware WAJIB diawali dengan "Development Plan".
- **Pre-Flight Check**: Jalankan `sentinel-audit.js` dan pastikan `npm run build` lokal aman.
- **Surgical Fix Mandate**: Dilarang menghapus seluruh kode saat perbaikan. Hanya ganti baris yang error saja.

### 4. Zero-Trust Security Standard (MANDATORY)
- **Signature-First API**: Semua API Backend (Vercel Functions/verification-server) yang melakukan modifikasi data (Internal DB atau On-Chain) WAJIB memvalidasi **EIP-191 Signature** dari wallet user/admin.
- **Replay Protection**: Gunakan timestamp dalam pesan signature dengan window validasi maksimal 5 menit.
- **Normalized Mapping**: Pastikan mapping address (Farcaster/Twitter) menggunakan clean lowercase address untuk menghindari 404 pada API Neynar.

### 2. Verified Infrastructure Reference (PRD v3.38.25)
| Key | Value |
|---|---|
| Admin FIDs | `1477344` (Farcaster) |
| Master Admin 1 | `0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B` |
| Master Admin 2 | `0x52260c30697674a7C837FEB2af21bBf3606795C8` |
| P&L Metrics | `Total Pool`, `Locked Rewards`, `Net Surplus` |
| SBT Weights | `Proportional Distribution (100% Total)` |

### 3. Bahasa & Komunikasi
- **Technical/Chat**: **Bahasa Indonesia**.
- **Admin UI/Labels**: **Bahasa Inggris (English)**.

## 🛡️ Protokol Stabilitas & Recovery

### 1. AdminPage Runtime Security
- **Z-Index Guard**: Selalu gunakan `relative z-[9999] pointer-events-auto` untuk BottomNav/Header admin.
- **Glass Wall Prevention**: Pastikan tidak ada overlay transparan yang menutupi tombol klik.

### 2. Lurah Hub & P&L Guard (v3.38.25)
- **RPC Resiliency Fallback (v3.38.25)**: Ensure Admin actions (e.g. banning, boosting) support manual `tx_hash` entry to force-sync state if blockchain indexers are lagging.
- **View Mirror Sync (v3.38.25)**: Prohibit admin dashboard deployment if `v_user_full_profile` SQL View is not synchronized with the latest `user_profiles` schema.
- **Tier Precision**: Enforce `min_xp` logic; deprecate `xp_required` from all calculations (v3.38.25).

- **Administrative Setters**: Pastikan UI Admin mendukung konfigurasi dinamis `DailyAppV13` (Withdrawal Fee BP, Daily Bonus, Auto-Approve Sponsorship, Sponsor Duration).
- **Token Whitelist Verification**: Selalu verifikasi bahwa token yang di-whitelist memiliki `decimals` dan `symbol` yang benar sebelum melakukan sinkronisasi database.
- **Admin Sync Mandate**: Setiap aksi on-chain (Token Whitelist, SBT Upgrade) WAJIB melakukan signed request ke Backend Bundle untuk sinkronisasi Database SEGERA setelah konfirmasi transaksi.
- **Dynamic Tiering**: Leaderboard rank dihitung secara dinamis via `v_user_full_profile` menggunakan persentil di `system_settings`.
- **Net Surplus Verification**: Sebelum menyarankan penarikan treasury, pastikan `address(this).balance > totalLockedRewards`.
- **Proportionality Check**: Setting `SBT Weights` WAJIB berjumlah tepat 100%. User-feedback (error toast) harus jelas jika jumlah tidak sesuai.
- **Raffle Metadata Audit**: Admin Hub harus memvalidasi kelengkapan metadata (Title, Image, Category) sebelum me-list raffle secara global.

### 2. Library & Dependency Integrity (CRITICAL)
- **KNOWN PITFALL — viem vs ethers.js**:
  - `toUtf8Bytes`, `toUtf8String`, `formatBytes32String` → **DILARANG** diimpor dari `viem`.
  - Gunakan `stringToHex`, `hexToString` dari `viem`.
- **Import Audit**: Sebelum push, jalankan:
  `grep -rn "from 'viem'" src/ | grep -E "toUtf8Bytes|toUtf8String|formatBytes32String"`

### 3. Build Stability Protocol (Rollup/Vite)
- **AST Recursion Fix**: Gunakan Proxy pattern di `contracts.js` untuk ekspor ABI besar.
- **NODE_OPTIONS**: Selalu gunakan memory allocation tinggi untuk build:
  `cross-env NODE_OPTIONS='--max-old-space-size=8192 --stack-size=8192' vite build`

## 📋 Checklist Stabilitas (v3.26.0)
- [ ] Apakah komponen Admin baru sudah memiliki error boundary?
- [ ] Apakah `z-index` sudah diuji untuk mencegah "Glass Wall"?
- [ ] Apakah TIDAK ADA impor ethers.js dari package `viem`?
- [ ] Apakah `npm run build` berhasil tanpa error?
- [ ] Apakah chat teknis menggunakan Bahasa Indonesia?
- [ ] Apakah metadata progress (`IMPLEMENTATION_SUMMARY.md`) sudah diupdate?
- [ ] **Atomic Script Enforced**: Apakah script operasional sudah berada di folder kategori yang benar di `scripts/`?

## 🚨 Pantangan
- Push ke Vercel tanpa `npm run build` lokal.
- Mengabaikan prinsip Zero Trust pada aksi administratif.
- **Menggunakan konstanta ABI literal di file komponen (Gunakan Proxy).**
- Mencabut aturan proteksi `.env` dari `.gitignore`.
