# 🎯 FEATURE WORKFLOW: SOURCE OF TRUTH (v3.40.4)
**Last Updated**: 2026-04-02
**Status**: 🛡️ LOCKED & HARDENED

Dokumen ini adalah **Source of Truth** absolut untuk seluruh alur fungsional (Feature Workflows) di dalam aplikasi Crypto Disco. Semua modifikasi dan pengembangan agen harus mematuhi alur ini untuk mencegah System Drift, desynchronization, atau kegagalan API.

---

## 🔑 1. Login & Identity Management Flow

### 1.1 Social Connect (Neynar / Web2)
- **Tujuan**: Menghubungkan identitas sosial user tanpa gesekan.
- **Workflow**:
  1. User klik "Connect Farcaster/X/TikTok".
  2. Neynar SIWE memvalidasi ownership akun sosial tersebut.
  3. Frontend mengirim `authData` ke `/api/user-bundle?action=update-profile`.
  4. Backend memverifikasi payload (EIP-191).
  5. **Identity Lock**: Backend mengecek apakah `fid`/`twitter_id` sudah tertaut ke `wallet_address` lain (Sybil Prevention).
  6. Jika lolos, Supabase membuat/memperbarui baris di `user_profiles`.

### 1.2 Wallet Connect (Web3)
- **Tujuan**: Autentikasi wallet ke ekosistem Base Sepolia.
- **Workflow**:
  1. User klik "Connect Wallet" (Metamask / AppKit).
  2. `Web3Provider.jsx` memastikan `window.ethereum` tidak crash oleh konflik ekstensi.
  3. Frontend membaca `chainId`. Jika salah jaringan, memunculkan prompt pindah ke Base Sepolia (84532).
  4. Jika dompet terhubung + social terhubung = Akun siap menerima XP dan tier.

---

## 🎁 2. Daily Claim Workflow (The "Optimistic Trust" Model)

Ini adalah alur paling rentan yang telah diperkeras dengan mekanisme kompensasi kegagalan RPC (Remote Procedure Call).

### 2.1 The Claim Execution
- **Triggers**: User klik "Claim" pada `DailyClaimModal`.
- **Pre-Check (Frontend)**: `ProfilePage.jsx` membaca **HANYA** dari `userData.lastDailyBonusClaim` (on-chain) untuk menghitung sisa waktu cooldown (Single Source of Truth).
- **Execution**: Frontend memanggil fungsi `claimDailyBonus()` di kontrak **DailyApp V13.1** (`0x87a3d1203Bf20E7dF5659A819ED79a67b236F571`).
- **Success**: MetaMask/Wallet mengembalikan `tx_hash`.

### 2.2 The Backend Synchronization
- **Triggers**: Setelah `tx_hash` didapat, Frontend memanggil `/api/user-bundle?action=xp`.
- **Workflow (Backend `handleXpSync`)**:
  1. **Validation**: Backend menerima `tx_hash`. Tidak perlu `signature`.
  2. **RPC Read (Lag-Prone)**: Backend mencoba membaca `readContract(userStats)`.
  3. **Optimistic Trust Fallback**:
     - Jika `tx_hash` ada, TETAPI `readContract` gagal/timeout.
     - ATAU jika `tx_hash` valid tapi XP On-Chain belum berubah (RPC lag `xpDelta === 0`).
     - **Maka**: Backend mengabaikannya dan SECARA PAKSA menambahkan `standardDailyReward` ke Supabase.
  4. **Database Write**: `user_profiles.total_xp` di-update dengan nilai baru.
  5. **Activity Log**: Ditulis ke `user_activity_logs` dengan keterangan Daily Claim.

### 2.3 Post-Claim Frontend Refresh
- Frontend menunggu secara eksplisit selama **1.5 detik** sebelum memanggil `refetch()`.
- Tujuannya: Agar Supabase memiliki waktu meng-update SQL Views (`v_user_full_profile`).

---

## 🏆 3. Leaderboard & Database View Synchronization

Leaderboard bergantung pada kueri database yang efisien, bukan RPC blockchain agar bisa merender ribuan user seketika.

### 3.1 Leaderboard Read Flow
- **Data Source**: Menggunakan tabel view `v_user_full_profile`.
- **Mechanism**:
  1. User mengunjungi halaman `/leaderboard`.
  2. Frontend men-fetch data API rank.
  3. Data yang di-return adalah hasil agregasi `user_profiles` (untuk Avatar, Bio, XP) yang sudah langsung terupdate setelah Daily Claim selesai.
- **Rules**: Dilarang me-loop panggil `MasterX` untuk mengambil ranking user, semuanya harus via database `user_profiles.total_xp` yang tersinkron.

---

## 🏅 4. Tier Rank Recalculation (Database Driven)

Setelah XP didapat dari Daily Claim atau Social Tasks, sistem harus menentukan apakah Tier/Rank user berubah. **Tier harus dihitung berdasarkan Database, bukan menunggu on-chain.**

### 4.1 Real-Time Tier Update Flow
- **Workflow** di dalam `/api/user-bundle?action=xp`:
  1. Setelah backend selesai menambahkan XP (misal: total menjadi 12,000 XP).
  2. Backend melakukan **query asinkron langsung ke tabel `sbt_thresholds`** di Supabase (diurutkan descending berdasarkan `xp_required`).
  3. Sistem mencari Tier tertinggi dimana `total_xp >= xp_required`.
  4. Jika "Fan" (10,000 XP) terpenuhi, backend otomatis mengupdate kolom `tier` di `user_profiles` menjadi "Fan".
- **Result**: Saat user pindah ke Leaderboard/Profile, Tier mereka langsung "Fan", tanpa perlu menunggu data dari smart contract.

---

## 🎨 5. Tier Mint / Upgrade Workflow (On-Chain Mint)

Status SBT/NFT ini adalah tiket representasi permanen dari Tier user.

### 5.1 The Upgrade Execution
- **Triggers**: UI memunculkan tombol "Mint / Upgrade" jika tier database (misal: Fan) lebih tinggi dari tier NFT di wallet.
- **Workflow**:
  1. **Supply Check**: Frontend mengecek supply maksimum untuk tier tersebut dari tabel `sbt_thresholds`. Jika Sold Out, tombol di-disable.
  2. **Minting**: Frontend memanggil `MasterX.upgradeSBT()` atau `MasterX.mintSBT()`.
  3. **Event Emitted**: Blockchain mencatat perubahan kepemilikan NFT.
  4. **State Sync**: UI menampilkan banner "SBT Upgraded" dan menghapus tombol upgrade.

---

## 📡 6. Definisi "Healthy State" Ekosistem (CHECKLIST)

Setiap saat fitur baru dibangun, Ekosistem ini dianggap sehat jika memenuhi seluruh kriteria berikut:
1. [ ] **Zero Hardcode**: Tidak ada Contract Address statis di `.js` atau `.jsx` Frontend. Semuanya dibaca lewat Proxy ABI dari import `.env`.
2. [ ] **Dual Config Sync**: `WORKSPACE_MAP.md`, `.cursorrules`, dan `.env` menonjolkan alamat kontrak utama yang **SAMA**.
3. [ ] **Single Source Cooldown**: `DailyClaimModal` menggunakan `userData[3]` (on-chain lastClaim), bukan database, untuk memverifikasi waktu tunggu.
4. [ ] **Optimistic Sync**: XP dapat dikreditkan asalkan ada bukti `tx_hash` transaksi komplit, meskipun RPC provider (seperti Alchemy/Infura) belum up-to-date.
5. [ ] **No Secrets Leak**: Proses git push lolos audit `gitleaks`.

---
*End of Source of Truth Document*
