---
name: Economy & Profitability Automation Manager
description: Protokol untuk menjaga keseimbangan ekosistem, mengelola Profit & Loss (P&L), dan memastikan operasional aplikasi tertutup dengan margin profit yang sehat bagi Owner.
---

# Economy & Master Architect Protocol Manager

Skill ini dirancang untuk mengotomatisasi pengawasan ekonomi aplikasi Crypto Disco dengan menjadikan **.cursorrules (Master Architect Protocol)** sebagai hukum tertinggi. Fokus utamanya adalah menjaga profitabilitas owner tanpa melanggar prinsip **Zero Riba** dan keadilan ekonomi.

## 📜 Konstitusi Ekonomi: Master Architect Protocol (.cursorrules)
Setiap penyesuaian parameter finansial (Listing Fee, Reward Pool, Token Price) harus melewati audit kepatuhan terhadap `.cursorrules`. Pelanggaran terhadap prinsip Zero Riba adalah kegagalan sistem yang fatal.

## 💰 Kompetensi Inti

### 1. P&L Control (Profit & Loss)
- **Revenue Stream Tracking**: Memantau setiap aliran pendapatan (Sponsorship Fees, Raffle Ticket Sales, Tier Minting).
- **Operational Cost Coverage**: Memastikan biaya operasional (Gas fees, API Neynar, Supabase hosting) tertutup oleh revenue sebelum mendistribusikan profit.
- **Dynamic Pricing Strategy**: Menyesuaikan biaya prosedur (seperti Listing Fee Sponsor) berdasarkan kondisi pasar untuk menjaga keunggulan kompetitif namun tetap menguntungkan.

### 2. Zero-Hardcode Mandate
- **Variable Infrastructure**: Dilarang menggunakan konstanta statis (`constant`) untuk nilai ekonomi (fee, reward, threshold). Semua harus tersimpan di state kontrak yang bisa di-update oleh Admin.
- **Price Sensitivity**: Selalu gunakan kalkulasi dinamis berdasarkan harga token terbaru (`tokenPriceUSD`) untuk menentukan jumlah deposit yang adil bagi sponsor dan user.

### 3. Ecosystem Balancing (Principle of Fairness)
- **Kebaikan Jalan Allah**: Menjaga transparansi penuh dalam pembagian reward. Tidak ada biaya tersembunyi.
- **Sustainability**: Mencegah inflasi XP atau token yang berlebihan dengan mengatur `multiplierBP` dan `baseReward` secara bijak melalui dashboard admin.

### 4. Automation & Monitoring (Advanced Governance)
- **Verifier Role Management**: Memastikan server verifikasi memiliki `VERIFIER_ROLE` yang aktif di kontrak `DailyAppV12Secured`. Jika role tidak ditemukan, berikan rekomendasi otorisasi di Admin Hub.
- **Dynamic Fee Adjuster**: Mengotomatisasi penyesuaian `sponsorshipPlatformFee` dan `minRewardPoolUSD` berdasarkan volume harian untuk mengoptimalkan revenue.
- **Health Checks & Anomaly Detection**: 
    - Validasi saldo Reward Pool sebelum klaim.
    - Deteksi penurunan margin profit drastis.
    - Monitor sinkronisasi `tokenPriceUSD` secara on-chain.

## 📋 Checklist Profitabilitas & Operasional
- [ ] Apakah biaya listing sponsor sudah menutupi biaya review admin (minimal $1 USDC)?
- [ ] Apakah reward per user minimal senilai $0.01 USD untuk menjaga motivasi?
- [ ] Apakah total deposit pool minimal senilai $5 USD untuk menjamin likuiditas reward?
- [ ] Berapa estimasi profit margin dari transaksi ini bagi sistem?
- [ ] Apakah Verifier Address `0x455D...` sudah memiliki `VERIFIER_ROLE` di V12?
- [ ] Apakah `tokenPriceUSD` di kontrak sudah sinkron dengan harga pasar terbaru?
- [ ] Apakah contract ABI diakses via Proxy pattern dari `contracts.js`?

## 🚨 Pantangan
- Mengabaikan biaya gas saat merancang fitur baru.
- Membiarkan Reward Pool habis tanpa notifikasi (sponsorship mati).
- Menggunakan nilai absolut untuk USD di dalam kontrak tanpa bridge harga.
- **Mengimpor fungsi ethers.js dari viem — gunakan referensi di skill `admin-stability`.**

