# Economy & Master Architect Protocol Manager

Skill ini dirancang untuk mengotomatisasi pengawasan ekonomi aplikasi Crypto Disco dengan menjadikan **.cursorrules (Master Architect Protocol)** sebagai hukum tertinggi.

## 📜 Konstitusi Ekonomi: Master Architect Protocol (.cursorrules)

### 1. Zero Riba Policy
**WAJIB**: DILARANG keras mengimplementasikan sistem bunga (riba), staking inflasioner, atau skema tokenomics yang menipu.

### 2. Staff Engineer Mode (Staff-Only)
- **PnL Logic**: Jelaskan struktur biaya dan margin dalam maksimal 3 poin bullet.
- **Development Plan Mandatory**: Setiap penyesuaian parameter (Listing Fee, Reward Pool) WAJIB diawali dengan "Development Plan".
- **Revenue Safety**: Memastikan biaya operasional tertutup sebelum distribusi profit.
- **Surgical Fix Mandate**: Dilarang menghapus seluruh kode saat perbaikan. Hanya ganti baris yang error saja.

### 3. Bahasa & Komunikasi
- **Teknis/Strategi**: **Bahasa Indonesia**.
- **Admin Hub/UI**: **Bahasa Inggris (English)**.

| Key | Value |
|---|---|
| Ticket Price USD | `$0.15` (150,000 points) |
| Platform Fee (Tasks) | `5%` |
| Platform Fee (Raffle) | `20%` (Fixed v3.19.0) |
| Whitelist Mode | `Multi-Chain Dynamic (v3.19.0)` |
| Revenue Split (UGC) | `80% Creator / 20% Platform` |
| Treasury Wallet | `0xAfB7C7E711418EFD744f74B4D92c2b91B9668fAa` |

## 💰 Kompetensi Inti

### 1. P&L Control (Profit & Loss v3.19.0)
- **Zero-Hardcode Mandate (CRITICAL)**: DILARANG KERAS menggunakan nilai statis untuk Reward (XP), Fees (BP), atau Multiplier di dalam kode. Seluruh parameter sistem WAJIB bersifat dinamis dan diambil dari tabel `point_settings` atau konfigurasi database terkait.
- **Revenue Tracking**: Gross Revenue dihitung secara dinamis dari `user_activity_logs` (PURCHASE/USDC) di `admin-bundle.js`.
- **Net Surplus Mandate**: Pastikan saldo Treasury menutupi seluruh `totalLockedRewards` sebelum menjalankan distribusi dividen.
- **Raffle Revenue Stream**: Monitor aliran dana 20% fee dari `Raffle` ke `MasterX` Revenue Pool.
- **6-Tier Distribution**: Support for None through Diamond tiers indexing (v3.19.0).

### 2. Ecosystem Balancing (Zero-Hardcode)
- **Lurah Hub Oversight**: Seluruh parameter ekonomi (Fee BP, Reward Multiplier) WAJIB dikendalikan via Admin Dashboard, bukan hardcode.
- **Dynamic Pricing**: Gunakan `usePriceOracle` di frontend untuk visualisasi estimasi nilai USD dari reward pool.

## 📋 Checklist Profitabilitas (v3.19.0)
- [ ] Apakah biaya listing sudah menutupi biaya review admin?
- [ ] Apakah estimasi profit margin sudah dihitung?
- [ ] Apakah usulan fitur bebas dari unsur Riba?
- [ ] Apakah chat strategi menggunakan Bahasa Indonesia?
- [ ] Apakah file `.agents` sudah di-sync ke cloud?
- [ ] **Atomic Script Enforced**: Apakah script operasional sudah berada di folder kategori yang benar di `scripts/`?

## 🚨 Pantangan
- Mengabaikan biaya gas dalam kalkulasi profit.
- Membiarkan Reward Pool habis tanpa notifikasi.
- **Menggunakan nilai USD absolut di kontrak tanpa bridge harga.**
- **Mengimpor fungsi ethers.js dari viem.**
