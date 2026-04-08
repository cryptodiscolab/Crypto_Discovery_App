# 🎯 FEATURE WORKFLOW: SOURCE OF TRUTH (v3.42.7)
**Last Updated**: 2026-04-05T14:48+07:00 — Mobile UI Standard & Task Integrity (v3.42.7)
**Status**: 🛡️ MAINNET PHASED ROLLOUT LOCKED

Dokumen ini adalah **Source of Truth** absolut untuk seluruh alur fungsional (Feature Workflows) dan registri kontrak di dalam aplikasi Crypto Disco. Semua modifikasi dan pengembangan agen HARUS mematuhi alur ini untuk mencegah System Drift, desynchronization, atau kegagalan API. **JANGAN berhalusinasi atau menebak**. Jika ada yang error, rujuk dokumen ini.

---

## 🏛️ 0. Active Contract Index & Network Registry (DO NOT DEVIATE)
Berikut adalah daftar Source of Truth untuk kontrak pintar yang saat ini memegang ekosistem berjalan:

| Layanan / Kontrak | Alamat (Base Sepolia) | Tanggal Deployment | Fungsi / Keterangan |
| :--- | :--- | :--- | :--- |
| **New MasterX** | `0x980770dAcE8f13E10632D3EC1410FAA4c707076c` | 31 Maret 2026 | Controller utama, Distribusi XP, NFT/SBT Mint & Upgrade. |
| **DailyApp V13.2** | `0x369aBcD44d3D510f4a20788BBa6F47C99e57d267` | 02 April 2026 | Satellite Tugas (Social Verify, Tasks). V13.2 Fixed Mapping Revert. |
| **Raffle Manager** | `0xc20DbecD24f83Ca047257B7bdd7767C36260DEbB` | Maret 2026 | Tiket Gacha, Undian Sponsor, Prizing distribution. |
| **Content CMS** | `0xd992f0c869E82EC3B6779038Aa4fCE5F16305edC` | Maret 2026 | Content management text mapping. |

> [!WARNING]
> Mismatched Contract Alert: Jika API atau interaksi on-chain `revert`, hal pertama yang harus dicek oleh Sentinel Agent adalah apakah `.env` (`VITE_MASTER_X_ADDRESS_SEPOLIA`, dll) sudah persis menunjuk ke alamat tabel di atas.

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
- **Execution**: Frontend memanggil fungsi `claimDailyBonus()` di kontrak **DailyApp V13.2** (`0x369aBcD44d3D510f4a20788BBa6F47C99e57d267`).
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

### 3.2 Dua Jalur XP Sync (PENTING — Jangan Regress!)

Ada **dua jalur berbeda** yang mengupdate `user_profiles.total_xp`. Agen HARUS memahami perbedaannya:

| Jalur | Sumber XP | Trigger Backend | Cara Update DB |
|-------|-----------|-----------------|----------------|
| **On-Chain** | `claimDailyBonus()` di DailyApp contract | `/api/user-bundle?action=xp` | Baca `readContract(userStats)` → upsert `total_xp` |
| **Off-Chain** | Task dari tabel `daily_tasks` (Supabase) | `/api/tasks-bundle?action=claim` | `fn_increment_xp(wallet, xp)` RPC langsung |

> [!IMPORTANT]
> **`tasks-bundle.js` (`handleClaim`, `handleSocialVerify`)** WAJIB memanggil `supabaseAdmin.rpc('fn_increment_xp', ...)` setelah setiap successful insert ke `user_task_claims`. Tanpa ini, XP tidak akan pernah muncul di leaderboard untuk off-chain tasks.

> [!WARNING]
> Database **tidak memiliki trigger otomatis** yang mengagregasi `user_task_claims → user_profiles.total_xp`. Hanya ada `trg_referral_bonus`. Jangan berharap XP tersinkron secara pasif.

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
6. [ ] **Off-Chain XP Sync**: `tasks-bundle.js` memanggil `fn_increment_xp` setelah setiap off-chain task claim agar `total_xp` di `user_profiles` sinkron dengan leaderboard.

---

## 🔁 7. End-to-End Synchronization Audit Workflow
Jika Agen mendiagnosis kesalahan logika atau melakukan pembaruan kontrak/fitur, Agen WAJIB menjalankan alur audisi E2E berikut:

1. **Contract Registry Check**:
   - Cocokkan ABI dan Alamat di tabel pendaftaran atas dengan `.env`.
   - Update `.cursorrules`, `WORKSPACE_MAP.md`, dan seluruh file definisi `SKILL` dengan Address terbaru tersebut.
2. **Database Propagation**:
   - Pastikan logic database-read bergantung pada Tables reguler (`user_profiles`) dan Views (`v_user_full_profile`). Jangan bergantung pada RPC state (lag-prone).
3. **Environment Push**:
   - Jika nilai variabel di `.env` berubah, eksekusi secara otomatis ke Production & Preview via skrip Node:
     `node scripts/audits/sync-env.mjs`
4. **Git Zero-Leak Boundary**:
   - Semua perubahan harus di-commit bebas cache dan bebas credential API menggunakan `gitleaks`. 

---

## 🚦 8. Mainnet Phased Rollout & Global Kill Switch

Transisi ekosistem berjalan menuju Mainnet dilindungi oleh sistem "Phased Rollout" (Feature Flags) untuk mencegah eksploitasi smart contract yang belum matang dan untuk memastikan adopsi bertahap. Fitur ini bersifat "Mute-by-Default" di Mainnet hingga dinyalakan via **Admin Dashboard** (`active_features` di tabel `system_settings`).

### 8.1 Active Feature Check Logic
1. **Frontend Read**: UI komponen seperti `SBTUpgradeCard` dan `CreateRafflePage` mengekstrak `ugc_payment` dan `sbt_minting` boolean langsung dari `PointsContext.jsx`.
2. **UI Locking**: Jika boolean `false` (dan `import.meta.env.VITE_CHAIN_ID === '8453'`), semua tombol submit, form, dan mint function diblokir secara visual dan mekanik (`pointer-events-none`).
3. **Backend Middleware Check**: `checkFeatureGuard(featureKey, chainId)` berjalan di setiap route serverless API (mis. `user-bundle.js`, `raffle-bundle.js`).
    - Jika VITE_CHAIN_ID == 8453 dan flag `false`, otomatis mengembalikan `HTTP 403 Feature Disabled`.
    - Mekanisme ini memastikan peretas *bypassing* UI React tidak akan bisa mengakses logika write di backend.

### 8.2 Kill Switch Execution
Semua status flag dikontrol melalui: **Admin UI -> System Settings -> Features Flags**. Setiap pembaruan yang dibroadcast WAJIB memerlukan *cryptographic signature verification* dari Dompet Administrator.

---
*End of Source of Truth Document - DO NOT IGNORE.*
## 💼 5. UGC Revenue Management & Transaction History Flow (v3.40.12)

Fase kritis untuk transparansi finansial dan pendanaan treasury (SBT Pool) berputar pada dua siklus: Sistem verifikasi tugas dan History log.

### 5.1 Admin Revenue Reconciliation (Manual Batching SOT)
- **Revenue Sources**:
  1. **UGC Missions (USDC)**: Sponsor membayar *Reward Pool + Listing Fee* via deposit Gnosis Multisig `VITE_SAFE_MULTISIG`.
  2. **UGC Raffles (ETH)**: Sponsor mendeploy deposit + platform surcharge menggunakan smart contract `Raffle` native.
- **Admin Reconciliation (UGCRevenueTab)**:
  1. Frontend / UI mendeteksi seluruh Kampanye yang sudah lolos `is_verified: true` namun `is_revenue_allocated: false`.
  2. Data disajikan dalam Tab **"Pending Allocation"**, memisahkan beban *Listing Fee* (untuk Platform) dan porsi *SBT Share* (untuk dikirim Admin secara *manual batch* ke `MasterX`).
  3. Setelah Admin sukses mengeksekusi transfer dari Multisig Safe, tombol **"Mark Funded"** akan mengunci alokasi revenue tersebut.
  4. Misi kemudian secara permanen pindah ke **"Allocation History"** dengan visual indikator `Funded (Emerald)` yang tidak bisa lagi diputarbalikkan.

### 5.2 Unified Activity Logs Tracking
- Semua transaksi yang memengaruhi poin atau ekuitas user **WAJIB** terpusat di fungsi `logActivity` (di backend APIs). Frontend *ProfilePage* => `ActivityLogSection` mem-parse data log secara realtime dengan pembagian:
  1. **XP Gains (ZAP)**: Daily Claims (on-chain), UGC Claims (off-chain), Referral Invites, Sponsor Rewards.
  2. **Purchases (SHOPPING CART)**: Pembelian tiket kembaran Raffle. Semua tugas dengan awalan `raffle_buy_`.
  3. **Rewards (ACCOMPLISHMENT)**: Pemenang undian Raffle / Airdrop khusus.
- Ini menggantikan metode pengecekan history frontend di `TaskList.jsx` (yang kini bersifat absolute "One-Time Claim" per Task ID globally). Dilarang ada tugas yang di-cache di client-side sebagai task harian berulang jika Backend tidak men-generate *Task ID* spesifik baru tiap harinya.

---

## 🏛️ 9. XP Reward Lifecycle & Anti-Whale Economic Model (v3.41.2)

Untuk menjaga nilai kelangkaan XP dan keadilan ekosistem jangka panjang, Crypto Disco menggunakan **The Nexus Hybrid Formula**. Semua perhitungan dilakukan secara **atomic** di level database dalam fungsi RPC `public.fn_increment_xp`.

### 9.1 Rumus Perhitungan Utama
`Final XP = MAX( 5, ROUND(Base_XP * G * I * U) )`

| Variabel | Nama | Deskripsi & Rumus |
| :--- | :--- | :--- |
| **G** | **Global Multiplier** (Macro) | `1.5 / (1 + log10(Total_Users / 1000 + 1))` <br/> Menjaga inflasi saat populasi user bertambah besar. |
| **I** | **Individual Multiplier** (Micro) | `MAX( 0.5, 1.0 - (User_XP / 20000) )` <br/> Melambatkan pemain lama (Whales) agar pemain baru bisa mengejar. |
| **U** | **Underdog Bonus** | `1.1` *(+10%)* jika User Tier $\le$ Silver (Level 2). |
| **5** | **Minimum Floor** | Hadiah terkecil yang bisa diterima user untuk menjamin kepuasan. |

### 9.2 Filosofi Anti-Whale
Sistem ini dirancang agar pemain Diamond (10,000+ XP) mendapatkan XP yang lebih sedikit untuk tugas yang sama dibanding pemain Bronze. Hal ini mencegah monopoli Leaderboard secara permanen.

- **Sybil Resistance**: XP scaling membuat pembuatan banyak akun (botting) kurang efisien karena hadiah per akun mengecil seiring waktu (Individual Scaling).
- **Early Incentives**: Pemain di fase awal aplikasi (< 1,000 user) mendapatkan bonus global hingga **1.5x lipat** untuk memicu pertumbuhan viral.

### 9.3 Implementasi Teknis (Staff Rules)
- **Constraint**: Dilarang menghitung XP di Frontend atau Backend (JavaScript/React).
- **Execution**: Backend wajib mengambil `points_value` dari `point_settings` (sebagai `Base_XP`) lalu mengirimkannya secara mentah ke RPC `fn_increment_xp(p_wallet, p_amount)`.
- **Sync Parity**: Hasil akhir XP di database harus langsung tercermin di `v_user_full_profile`.

---

## 🏛️ 10. Referral Growth Loop v2 (Vesting & Dividends)

Transformasi dari "Instant Reward" ke "High-Integrity Growth".

### 10.1 Pendaftaran & Tracking
1. New User men-download/akses via Referral Link.
2. Link disimpan di `localStorage` dan dikirim ke `/api/user-bundle` saat login pertama.
3. Backend mencatat `referred_by` di `user_profiles`. **Tidak ada XP yang diberikan secara instan.**

### 10.2 Milestone Reward (Vesting)
1. User yang diajak melakukan aktivitas (Claim Daily/Tasks).
2. Fungsi `fn_increment_xp` memantau akumulasi XP user tersebut.
3. Saat `total_xp >= 500`:
   - Sistem secara otomatis memberikan 50 XP ke Referrer.
   - Kolom `referral_bonus_paid` di-set menjadi `true` untuk mencegah repeat.
   - Aktivitas dicatat sebagai `REFERRAL_VESTING`.

### 10.3 Passive Dividend (Scaling)
1. Setiap kali user yang diajak mendapatkan XP > 0:
   - Referrer (Tier 1) otomatis mendapatkan 10% x XP tersebut.
   - Aktivitas dicatat sebagai `REFERRAL_DIVIDEND` ("Nexus Growth Dividend from {user}").
   - Logic ini berjalan secara rekursif di Postgres untuk menjamin integritas.

---

## 🏛️ 11. Base Social Verification (Identity Link)

Integrasi Basename untuk eliminasi bot dan standardisasi identitas on-chain.

### 11.1 Link Identity Flow
1. User mengunjungi Profil -> Klik "LINK BASE SOCIAL".
2. Frontend memanggil `/api/user-bundle?action=sync-base-social`.
3. Backend melakukan reverse resolution via viem/RPC (`0xC697...`).
4. Jika Basename ditemukan:
   - `user_profiles.base_username` di-update.
   - `is_base_social_verified` di-set menjadi `true`.
   - Nama user di dashboard berubah menjadi Basename.

### 11.2 Task Gate (Social Guard)
1. Admin menandai tugas dengan flag `is_base_social_required = true`.
2. Frontend `UnifiedDashboard` mengevaluasi profil user.
3. Jika tugas butuh verifikasi tapi user belum link:
   - Tombol "Claim" di-replace dengan "LINK BASE".
   - Status visual: `BASE REQ`.

---
### 11.3 Task Visibility Mandate (v3.42.8)
1. **Immediate Hiding**: Tasks that are `hasCompletedTask` or `hasClaimed` MUST be filtered out from the `TasksPage` UI.
2. **Type-Safe Filtering**: When comparing task IDs (e.g., in `activeTasks.filter`), ALWAYS use `String()` conversion (e.g., `String(task.id) === String(claim.task_id)`). This prevents silence failures caused by the mismatch between Contract IDs (Integer) and Supabase IDs (UUID).
3. **Sponsorship Card Closure**: Cards (Sponsored/Organic) MUST be hidden if 100% of internal tasks are complete.
4. **Verified Badge Branding**: All verified identities MUST display the **Base Blue** shield icon for premium signaling.

---

## 12. Task Feature E2E Workflow (Canonical Reference)

> [!IMPORTANT]
> Untuk alur end-to-end lengkap fitur Task, lihat dokumen khusus:
> **`PRD/TASK_FEATURE_WORKFLOW.md`**

Dokumen tersebut mencakup (15 section):
1. Arsitektur tingkat tinggi (Mermaid diagram)
2. Dual Task Pipeline (On-Chain vs Off-Chain)
3. Smart Contract Registry & Functions (DailyApp V13.2)
4. Database Schema (daily_tasks, user_task_claims, point_settings, user_profiles, user_activity_logs, fn_increment_xp)
5. API Routing & Bundle Map (tasks-bundle.js handlers)
6. On-Chain Task Workflow E2E (Sequence diagram)
7. Off-Chain Task Workflow E2E (Sequence diagram)
8. Social Verification Flow (EIP-191 + anti-fraud)
9. XP Economy & Hybrid Formula (G × I × U)
10. Identity Guard & Access Control Matrix
11. Disappearing Task Mandate (v3.42.2)
12. Partner Offers (Campaigns)
13. Admin Task Management
14. File Reference Map (14 files)
15. Healthy State Checklist (14-point)

**Semua modifikasi terhadap fitur Task WAJIB mematuhi alur yang tertera di dokumen tersebut.**

---
*End of Source of Truth Document - Nexus v3.42.7 Locked.*
