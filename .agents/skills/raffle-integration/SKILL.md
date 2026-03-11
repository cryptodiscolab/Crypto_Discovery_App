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

### 2. Verified Infrastructure Reference (v3.2)
| Key | Value |
|---|---|
| Raffle (Latest) | `0x92E8e19f77947E25664Ce42Ec9C4AD0b161Ed8D0` |
| MasterX (XP) | `0x474126AD2E111d4286d75C598bCf1B1e1461E71A` |
| Ticket Price USD | `$0.15` (150,000 points, 6 decimals) |

### 3. Bahasa & Komunikasi
- **Teknis/Chat**: **Bahasa Indonesia**.
- **Frontend/UI**: **Bahasa Inggris (English)** (e.g., "Buy Ticket", "Draw Winner").

## 🎰 Kompetensi Inti

### 1. Contract Interaction Standard
- **Address Canonical**: Selalu gunakan `CONTRACTS.RAFFLE` dari `src/lib/contracts.js` — JANGAN hardcode.
- **ABI Source**: Gunakan `ABIS.RAFFLE` dari `src/lib/contracts.js` (Proxy-based).

### 2. Core Hook: useRaffle.js (v3.2)
Semua interaksi raffle harus melalui hook `useRaffle`:
- **`buyTickets(raffleId, amount)`**: Beli tiket → lampirkan `txHash` ke `task_id` (format: `raffle_buy_{id}_{txHash}`) untuk mendukung pembelian berulang.
- **`claimPrize(raffleId)`**: Klaim hadiah → panggil `/api/raffle?action=claim-prize`.
- **`createSponsorshipRaffle(...)`**: Gunakan `handleSyncUgcRaffle` untuk sinkronisasi Metadata Kaya (Title, Desc, Imagery).

### 3. Rich Metadata & XP Logic (v3.2)
- **Metadata Fields**: `title`, `description`, `image_url`, `category`, `external_link`, `twitter_link`, `min_sbt_level`.
- **XP Awards**:
  - `raffle_create`: 500 XP (Fixed).
  - `raffle_buy`: 100 XP **diperkalikan** dengan jumlah tiket.
  - `raffle_win`: 1000 XP saat klaim hadiah.

### 4. Tier-Based Entry Gating (v3.2)
- **Percentile-Based Tiers**: Tampilkan Tier user (Diamond-Bronze) berdasarkan `PERCENT_RANK()` XP global dari `v_user_full_profile`.
- **Gated Raffle Access**: Validasi `min_sbt_level` sebelum transaksi. Jika tier user < syarat, blokir tombol `Buy Ticket` dengan pesan edukatif.

### 5. Activity Logging Standard (Zero-Trust)
- **Purchase Tracking**: /api/tasks-bundle?action=social-verify dengan `task_id` unik per transaksi.
- **Winner Awarding**: Increment `raffle_wins` via backend setelah verifikasi on-chain.
- **Zero-Hardcode Mandate (Lurah Protocol)**: Prohibit use of static values for XP, Fees, and Rewards. Every system-level parameter must be dynamic. Strictly audit all `api/` and `src/` files for hardcoded reward strings or pricing.

## ⛽ Paymaster Integration (Gasless)
- Gunakan `usePaymaster.js` untuk deteksi infrastruktur gasless (Coinbase Smart Wallet).

## 📋 Checklist Raffle Feature (v3.2)
- [x] Apakah `buyTickets` melampirkan `txHash` ke payload?
- [x] Apakah XP pembelian tiket dikalikan dengan kuantitas?
- [x] Apakah metadata lengkap (Title, Image, Category) sudah masuk ke Supabase?
- [x] Apakah `v_user_full_profile` digunakan untuk menampilkan rank user?
- [x] Apakah build lokal berhasil (`npm run build`)?

## 🚨 Pantangan
- Menggunakan `user_profiles` secara direct — gunakan view `v_user_full_profile`.
- Hardcode nilai XP — selalu ambil dari `point_settings`.
- Menggunakan `profiles` table (deprecated) — gunakan `user_profiles`.
