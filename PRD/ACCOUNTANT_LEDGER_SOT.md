# 📊 ACCOUNTANT LEDGER: SOURCE OF TRUTH (v3.59.2)
**Status**: 🛡️ ARCHITECTURALLY HARDENED
**Description**: Sistem pencatatan keuangan ganda (double-entry audit trail) dan pusat kendali paritas on-chain untuk ekosistem Crypto Disco. Menjamin transparansi mutlak antara transaksi On-Chain dan data Off-Chain (Database).

---

## 1. Arsitektur Akuntan Ledger
Sistem Ledger bekerja dengan menggabungkan data dari dua sumber utama:
1.  **On-Chain (Blockchain)**: Saldo real-time dari kontrak pintar (Smart Contracts).
2.  **Off-Chain (Database)**: Log aktivitas pengguna (`user_activity_logs`) yang mencatat kategori transaksi.

### 📍 Komponen Utama
- **Dashboard UI**: `AccountantLedgerTab.jsx` (Admin Portal).
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

---

## 5. Ecosystem Hardening Center (v3.59.2)
Modul tambahan untuk menjamin paritas antara database dan blockchain, mencegah terjadinya "Data Drift" pada XP dan Tier pengguna.

### 📍 Fitur Utama:
1.  **Parity Audit**: Membandingkan `total_xp` dan `tier` di Supabase dengan `userStats` di blockchain secara real-time.
2.  **Batch Synchronization**:
    *   **Sync XP**: Memperbarui status poin di kontrak MasterX berdasarkan data database.
    *   **Sync Tiers**: Memaksa pembaruan tier di blockchain jika terdeteksi inkonsistensi.
    *   **Sync NFT URIs**: Sinkronisasi metadata IPFS (Pinata) dari database ke kontrak on-chain.

---

## 6. Panduan Integrasi Modul Baru
Jika ada fitur baru (misal: Single NFT Market atau Swap) yang ingin terkoneksi ke Accountant Ledger, pengembang **WAJIB** mengikuti langkah berikut:

1.  **Emit Log di Database**: Gunakan kategori `PURCHASE` untuk setiap revenue.
2.  **Metadata Lengkap**: Sertakan `tx_hash`, `value_amount`, dan `value_symbol` ('USDC' atau 'ETH').
3.  **Automatic Inclusion**: Ledger akan secara otomatis menarik data log tersebut ke dalam dashboard tanpa perubahan kode di sisi Ledger.

---
*End of Accountant Ledger SOT - Nexus v3.59.2 Locked.*
