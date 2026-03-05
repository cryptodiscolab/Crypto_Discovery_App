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

### 2. Verified Infrastructure Reference (DO NOT GUESS)
| Key | Value |
|---|---|
| Raffle (Main) | `0x2c28bced53Cdfe9d9ECe7DFa79fE1066e453DE08` |
| MasterX V2 (Latest) | `0x78a566a11AcDA14b2A4F776227f61097C7381C84` |
| Ticket Price USD | `$0.15` (150,000 points, 6 decimals) |

### 3. Bahasa & Komunikasi
- **Teknis/Chat**: **Bahasa Indonesia**.
- **Frontend/UI**: **Bahasa Inggris (English)** (e.g., "Buy Ticket", "Draw Winner").

## 🎰 Kompetensi Inti

### 1. Contract Interaction Standard
- **Address Canonical**: Selalu gunakan `CONTRACTS.RAFFLE` dari `src/lib/contracts.js` — JANGAN hardcode.
- **ABI Source**: Gunakan `ABIS.RAFFLE` dari `src/lib/contracts.js` (Proxy-based).

### 2. Core Hook: useRaffle.js
Semua interaksi raffle harus melalui hook `useRaffle`:
- **`buyTickets(raffleId, amount)`**: Beli tiket → tunggu tx receipt → reward XP via backend.
- **`claimPrize(raffleId)`**: Klaim hadiah jika user adalah pemenang (`claimRafflePrize`).
- **`drawRaffle(raffleId)`**: Admin draw pemenang (`drawWinner` — admin only).

### 4. Tier-Based Entry Gating (NEW)
- **Gated Raffle Access**: Sebelum mengizinkan `buyTickets`, periksa Tier user di `user_profiles`. Jika raffle memiliki metadata `min_tier_id`, berikan feedback UI "Upgrade Tier required".
- **Dynamic Multiplier**: Sesuaikan tampilan estimasi reward/points di UI berdasarkan multiplier tier user (Bronze=1x, Diamond=2x, dll).

## ⛽ Paymaster Integration (Gasless)
- Gunakan `usePaymaster.js` untuk mendeteksi kapabilitas gasless (Coinbase Smart Wallet).
- Tampilkan `<GaslessBadge />` dan ubah label tombol menjadi "⛽ Buy Free" jika tersedia.

## 📋 Checklist Raffle Feature
- [ ] Apakah fungsi `buyTickets` digunakan (bukan `purchaseRaffleTickets`)?
- [ ] Apakah `drawWinner` digunakan (bukan `requestRaffleWinner`)?
- [ ] Apakah XP awarding mengikuti pola Zero-Trust Backend?
- [ ] Apakah ABI diimpor via Proxy dari `contracts.js`?
- [ ] Apakah build lokal berhasil (`npm run build`)?
- [ ] Apakah chat teknis menggunakan Bahasa Indonesia?

## 🚨 Pantangan
- Menulis langsung ke database dari frontend.
- Menggunakan nama fungsi kontrak lama yang sudah dideprecated.
- **Mengimpor ABI sebagai konstanta langsung — gunakan Proxy.**
- Menggunakan Bahasa Indonesia di elemen UI/Label aplikasi.
