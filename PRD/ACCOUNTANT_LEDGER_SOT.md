# 📊 ACCOUNTANT LEDGER: SOURCE OF TRUTH (v3.63.0)
**Status**: 🛡️ ARCHITECTURALLY HARDENED
**Description**: Sistem pencatatan keuangan ganda (double-entry audit trail) dan pusat kendali paritas on-chain untuk ekosistem Crypto Disco. Menjamin transparansi mutlak antara transaksi On-Chain dan data Off-Chain (Database).

---

## 1. Arsitektur Akuntan Ledger
Sistem Ledger bekerja dengan menggabungkan data dari dua sumber utama:
1.  **On-Chain (Blockchain)**: Saldo real-time dari kontrak pintar (Smart Contracts).
2.  **Off-Chain (Database)**: Log aktivitas pengguna (`user_activity_logs`) yang mencatat kategori transaksi.

### 📍 Komponen Utama
- **Dashboard UI**: `AdminPage.tsx` -> `TaskManager.tsx` (Modular sections in `src/features/admin/components/`).
- **Backend Logic**: `admin-bundle.js` (Endpoint `/api/admin/accountant-ledger`).
- **Hook**: `useSBT.js` (Fungsi `withdrawTreasury`).
- **Database Table**: `user_activity_logs`.

---

## 2. Kategorisasi Transaksi
Seluruh aktivitas finansial di dalam ekosistem wajib dipetakan ke dalam salah satu kategori berikut untuk memastikan laporan balancing yang akurat:

| Kategori | Tipe | Deskripsi | Contoh Aktivitas |
|---|---|---|---|
| **PURCHASE** | Income (🟢) | Dana masuk ke kas ekosistem. | UGC Listing Fee, SBT Upgrade/Mint, Raffle Tickets. |
| **REWARD** | Expense (🔴) | Pengeluaran untuk hadiah pengguna. | SBT Pool Reward, Raffle Prize Payouts. |
| **EXPENSE** | Expense (🔴) | Biaya operasional atau penarikan manual. | Server costs, manual treasury rebalancing. |

---

## 3. On-Chain Balancing Report
Sistem melakukan verifikasi saldo secara langsung pada alamat kontrak berikut untuk dibandingkan dengan catatan Ledger:

| Kontrak / Wallet | Kegunaan | Asset |
|---|---|---|
| **SAFE_MULTISIG** | Treasury Pusat (End-point Penarikan) | ETH, USDC |
| **MASTER_X_ADDRESS** | Smart Contract XP & SBT Pool | ETH, USDC |
| **DAILY_APP_ADDRESS** | Smart Contract Core (UGC & Mints) | ETH, USDC |
| **RAFFLE_ADDRESS** | Smart Contract Raffle (Ticket Revenue) | ETH, USDC |

> [!IMPORTANT]
> **Zero-Hardcode Compliance**: Seluruh alamat di atas wajib ditarik secara dinamis dari environment variables via `lib/contracts.js`.

---

## 4. Modul Treasury (ETH Withdrawal)
Admin memiliki otoritas untuk menarik akumulasi dana ETH dari kontrak operasional ke Treasury Pusat melalui fungsi `withdrawTreasury`.

- **Alur**: `UI (AccountantLedgerTab)` -> `useSBT (hook)` -> `Contract (DailyApp/Raffle)` -> `Transfer to SAFE_MULTISIG`.
- **Security**: Hanya wallet dengan role Admin/Owner yang dapat mengeksekusi penarikan ini.

## 5. Multi-Token Audit Protocol (V14.1)
Sistem Ledger kini mendukung audit multi-token otomatis (USDC/ETH) dengan standar sinkronisasi event-driven:

1.  **On-Chain Event SOT**:
    - `SponsorshipRequested`: Mencatat pemasukan fee platform (USDC).
    - `RewardsClaimed`: Mencatat pengeluaran hadiah pengguna (USDC/ETH/DISCO). *Diperkenalkan di V14.1*.
2.  **Decimal Normalization Engine**:
    - Seluruh jumlah dana dinormalisasi secara otomatis berdasarkan desimal token (USDC=6, ETH=18) sebelum dicatat ke `user_activity_logs`.
    - Payout dicatat dalam kategori `REWARD` dan ditampilkan sebagai pengeluaran (expense) di dashboard.

---

## 6. Ecosystem Hardening Center (v3.59.4)
Modul tambahan untuk menjamin paritas antara database dan blockchain, mencegah terjadinya "Data Drift" pada XP dan Tier pengguna.

### 📍 Fitur Utama:
1.  **Parity Audit**: Membandingkan `total_xp` dan `tier` di Supabase dengan `userStats` di blockchain secara real-time.
2.  **Batch Synchronization**:
    *   **Sync XP**: Memperbarui status poin di kontrak MasterX berdasarkan data database.
    *   **Sync Tiers**: Memaksa pembaruan tier di blockchain jika terdeteksi inkonsistensi.
    *   **Sync NFT URIs**: Sinkronisasi metadata IPFS (Pinata) dari database ke kontrak on-chain.
3.  **Manual Ledger Sync Protocol**:
    *   **On-Demand Trigger**: Memungkinkan admin memicu sinkronisasi event blockchain (`accountant-sync`) secara manual untuk mengatasi kegagalan cron otomatis.
    *   **Block Height Visibility**: Dashboard menampilkan `last_synced_block` dan menghitung selisih (*drift*) terhadap `current_block` jaringan.
    *   **Freshness Indicator**: Memberikan feedback visual (Success/Warning) berdasarkan usia sinkronisasi terakhir untuk menjamin kemutakhiran data audit.

---

---

## 7. Raffle Economy Architecture (v3.59.5)
Ekosistem Raffle menggunakan sistem biaya tiga lapis untuk menjamin keberlanjutan operasional dan profitabilitas platform:

| Komponen Biaya | Nominal (Default) | Pihak yang Membayar | Tujuan |
|---|---|---|---|
| **Project Rake** | 20% | Creator (dari Tiket) | Revenue murni platform dari penjualan tiket. |
| **Gas Surcharge** | 10% | Creator (saat Create) | Biaya operasional gas untuk API3 QRNG (Randomness). |
| **Claim Fee** | 5% | Pemenang (saat Claim) | Biaya pemrosesan klaim dan maintenance hadiah. |

### 📍 Mekanisme Aliran Dana:
1.  **Ticket Sales (80/20 Split)**:
    *   80% Masuk to `sponsorBalances` (Internal mapping) -> Dapat ditarik oleh Creator via Dashboard.
    *   20% Masuk to `owner()` (Admin) -> Dikirim otomatis saat `_finalizeRaffle`.
2.  **Creation Surcharge**:
    *   10% Dipotong dari deposit awal creator -> Dikirim otomatis ke `masterContract` (Operasional).
3.  **Prize Payout**:
    *   Dana hadiah disimpan aman di kontrak hingga diklaim.
    *   Saat klaim, 5% dipotong untuk Admin, 95% dikirim ke Pemenang.

---

## 8. Panduan Integrasi Modul Baru
Jika ada fitur baru (misal: Single NFT Market atau Swap) yang ingin terkoneksi ke Accountant Ledger, pengembang **WAJIB** mengikuti langkah berikut:

1.  **Emit Log di Database**: Gunakan kategori `PURCHASE` untuk setiap revenue.
2.  **Metadata Lengkap**: Sertakan `tx_hash`, `value_amount`, dan `value_symbol` ('USDC' atau 'ETH').
3.  **Automatic Inclusion**: Ledger akan secara otomatis menarik data log tersebut ke dalam dashboard tanpa perubahan kode di sisi Ledger.

---
---
*End of Accountant Ledger SOT - Nexus v3.63.0 Locked.*
