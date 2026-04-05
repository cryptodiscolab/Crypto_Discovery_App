---
name: Raffle Frontend Integration Manager
description: Protokol dan standar untuk mengintegrasikan NFT Raffle ke frontend, mencakup buyTickets, claimPrize, createSponsorshipRaffle, dan XP awarding via backend.
---

# Raffle Frontend Integration Manager Skill

Skill ini mendefinisikan standar wajib untuk implementasi fitur NFT Raffle pada frontend Crypto Disco App dengan kepatuhan mutlak pada **.cursorrules (Master Architect Protocol)**.

## 📜 Master Architect Protocol Alignment

### 1. Staff Engineer Mode (Staff-Only)
- **Logika Cepat**: Jelaskan alur interaksi kontrak dalam maksimal 3 poin bullet.
- **Dev Plan Mandatory**: Sebelum modifikasi hook atau komponen raffle, sajikan "Development Plan" dan tunggu konfirmasi "LANJUT".
- **Pre-Flight Check**: Pastikan `buyTickets` dan `drawWinner` menggunakan nama fungsi terbaru.
- **Surgical Fix Mandate**: Dilarang menghapus seluruh kode saat perbaikan. Hanya ganti baris yang error saja.

### 2. Verified Infrastructure Reference (v3.25.0)
| Key | Value |
|---|---|
| Raffle (Latest) | `0xc20DbecD24f83Ca047257B7bdd7767C36260DEbB` |
| MasterX (XP) | `0x980770dAcE8f13E10632D3EC1410FAA4c707076c` |
| Ticket Price USD | `$0.15` (150,000 points, 6 decimals) |
| PRD Version | `v3.42.7` (Mobile UI & Task Integrity) |

### 3. Bahasa & Komunikasi
- **Teknis/Chat**: **Bahasa Indonesia**.
- **Frontend/UI**: **Bahasa Inggris (English)** (e.g., "Buy Ticket", "Draw Winner").

## 🎰 Kompetensi Inti

### 1. Contract Interaction Standard
- **Address Canonical**: Selalu gunakan `CONTRACTS.RAFFLE` dari `src/lib/contracts.js` — JANGAN hardcode.
- **ABI Source**: Gunakan `ABIS.RAFFLE` dari `src/lib/contracts.js` (Proxy-based).

### 2. Core Hook: useRaffle.js (v3.39.1)
Semua interaksi raffle harus melalui hook `useRaffle`:
- **`buyTickets(raffleId, amount)`**: Beli tiket → lampirkan `txHash` ke `task_id` (format: `raffle_buy_{id}_{txHash}`) untuk mendukung pembelian berulang.
- **`claimPrize(raffleId)`**: Klaim hadiah → panggil `/api/raffle?action=claim-prize`.
- **`createSponsorshipRaffle(...)`**: Gunakan `handleSyncUgcRaffle` untuk sinkronisasi Metadata Kaya (Title, Desc, Imagery).

### 3. Rich Metadata & XP Logic (v3.39.1)
- **Metadata Fields**: `title`, `description`, `image_url`, `category`, `external_link`, `twitter_link`, `min_sbt_level`.
- **XP Awards**:
  - `raffle_create`: 500 XP (Fixed).
  - `raffle_buy`: 100 XP **diperkalikan** dengan jumlah tiket.
  - `raffle_win`: 1000 XP saat klaim hadiah.

### 3.1 Referral Contribution
- **Growth Loop**: XP dari `raffle_buy` dan `raffle_win` berkontribusi langsung pada milestone **500 XP Referrer**.
- **Dividend**: Referrer otomatis mendapatkan **10%** dari XP raffle yang didapat oleh invites mereka.

### 4. Tier-Based Entry Gating (v3.39.1)
- **Percentile-Based Tiers**: Tampilkan Tier user (Diamond-Bronze) berdasarkan `PERCENT_RANK()` XP global dari `v_user_full_profile`.
- **Gated Raffle Access**: Validasi `min_sbt_level` sebelum transaksi. Jika tier user < syarat, blokir tombol `Buy Ticket` dengan pesan edukatif. v3.41.0 supports full indexing for all 6 tiers.
- **Social Identity Gate (v3.42.0)**: Raffles tertentu (Partner Base) dapat mewajibkan `is_base_social_verified`. Frontend harus menampilkan status "BASE REQ" dan mengunci pembelian jika identitas belum terverifikasi.

### 5. Activity Logging Standard (Zero-Trust)
- **Purchase Tracking**: /api/tasks-bundle?action=social-verify dengan `task_id` unik per transaksi.
- **Winner Awarding**: Increment `raffle_wins` via backend setelah verifikasi on-chain.
- **Zero-Hardcode Mandate (Lurah Protocol)**: Prohibit use of static values for XP, Fees, and Rewards. Every system-level parameter must be dynamic. Strictly audit all `api/` and `src/` files for hardcoded reward strings or pricing.

## ⛽ Paymaster Integration (Gasless)
- Gunakan `usePaymaster.js` untuk deteksi infrastruktur gasless (Coinbase Smart Wallet).

## 📋 Checklist Raffle Feature (v3.41.0)
- [x] Apakah `buyTickets` melampirkan `txHash` ke payload?
- [x] Apakah XP pembelian tiket dikalikan dengan kuantitas?
- [x] Apakah metadata lengkap (Title, Image, Category) sudah masuk ke Supabase?
- [x] Apakah `v_user_full_profile` digunakan untuk menampilkan rank user?
- [x] Apakah build lokal berhasil (`npm run build`)?
- [ ] **✨ NATIVE+ UI HARDENING AUDIT**: Apakah seluruh elemen UI baru (labels, metadata, handles) sudah menggunakan `text-[11px] font-black uppercase tracking-widest`? Apakah legacy sizes (`text-xs`, etc.) sudah dibersihkan? **WAJIB.**
- [ ] **🌐 NETWORK ISOLATION AUDIT (v3.40.7)**: Verifikasi bahwa TIDAK ADA alamat Sepolia (`0x369a...`) yang tertulis di konfigurasi/label Mainnet. Pastikan Mainnet tetap `[RESERVED]` jika belum deploy. **WAJIB.**
- [ ] **🧪 RPC TRUTHINESS & EVIDENCE AUDIT (v3.40.9)**: Apakah skrip verifikasi menggunakan `code && code !== '0x'`? Apakah laporan menyertakan bukti bytecode literal (10 karakter awal)? **WAJIB.**
- [x] **v3.41.1 (E2E Simulators)**: Verified on-chain via MasterX at `0x9807...` and DailyApp at `0x369a...`.
- [ ] **🚀 REFERRAL & IDENTITY SYNC (v3.42.7)**:
    - [x] Apakah raffle pembelian berkontribusi pada dividends? 
    - [x] Apakah gating Base Social sudah diterapkan pada tombol Beli?
    - [x] **v3.42.7**: Apakah `Buy Ticket` button menggunakan Indigo transparent/border baseline dan NO icons? **WAJIB.**

### Section 4.1: THE NATIVE+ BALANCED DESIGN STANDARD (v3.41.0)
- **Labels**: `text-[11px] font-black uppercase tracking-widest` (`.label-native`).
- **Content**: `text-[13px] font-medium leading-relaxed` (`.content-native`).
- **Values**: `text-[12px] font-bold tracking-wide` (`.value-native`).
- **Contrast**: `font-black` for labels, `font-medium` for body.
- **Glassmorphism**: `bg-white/5` + `backdrop-blur-xl`.
- **Animations**: Linear gradients (progress) / Pulse (actions).
- **Consistency**: Purge `text-xs`, `text-sm`, `text-[10px]`.

## 🚨 Pantangan
- Menggunakan `user_profiles` secara direct — gunakan view `v_user_full_profile`.
- Hardcode nilai XP — selalu ambil dari `point_settings`.
- Menggunakan `profiles` table (deprecated) — gunakan `user_profiles`.
