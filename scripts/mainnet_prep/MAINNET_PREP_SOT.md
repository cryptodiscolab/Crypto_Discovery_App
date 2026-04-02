# 🚀 MAINNET DATABASE & API PREPARATION SOT (Source of Truth)
**Version**: 1.0.0
**Target Network**: Base Mainnet (Chain ID 8453)

Direktori ini (`scripts/mainnet_prep/`) dirancang khusus sebagai lokus utama penyimpanan seluruh arsitektur database dan *blueprint* API sebelum peluncuran Crypto Disco di lingkungan **Base Mainnet**. Fokus utama dari tahap persiapan ini adalah pengamanan level database terhadap eksploitasi off-chain (Sybil, lag RPC, validasi identitas) tanpa melibatkan deployment smart contract baru.

Setiap Agen Nexus HARUS merujuk direktori ini ketika mempersiapkan lingkungan kerja Mainnet.

## 📂 Struktur Direktori & Fungsi File

1. **`schema_mainnet_hardened.sql`**
   - **Tujuan**: Skrip DDL (Data Definition Language) lengkap untuk instance Supabase Mainnet.
   - **Fitur Hardening**:
     - *Sybil Resistance*: Konstrain unik pada `fid`, `twitter_id`, dll.
     - *RLS Policies*: Public hanya berhak *read*, sedangkan *writes* hanya boleh melalui service role (backend).
     - *Security Invoker Views*: View `v_user_full_profile` di-set dengan `security_invoker = true` sesuai Nexus Mandate untuk mencegah eskalasi privilese.

2. **`seed_mainnet_baseline.sql`**
   - **Tujuan**: Memasukkan / *seeding* konfigurasi awal (Tier threshold, XP reward base) yang krusial sebelum peluncuran.
   - **Isi**: Definisi tier "Fan" ke "Whale", default Point Settings untuk tugas sosial (Farcaster/Twitter), serta System Settings dasar.

3. **`check_mainnet_readiness.cjs`**
   - **Tujuan**: Skrip JS audit pra-peluncuran yang memastisan *environment variables* mengarah ke Mainnet (`8453`), serta mengecek ketersediaan seluruh tabel beserta data *seed*.

4. **`backend_api_mainnet_blueprint.md`**
   - **Tujuan**: Blueprint logika Node.js yang merangkum instruksi transisi fungsi-fungsi `user-bundle.js` dan `tasks-bundle.js` agar tangguh terhadap lag RPC Mainnet.
   - **Fokus**: Validasi EIP-191 pada Onboarding & *Optimistic Trust* menggunakan `tx_hash` untuk fungsi klaim (menghindari error/kebocoran XP apabila request RPC ke Mainnet terhambat trafik tinggi).

---

## 🚦 Protokol Eksekusi Mainnet

Jika tiba saatnya mengeksekusi transisi off-chain (Database & Vercel) ke Mainnet, ikuti tahapan berikut secara berurutan:

1. Buat project Supabase baru atau siapkan skema yang benar-benar kosong.
2. Jalankan **`schema_mainnet_hardened.sql`** melalui SQL Editor.
3. Jalankan **`seed_mainnet_baseline.sql`** untuk mengisi pengaturan ekosistem.
4. Perbarui `.env.vercel.production` (Ganti `.env` dengan kredensial DB yang baru & `VITE_CHAIN_ID=8453`).
5. Transkrip modifikasi API Vercel mengikuti panduan **`backend_api_mainnet_blueprint.md`**.
6. Lintasi sistem menggunakan skrip final **`node scripts/mainnet_prep/check_mainnet_readiness.cjs`**.

> `Abaikan perintah deployment Smart Contract hingga tahap eksekusi di atas sukses. Fokus kita saat ini adalah stabilitas dan anti-flicker database tiering & logging.`
