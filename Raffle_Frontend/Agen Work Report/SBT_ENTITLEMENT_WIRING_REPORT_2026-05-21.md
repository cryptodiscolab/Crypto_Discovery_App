# Work Report: SBT Entitlement Verifier Wiring — 2026-05-21

**Author**: Cline (AI Agent)
**Owner**: CryptoDiscoLab
**Status**: ❌ CANCELLED — All entitlement work reverted

---

## Ringkasan

Dibuatkan script one-time wiring dan rencana backend entitlement untuk menghubungkan `DailyAppV15` dengan `SBTMintEntitlementVerifier`. Namun setelah diskusi dengan owner, diputuskan bahwa **semua XP harus on-chain** — tidak ada pemisahan XP database vs on-chain untuk SBT mint. Maka dari itu, seluruh pekerjaan entitlement dibatalkan dan semua file serta konfigurasi yang sudah dibuat dihapus.

---

## Kronologi Pekerjaan

| # | Waktu | Aktivitas | Status |
|---|---|---|---|
| 1 | 10:17 | Analisis kontrak `DailyAppV15.sol` dan `SBTMintEntitlementVerifier.sol` | ✅ Selesai |
| 2 | 10:17 | Review existing deployment scripts untuk pattern reference | ✅ Selesai |
| 3 | 10:17 | Identifikasi address kontrak dari `.env` files | ✅ Selesai |
| 4 | 10:26 | Buat `scripts/deployments/setup-sbt-verifier-wiring.cjs` | ✅ Selesai |
| 5 | 10:26 | Syntax validation (`node --check` passed) | ✅ Selesai |
| 6 | 10:34 | Audit kontrak terhadap script (no mismatch found) | ✅ Selesai |
| 7 | 10:39 | Add env vars ke root `.env` | ✅ Selesai |
| 8 | 10:46 | Isi `BACKEND_ENTITLEMENT_SIGNER = 0xf39Fd6e...` | ✅ Selesai |
| 9 | 10:51 | Jelaskan arsitektur end-to-end entitlement pipeline | ✅ Selesai |
| 10 | 11:01 | Audit race condition XP / leaderboard / SBT pool | ✅ Selesai |
| 11 | 11:13 | Buat rencana lengkap (plan mode) — 3 tahap | ✅ Selesai |
| 12 | 11:21 | Jawab 4 pertanyaan owner tentang fairness sistem | ✅ Selesai |
| 13 | 11:26 | Usulkan 3 solusi untuk SBT Pool Reward fairness | ❌ Ditolak owner |
| 14 | 11:35 | Owner putuskan: **semua XP harus on-chain** | ✅ Final decision |
| 15 | 11:39 | **Cancel** seluruh pekerjaan entitlement | ✅ Eksekusi |
| 16 | 11:41 | Hapus `setup-sbt-verifier-wiring.cjs` dari lokal | ✅ Selesai |
| 17 | 11:42 | Hapus `VITE_SBT_MINT_ENTITLEMENT_VERIFIER_ADDRESS_SEPOLIA` dari root `.env` | ✅ Selesai |
| 18 | 11:42 | Hapus `BACKEND_ENTITLEMENT_SIGNER` dari root `.env` | ✅ Selesai |
| 19 | 11:43 | Hapus duplikat `VITE_SBT_MINT_ENTITLEMENT_VERIFIER_ADDRESS_SEPOLIA` di root `.env` | ✅ Selesai |
| 20 | 11:43 | Hapus `VITE_SBT_MINT_ENTITLEMENT_VERIFIER_ADDRESS_SEPOLIA` dari `Raffle_Frontend/.env` | ✅ Selesai |
| 21 | 11:49 | Buat work report ini | ✅ Selesai |

---

## Status Files Setelah Pembersihan

### Lokal (✅ Sudah dibersihkan)

| File | Status |
|---|---|
| `scripts/deployments/setup-sbt-verifier-wiring.cjs` | ❌ **Dihapus** |
| `Disco_DailyApp/.env` — `VITE_SBT_MINT_ENTITLEMENT_VERIFIER_ADDRESS_SEPOLIA` (baris 55) | ❌ **Dihapus** |
| `Disco_DailyApp/.env` — `BACKEND_ENTITLEMENT_SIGNER` (baris 56) | ❌ **Dihapus** |
| `Disco_DailyApp/.env` — `VITE_SBT_MINT_ENTITLEMENT_VERIFIER_ADDRESS_SEPOLIA` duplikat (baris 190) | ❌ **Dihapus** |
| `Raffle_Frontend/.env` — `VITE_SBT_MINT_ENTITLEMENT_VERIFIER_ADDRESS_SEPOLIA` | ❌ **Dihapus** |
| `verification-server/.env` | ✅ Bersih (tidak ada entitlement vars) |

### Vercel (⚠️ Perlu dihapus manual oleh owner)

| Platform | Env Var | Action Needed |
|---|---|---|
| Vercel — Raffle Frontend | `VITE_SBT_MINT_ENTITLEMENT_VERIFIER_ADDRESS_SEPOLIA` | Hapus manual di dashboard |
| Vercel — Verification Server | `BACKEND_ENTITLEMENT_SIGNER` (jika ada) | Hapus manual di dashboard |

---

## Keputusan Owner (Final)

> **"Semua XP harus on-chain"** — tidak ada pemisahan XP database vs on-chain.

Semua aktivitas yang memberikan XP harus masuk langsung ke **satu kontrak** (`DailyAppV15` atau V16 nanti):

| Aktivitas | Lokasi XP Saat Ini | Target ke Depan |
|---|---|---|
| Daily Claim (1x24H) | ✅ On-chain | ✅ On-chain |
| Daily Task | ✅ On-chain | ✅ On-chain |
| Social Task (Farcaster/Twitter) | ❌ Database | ✅ On-chain |
| UGC Task Creator | ❌ Database | ✅ On-chain |
| UGC Raffle Creator | ❌ Database | ✅ On-chain |
| Buy Raffle Ticket | ❌ Database | ✅ On-chain |
| Winning Raffle | ❌ Database | ✅ On-chain |
| Claiming Tasks | ❌ Database | ✅ On-chain |
| Daily Mojo | ❌ Database | ✅ On-chain |
| Swap Token | ❌ Database | ✅ On-chain |
| Purchase Item | ❌ Database | ✅ On-chain |
| Mint/Upgrade NFT | ✅ On-chain | ✅ On-chain |

---

## Task List yang Belum Dikerjakan (Future Work)

> Semua item ini di-cancel mengikuti keputusan owner. Tidak perlu dikerjakan.

| Task | Status | Notes |
|---|---|---|
| Buat route `POST /api/sbt/entitlement` di verification-server | ❌ Cancelled | Tidak diperlukan — semua XP on-chain |
| Buat EIP-712 signer service | ❌ Cancelled | Tidak diperlukan |
| Integrasi frontend: panggil entitlement → submit tx | ❌ Cancelled | Tidak diperlukan |
| Deploy SBTMintEntitlementVerifier ke Base Sepolia | ❌ Cancelled | Sudah deployed tapi tidak dipakai |
| Run wiring script `setup-sbt-verifier-wiring.cjs` | ❌ Cancelled | Script sudah dihapus |
| DailyAppV16 — kontrak baru untuk semua XP on-chain | ✅ Deployed | Proxy `0xb592D6819Ea310d83034cD80FDDC2e754D0a5353`; frontend resolves through `VITE_DAILY_APP_V16_ADDRESS` |

---

## ✅ Extension: DailyAppV16 — All XP On-Chain Contract

Setelah wiring entitlement dicancel, owner meminta kontrak baru sesuai visi **"semua XP harus on-chain"**.

| Task | Status |
|---|---|
| Audit ketiga kontrak (V15, MasterX, Raffle) untuk paham alur XP existing | ✅ Selesai |
| Rencana arsitektur V16 — unified XP ledger, UUPS upgradeable, 7 channel award | ✅ Selesai |
| Tulis `DailyAppV16.sol` — 1070 baris | ✅ Selesai |
| Tambahkan `batchMigrateUsers` (referral logic yang sempat terlewat) | ✅ Selesai |
| Update `CONTRACTS_DOCUMENTATION.md` dengan info V16 | ✅ Selesai |
| Deploy proxy DailyAppV16 ke Base Sepolia | ✅ Selesai |
| Wire MasterX, Raffle, verifier/social, dan deployer fallback roles | ✅ Selesai |
| Tambah Admin Dashboard AccessControl untuk `grantRole` / `revokeRole` | ✅ Selesai |

### V16 vs V15 — Perbandingan Cepat

| Aspek | V15 | V16 |
|---|---|---|
| Entitlement Verifier | Ada | ❌ Dihapus |
| syncOffchainXP | Ada | ❌ Dihapus |
| Sumber XP | On-chain + Database | ✅ All On-Chain |
| Role baru | ADMIN, VERIFIER | ✅ + 6 role baru |
| Rate limit per channel | Tidak ada | ✅ 6 channel epoch |
| Upgrade pattern | Construct-only | ✅ UUPS |
| lifetimeXp | Tidak ada | ✅ Ada |

### V16 Deployment & Admin AccessControl Update (2026-05-22)

| Item | Status |
|---|---|
| Proxy | `0xb592D6819Ea310d83034cD80FDDC2e754D0a5353` |
| Implementation | `0x77f3E2CD30f871723b05Bf36C23a431B7e2d7c61` |
| Active env key | `VITE_DAILY_APP_V16_ADDRESS` |
| Admin dashboard | `Role Management -> DailyApp V16 AccessControl` |
| Supported admin actions | `grantRole`, `revokeRole` |
| Production handover rule | Grant new role target first, verify on-chain, then revoke old deployer target |

### V16 Channel XP Award

| Channel | Rate Limit /24h | Dipanggil oleh |
|---|---|---|
| Raffle Buy / Win | 5,000 XP | RAFFLE_ROLE (CryptoDiscoRaffle) |
| Social Task | 2,000 XP | SOCIAL_ROLE / VERIFIER_ROLE (verification-server) |
| UGC Task / Raffle | 10,000 XP | UGC_ROLE (backend) |
| Mojo | 500 XP | MOJO_ROLE (cron bot) |
| Swap | 3,000 XP | SWAP_ROLE (swap bot) |
| Purchase | 5,000 XP | PURCHASE_ROLE (backend) |

---

## Pelajaran

1. **SBTMintEntitlementVerifier** dirancang untuk "DB-canonical SBT mint" — bertentangan dengan visi all-on-chain owner.
2. Wiring entitlement hanya masuk akal jika ada pemisahan XP database vs on-chain.
3. Karena owner ingin semuanya on-chain, entitlement verifier contract saat ini **tidak memiliki fungsi** — bisa dianggap legacy.
4. V16 sudah mencakup semua aktivitas XP di satu kontrak. Tidak perlu syncOffchainXP atau entitlement.
