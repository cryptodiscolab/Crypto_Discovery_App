# 🎯 FEATURE WORKFLOW: SOURCE OF TRUTH (v3.57.0)
**Last Updated**: 2026-05-05T23:30:00+07:00 — UGC Mission Hardening & All-or-Nothing Claim (v3.57.0)
**Status**: 🛡️ MAINNET PHASED ROLLOUT LOCKED

Dokumen ini adalah **Source of Truth** absolut untuk seluruh alur fungsional (Feature Workflows) dan registri kontrak di dalam aplikasi Crypto Disco. Semua modifikasi dan pengembangan agen HARUS mematuhi alur ini untuk mencegah System Drift, desynchronization, atau kegagalan API. **JANGAN berhalusinasi atau menebak**. Jika ada yang error, rujuk dokumen ini.

---

## 🏛️ 0. Active Contract Index & Network Registry (DO NOT DEVIATE)
Berikut adalah daftar Source of Truth untuk kontrak pintar yang saat ini memegang ekosistem berjalan:

| Layanan / Kontrak | Alamat (Base Sepolia) | Tanggal Deployment | Fungsi / Keterangan |
| :--- | :--- | :--- | :--- |
| **New MasterX** | `0x980770dAcE8f13E10632D3EC1410FAA4c707076c` | 31 Maret 2026 | Controller utama, Distribusi XP, NFT/SBT Mint & Upgrade. |
| **DailyApp V13.2** | `0x369aBcD44d3D510f4a20788BBa6F47C99e57d267` | 02 April 2026 | Satellite Tugas (Social Verify, Tasks). V13.2 Fixed Mapping Revert. |
| **Raffle Manager** | `0xA13AF0d916E19fF5aE9473c5C5fb1f37cA3D90Ce` | 29 April 2026 | Tiket Gacha, Undian Sponsor, Refund Protocol V2.1. |
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
  1. (A) **Auto-Login via Platform**: Jika `useEnvironment` mendeteksi `isFarcaster` atau `isBaseApp`, Wagmi akan melakukan `connect` otomatis ke connector spesifik (`injected` untuk Farcaster, `coinbaseWalletSDK` untuk Base App) dan langsung menembak `signIn()` ke Backend (SIWE).
  2. (B) **Manual Login**: Jika browser Web biasa, user harus klik "Connect Wallet".
  3. `Web3Provider.jsx` memastikan `window.ethereum` tidak crash oleh konflik ekstensi.
  4. Frontend membaca `chainId`. Jika salah jaringan, memunculkan prompt pindah ke Base Sepolia (84532).
  5. Jika dompet terhubung + social terhubung = Akun siap menerima XP dan tier.

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
| **Off-Chain** | Task dari tabel `daily_tasks` (Supabase) | `Verification-Server` → `tasks-bundle.js` | `fn_increment_xp(wallet, xp)` RPC langsung |

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

## 🎨 5. Tier Mint / Upgrade Workflow (On-Chain Mint) — v3.56.4
Status SBT/NFT ini adalah tiket representasi permanen dari Tier user yang bersifat **Soulbound** dan **Sequential**.

### 5.1 The Upgrade Execution
- **Triggers**: UI memunculkan tombol "Mint / Upgrade" jika tier database (misal: Fan) lebih tinggi dari tier NFT di wallet.
- **Rules (Mandatory)**:
    1. **Sequential Upgrade**: User **DILARANG** melompat tier. Upgrade harus mengikuti urutan Rookie -> Bronze -> Silver -> Gold -> Platinum -> Diamond. Kontrak `DailyAppV13` akan me-revert transaksi jika `tier != currentTier + 1`.
    2. **Soulbound Mandate**: NFT SBT bersifat **Non-Transferable**. Setiap upaya transfer antar wallet (kecuali mint/burn) akan di-revert oleh kontrak.
- **Workflow**:
    1. **Pre-Check UI**: `SBTUpgradeCard` memverifikasi 4 syarat: `hasTotalXP` (DB), `hasOnChainXP` (MASTER_X), `hasEnoughETH` (balance), dan `!isSoldOut` (DAILY_APP nftConfigs).
    2. **Cost Transparency**: UI menampilkan estimasi biaya USDC secara real-time berdasarkan konversi ETH terkini agar user mendapatkan kejelasan finansial sebelum konfirmasi.
    3. **ETH Pre-Check**: Jika balance tidak cukup, tampilkan error toast SEBELUM buka wallet.
    4. **Minting**: Frontend memanggil `mintNFT(tierId, mintPrice)` dari `useNFTTiers` hook — yang memanggil `DAILY_APP.mintNFT()`. 
    5. **On-Chain Enforcement**: Kontrak memvalidasi urutan tier dan membakar XP yang sesuai.
    6. **Event Emitted**: Blockchain mencatat perubahan kepemilikan NFT.
    7. **State Sync**: UI menampilkan banner "NFT Minted!" dan menghapus tombol upgrade.
    8. **DB Log**: Signature request ke `/api/user-bundle?action=sync-sbt-upgrade` untuk logging aktivitas.

> [!WARNING]
> Jangan pernah memanggil `useSBT.upgradeTier()` untuk minting tier NFT dari `SBTUpgradeCard`. Itu adalah contract yang berbeda (`MASTER_X`) dengan logika yang berbeda. Gunakan `useNFTTiers.mintNFT(id, price)` yang memanggil `DAILY_APP.mintNFT()`.

---

## 🚦 6. Definisi "Healthy State" Ekosistem (CHECKLIST)

Setiap saat fitur baru dibangun, Ekosistem ini dianggap sehat jika memenuhi seluruh kriteria berikut:
1. [ ] **Zero Hardcode**: Tidak ada Contract Address statis di `.js` atau `.jsx` Frontend. Semuanya dibaca lewat Proxy ABI dari import `.env`.
2. [ ] **Dual Config Sync**: `WORKSPACE_MAP.md`, `.cursorrules`, dan `.env` menonjolkan alamat kontrak utama yang **SAMA**.
3. [ ] **Single Source Cooldown**: `DailyClaimModal` menggunakan `userData[3]` (on-chain lastClaim), bukan database, untuk memverifikasi waktu tunggu.
4. [ ] **Optimistic Sync**: XP dapat dikreditkan asalkan ada bukti `tx_hash` transaksi komplit, meskipun RPC provider (seperti Alchemy/Infura) belum up-to-date.
5. [ ] **No Secrets Leak**: Proses git push lolos audit `gitleaks`.
6. [ ] **Off-Chain XP Sync**: `tasks-bundle.js` memanggil `fn_increment_xp` setelah setiap off-chain task claim agar `total_xp` di `user_profiles` sinkron dengan leaderboard.
7. [ ] **Two-Step Task Flow**: Off-chain tasks dengan `task_link` HARUS menampilkan "GO TO TASK" sebelum "CLAIM REWARD" dapat diaktifkan (v3.47.1).
8. [ ] **Contract Call Parity**: Setiap contract write call HARUS menggunakan contract yang SAMA dengan sumber data read-nya. Mint data dari DAILY_APP → write ke DAILY_APP (v3.47.1).
9. [ ] **SDK Error Visibility**: Setiap async SDK call (Li.Fi, Neynar, etc.) HARUS memiliki visible error state di UI jika gagal, bukan hanya console.error (v3.47.1).
10. [ ] **Concurrent UI Performance**: Seluruh modal dengan hook berat (Wagmi, Li.Fi) WAJIB menggunakan `startTransition` untuk mencegah pemblokiran main thread (v3.56.0).

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
*End of Source of Truth Document - Nexus v3.56.0 Locked.*
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


 ### 5.3 UGC Mission Creation Flow (Sponsor Side)
 1. **Input Reward Pool**: Sponsor menentukan jumlah reward dalam nominal ETH. UI secara otomatis mengonversi ke estimasi USDC.
 2. **UX Safeguard**: Tooltip info menjelaskan bahwa pembayaran aktual dilakukan dalam ETH (Native).
 3. **Batch Execution (EIP-5792)**: Tombol "CREATE" mengeksekusi batch call (Listing Fee USDC + Reward Pool ETH).
 4. **Resilient Tracking**: Sistem menggunakan `useCallsStatus` untuk memantau status bundle transaksi batch, mencegah UI hang saat menunggu konfirmasi dari provider (v3.45.0).
 
 ### 5.2 Unified Activity Logs Tracking
- Semua transaksi yang memengaruhi poin atau ekuitas user **WAJIB** terpusat di fungsi `logActivity` (di backend APIs). Frontend *ProfilePage* => `ActivityLogSection` mem-parse data log secara realtime dengan pembagian:
- **XP Gains (ZAP)**: Daily Claims (on-chain), UGC Claims (off-chain), Referral Invites, Sponsor Rewards.
- **Purchases (SHOPPING CART)**: Pembelian tiket kembaran Raffle. Semua tugas dengan awalan `raffle_buy_`.
- **Rewards (ACCOMPLISHMENT)**: Pemenang undian Raffle / Airdrop khusus.
- Ini menggantikan metode pengecekan history frontend di `TaskList.jsx` (yang kini bersifat absolute "One-Time Claim" per Task ID globally). Dilarang ada tugas yang di-cache di client-side sebagai task harian berulang jika Backend tidak men-generate *Task ID* spesifik baru tiap harinya.

---
*End of Source of Truth Document - Nexus v3.56.0 Locked.*

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
### 11.3 Task Visibility & Nexus Metadata Mandate (v3.53.0)
1. **Immediate Hiding**: Tasks that are `hasCompletedTask` or `hasClaimed` MUST be filtered out from the `TasksPage` UI.
2. **Authoritative Expiry**: Tasks with an `expires_at` timestamp in the past MUST be filtered out from the UI. Daily tasks default to a 24-hour expiration from `created_at`.
3. **Type-Safe Filtering**: When comparing task IDs (e.g., in `activeTasks.filter`), ALWAYS use `String()` conversion.
4. **Nexus Parity Mandate**: Task and Raffle cards MUST display consistent metadata stamps:
    - **Unique ID**: System traceability via `Hash` icon.
    - **Creator Attribute**: Distinguish between ADMIN, USER (Address), or SYSTEM via `ShieldCheck` icon.
    - **Created At & Expires At**: Explicit timestamps for urgency and historical transparency via `Clock` icon.
    - **Dual Rewards**: Clear distinction between XP (Coins) and Token/USDC (Gift) rewards.
5. **Verified Badge Branding**: All verified identities MUST display the **Base Blue** shield icon for premium signaling.

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

## 🏛️ 13. Raffle Moderation & Refund Workflow (Protocol V2.1)
Mekanisme pengamanan dana sponsor saat konten UGC tidak disetujui.

### 13.1 Administrative Rejection
- **Triggers**: Admin klik tombol "REJECT" pada `ModerationCenterTab.jsx`.
- **Workflow**:
  1. **On-Chain Refund**: Dashboard memanggil `cancelRaffle(raffleId)` di kontrak Raffle V2.1.
  2. **Fund Recovery**: Kontrak memverifikasi `totalTickets == 0` dan mengirimkan kembali deposit ETH ke `sponsor`.
  3. **Event**: Blockchain memancarkan `RaffleCancelled`.
  4. **API Sync**: Setelah `tx_hash` didapat, Frontend memanggil `/api/user-bundle?action=reject-raffle`.
  5. **DB Update**: Backend mencatat `cancellation_tx`, mengubah status raffle di Supabase, dan merekam aksi di `admin_audit_logs`.

---

## 👁️ 14. Lurah Sentinel & Sync State Architecture (v3.56.5)
Arsitektur pemantauan ekosistem sekarang eksklusif berada di jaringan Vercel Serverless.

### 14.1 Vercel Cron Override
- **Lurah Cron**: Dijalankan via `/api/lurah-cron` (berdasarkan `vercel.json`). Menyimpan health check di tabel `system_health` dengan `service_key: lurah_ekosistem`.
- **Legacy Ban**: Script PM2/Hardhat lokal seperti `sync-sbt.cjs` dan `sync-underdog.cjs` DILARANG digunakan lagi. Entry health lama mereka WAJIB dihapus dari `system_health`.

### 14.2 Sync Events Staleness Protection
- **Sync State**: Endpoint `/api/cron/sync-events` memantau jarak block on-chain dan off-chain di tabel `sync_state`.
- **Catch-Up Mechanism**: Cron akan melakukan iterasi 2000 blocks per eksekusi. Jika `last_synced_block` tertinggal sangat jauh (mis. 14 hari), dilarang memaksa `sync_state` dengan limit ekstrem. Biarkan catch-up harian otomatis atau lakukan block reset terukur.

---
---

## 🏛️ 15. UGC Multi-Action & All-or-Nothing Campaign Workflow (v3.57.0)

Evolusi sistem misi UGC untuk mendukung kampanye multi-tugas yang lebih kompleks dan bernilai tinggi.

### 15.1 Campaign Creation (Creator Side)
1. **Multi-Action Input**: Creator memilih hingga 3 aksi (Follow, Like, Recast, dsb) dalam satu form.
2. **URL Validation**: Frontend melakukan regex matching terhadap link berdasarkan platform yang dipilih (Warpcast, X, TikTok, IG).
3. **Atomic Deployment**:
   - `admin-bundle.js` menerima array `action_types`.
   - Melakukan batch insert ke `daily_tasks` dimana setiap sub-tugas memiliki `onchain_id` yang sama (ID Kampanye).
   - Status kampanye diaktifkan setelah verifikasi pembayaran sukses.

### 15.2 Verification & Progress (User Side)
1. **Grouping Logic**: `TasksPage.jsx` mem-fetch kampanye aktif dan sub-tugasnya, mengelompokkannya menggunakan komponen `UGCCampaignCard`.
2. **Individual Verification**: User melakukan verifikasi sub-tugas satu per satu. Setiap sukses verifikasi akan mencatat record di `user_task_claims` namun BELUM memberikan reward XP/USDC.
3. **Progress Tracking**: UI menampilkan indikator (misal: 1/3, 2/3) secara real-time.

### 15.3 All-or-Nothing Reward Claim
1. **Completion Trigger**: Saat progres mencapai 3/3 (atau N/N), tombol "CLAIM TOTAL REWARD" aktif di Pop-up Modal.
2. **Final Verification (`claim-ugc-campaign`)**:
   - Backend mengecek integritas seluruh sub-tugas yang terikat ke kampanye tersebut.
   - Jika valid, backend mengeksekusi distribusi XP dan USDC secara atomik.
   - Record `user_task_claims` untuk ID kampanye (sebagai parent) dibuat untuk menandai kampanye selesai secara permanen.
3. **Social Sharing**: Setelah klaim, user disuguhi opsi sharing referal ke media sosial untuk memperkuat loop pertumbuhan.

---
*End of Source of Truth Document - Nexus v3.57.0 Locked.*

