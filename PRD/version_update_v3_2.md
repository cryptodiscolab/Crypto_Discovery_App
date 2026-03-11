# Version Update: Crypto Disco v3.2
**Tanggal**: 2026-03-12
**Status**: deployed to Base Sepolia & Database Sync Active

## 🚀 Ringkasan Perubahan (v3.1 ➔ v3.2)

### 1. Ekosistem UGC Raffle & Metadata
- **Rich Metadata Sync**: Form pembuatan raffle kini mendukung Title, Description, Image URL, Category, dan Social Links (Twitter).
- **Metadata Encoding**: Implementasi base64 encoding untuk menyimpan metadata kompleks secara efisien di on-chain dan sinkronisasi otomatis ke database Supabase.
- **Live Preview UI**: Penambahan komponen preview kartu raffle real-time di halaman `CreateRafflePage`.

### 2. Mekanisme XP & Leaderboard Terpadu
- **Multi-Level XP Awarding**:
  - **Creator XP**: 500 XP diberikan saat raffle berhasil diluncurkan.
  - **Buyer XP Multiplier**: XP pembelian tiket kini dikalikan dengan jumlah tiket yang dibeli (100 XP per tiket).
  - **Winner XP**: Klaim hadiah raffle memberikan 1000 XP secara otomatis.
- **Atomic Counters**: Penambahan kolom `raffle_wins`, `raffle_tickets_bought`, dan `raffles_created` di profil user untuk tracking statistik detail.

### 3. Database & Tiering Logic
- **Competitive Tiering**: Implementasi fungsi `PERCENT_RANK()` di SQL View `v_user_full_profile` untuk menentukan tier (Diamond, Platinum, Gold, Silver, Bronze) secara dinamis berdasarkan persentil XP global.
- **Auto-Sync Trigger**: Penambahan trigger `trg_sync_xp_on_claim` yang secara otomatis mengkalkulasi ulang `total_xp` user setiap kali ada klaim baru masuk ke ledger.
- **Security Invoker**: Seluruh view database diperbarui menggunakan `SECURITY INVOKER` untuk mematuhi kebijakan RLS (Row Level Security) Supabase.

### 4. Admin Dashboard (Lurah Hub)
- **Economic Controls**: Admin kini dapat mengatur biaya platform (BP), jumlah daily bonus, dan filter tier peserta langsung dari dashboard tanpa deploy ulang kode.
- **Infrastructure Swap**: Fitur untuk mengganti alamat kontrak (USDC, Raffle, DailyApp) secara live di environment produksi.
- **Real-Time Price Oracle**: Integrasi API DexScreener untuk menampilkan nilai estimasi hadiah dalam USD di dashboard admin.

---

## 🛠️ Technical Documentation Update
- **Master PRD**: Membuat `DISCO_DAILY_MASTER_PRD.md` sebagai dokumentasi teknis utama.
- **HTML PRD**: Memperbarui `PRD_Crypto_Disco_v3_1.html` dengan Mermaid Mind Map dan Global Sequence Diagram terbaru.
- **Walkthrough**: Menyinkronkan `walkthrough.md` dengan status deployment terakhir.

---
**Author**: Antigravity (Ecosystem Sentinel)
