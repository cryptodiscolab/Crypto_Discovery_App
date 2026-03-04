---
name: XP & Reward Lifecycle Manager
description: Protokol untuk sinkronisasi XP, pengelolaan daily claim, dan integritas leaderboard antara on-chain dan off-chain (Supabase).
---

# XP & Reward Lifecycle Manager Skill

Skill ini menangani logika inti pemberian reward, sinkronisasi XP, dan manajemen siklus hidup klaim harian untuk memastikan integritas data antara transaksi blockchain dan database Supabase.

## 🏆 Kompetensi Inti

### 1. Zero-Trust XP Syncing
- **Mechanism**: XP TIDAK diperbolehkan diupdate langsung dari frontend.
- **Workflow**: 
    1. User berinteraksi dengan on-chain (Daily Claim, Raffle Buy).
    2. Frontend menangkap event transaksi sukses.
    3. Frontend melakukan `signMessage` (EIP-191) sebagai bukti kepemilikan.
    4. Backend API `/api/sync/xp` memverifikasi signature dan data on-chain.
    5. Backend melakukan penulisan ke Supabase menggunakan `SERVICE_ROLE_KEY`.

### 2. The Delta XP Calculation Pitfall (CRITICAL)
- Masalah fatal yang pernah terjadi: Klaim daily sukses on-chain, namun XP di DB tidak bertambah karena `xpDelta` bernilai negatif.
- **Root Cause**: Backend secara salah membandingkan XP On-Chain yang baru dengan _Total XP_ (yang merupakan gabungan poin on-chain + off-chain/sosial di profil).
- **SOP Resolusi (Apples-to-Apples Rule)**: Ketika menghitung `xpDelta`, poin on-chain HARUS dibandingkan HANYA dengan poin on-chain yang sudah tercatat di DB. 
- **Implementasi yang Benar**: 
  - Lakukan kueri `SUM(xp_earned)` dari tabel `user_task_claims` khusus untuk baris dengan `platform = 'blockchain'`.
  - Hitung `xpDelta = onChainXP - sumDBBlockchainXP`. Jika hasil `> 0`, barulah masukkan row baru ke `user_task_claims`.

### 3. Daily Claim Lifecycle
- **Contract Reference**: Selalu gunakan `CONTRACTS.DAILY_APP` dari `src/lib/contracts.js` — JANGAN hardcode address.
- **ABI Reference**: Gunakan `ABIS.DAILY_APP` atau `DAILY_APP_ABI` (Proxy-based).
- **Validation**: 
    - Pastikan user belum melakukan klaim harian di database (`user_task_claims`) sebelum menjalankan transaksi.
    - Sinkronkan status klaim secara periodik jika ada perbedaan antara visual UI dan DB.

### 3. XP Balancing & Logging
- **The Sync "Pitfall"**: Jika frontend menampilkan XP bertambah tapi DB tidak, error biasanya ada di API route atau permission RLS yang menghalangi trigger.
- **Audit Logs**: Setiap penambahan XP via backend WAJIB mencatat `tx_hash` (jika ada) dan `reason` di tabel audit.
- **Consistency Check**: Implementasikan modul `xp_balance_validator` di backend untuk mendeteksi anomali pada `total_xp`.

### 4. Leaderboard Integrity
- **Query Standard**: Gunakan view `v_user_full_profile` (atau sejenisnya) untuk merender leaderboard agar performa tetap cepat.
- **Lower-Case Consistency**: Leaderboard HARUS menggunakan `wallet_address.toLowerCase()` untuk pencocokan data profil.

### 5. Contract Import Standard
```javascript
// ✅ Preferred:
import { ABIS, CONTRACTS } from '../lib/contracts';
// Usage: abi: ABIS.DAILY_APP, address: CONTRACTS.DAILY_APP

// ✅ Legacy compatible:
import { DAILY_APP_ABI, CONTRACTS } from '../lib/contracts';
// DAILY_APP_ABI is a transparent Proxy — safe for Rollup
```

**DILARANG**: Mengimpor ABI langsung dari file JSON atau melakukan inline ABI di komponen.

## 📋 Checklist Reward & XP
- [ ] Apakah operasi tulis DB sudah dilakukan di Server-Side API?
- [ ] Apakah `wallet_address` sudah di-lowercase sebelum query/insert?
- [ ] Apakah pesan signature di frontend sudah standar (e.g., "Daily Claim Sync: 0x...")?
- [ ] Apakah sudah ada logging yang memadai di `/api` untuk debugging?
- [ ] Apakah XP visual (PointsContext) sudah mencerminkan status database terkini?
- [ ] Apakah ABI diimpor melalui Proxy dari `contracts.js` (BUKAN inline)?

## 🚨 Pantangan
- Menggunakan `supabase.from('profiles').update({ xp: newXp })` di file `.jsx`.
- Mengabaikan error `401 Unauthorized` atau `403 Forbidden` pada API sync XP.
- Tidak melakukan validasi address penanda tangan di backend.
- **Mengimpor fungsi ethers.js dari package viem (e.g., `toUtf8Bytes`).**
