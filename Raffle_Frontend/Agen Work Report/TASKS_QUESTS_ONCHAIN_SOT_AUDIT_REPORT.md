# 🎯 AUDIT REPORT: TASKS & QUESTS ON-CHAIN SOT MIGRATION

- **Date**: 2026-05-31T08:20+07:00
- **Ecosystem Version**: v3.64.36-Hardened
- **Agent**: Antigravity (Lead Senior Staff Engineer & QA)
- **Status**: 🔍 AUDIT COMPLETED — PENDING IMPLEMENTATION

---

## 📋 1. EXECUTIVE SUMMARY

Kami telah melakukan audit menyeluruh terhadap alur **Tasks & Quests** (Quest Board), meliputi pemuatan tugas di frontend (`TasksPage.tsx`, `TaskList.tsx`), eksekusi verifikasi di backend (`_tasks-bundle.ts`), dan integrasi on-chain (`DailyAppV16`).

Ditemukan **celah desinkronisasi/drift XP yang nyata** pada jalur tugas off-chain biasa dan klaim kampanye UGC, di mana XP hanya tercatat di database (`user_profiles.total_xp`) tetapi tidak pernah dikirim ke blockchain (`DailyAppV16`). Arsitektur harus dimigrasikan ke **On-Chain SOT (Source of Truth) murni** dengan memanfaatkan infrastruktur `awardOnChainXp` yang sudah siap.

---

## 📊 2. DATA MAPPING & DRIFT ANALYSIS

| Fitur / Parameter | SOT Asli | Titik Sinkronisasi (Sync Point) | Masalah / Temuan Drift Saat Ini |
|---|---|---|---|
| **Off-Chain Tasks (Missions)** | DB Table `daily_tasks` (definisi) | Frontend `TaskList.tsx` klik klaim -> POST `/api/tasks-bundle?action=claim` -> DB `user_task_claims` | **🔴 CRITICAL DRIFT**: XP hanya bertambah di Supabase via `insertClaimAndIncrementXp`. Tidak ada write on-chain, sehingga saldo XP blockchain user tertinggal. |
| **UGC Campaigns (Sponsored)** | DB Table `campaigns` & `daily_tasks` (sub-tasks) | Frontend `UGCCampaignCard.tsx` -> POST `/api/tasks-bundle?action=claim-ugc-campaign` | **🔴 CRITICAL DRIFT**: Reward XP kampanye UGC hanya tercatat di database. Poin on-chain di contract `DailyAppV16` tidak tersinkronisasi. |
| **Gacha Wheel Tiers (Prize)** | Smart Contract `DailyAppV16` (SBT Tier) | Frontend `GachaModal` -> POST `/api/tasks-bundle?action=spin-gacha` | **⚠️ STATE DRIFT**: Jika user menang hadiah "Bronze Upgrade", backend langsung mengubah `tier: 1` di database tanpa melakukan minting SBT on-chain di contract. |
| **On-Chain Tasks (doTask)** | Smart Contract `DailyAppV16` | User memanggil `doTask()` di contract -> verify signature -> POST `/api/tasks-bundle?action=social-verify` | **🟢 SECURE**: XP dikirim on-chain via `awardSocialXp()` oleh bot signer, lalu di-mirror ke DB. |
| **Social Verification** | Farcaster/X API + Contract | POST `/api/tasks-bundle?action=social-verify` | **🟢 SECURE**: Memanggil `awardSocialXp()` on-chain via bot signer terlebih dahulu sebelum DB write. |

---

## 🔍 3. INTEGRITY AUDIT CHECKLIST (QA SCENARIOS)

- [ ] **Skenario Q-1: Off-Chain XP Drift**
  - *Pertanyaan*: Apakah setelah user berhasil mengklaim "Quick Mission" (seperti visit website) di `TaskList.tsx`, XP on-chain mereka bertambah?
  - *Status*: **FAIL**. Backend `handleClaim` hanya mengubah database.
- [ ] **Skenario Q-2: UGC Campaign XP Drift**
  - *Pertanyaan*: Apakah setelah user menyelesaikan 3/3 sub-tugas dan mengklik "Claim Total Reward" di kampanye UGC, poin XP on-chain mereka terupdate?
  - *Status*: **FAIL**. Backend `handleClaimUgcCampaign` tidak memicu on-chain transaction.
- [ ] **Skenario Q-3: Gacha Tier Drift**
  - *Pertanyaan*: Apakah hadiah "Bronze Upgrade" dari Gacha memicu minting SBT secara on-chain agar tersinkronisasi dengan NFT Gallery?
  - *Status*: **FAIL**. Hanya update kolom `tier` secara off-chain di database.
- [ ] **Skenario Q-4: On-Chain Task Loss Prevention**
  - *Pertanyaan*: Jika transaksi `doTask()` sukses on-chain tetapi backend sync offline/gagal, apakah user masih bisa mengklaim ulang?
  - *Status*: **PASS**. `hasCompletedTask(user, taskId)` di contract mencegah double-action.

---

## 🛠️ 4. PRIORITIZED TASK LIST (MIGRATION PLAN)

### 🔴 1. Core Data: On-Chain XP untuk Off-Chain Tasks
- **Masalah**: Klaim tugas dari `TaskList.tsx` murni bersifat DB-first.
- **Solusi**: Refaktor `handleClaim` di `_tasks-bundle.ts` untuk memanggil `awardOnChainXp('awardSocialXp', [wallet_address, xp])` tepat setelah validasi signature sukses, lalu lanjutkan ke `insertClaimAndIncrementXp` sebagai backup.

### 🔴 2. Core Data: On-Chain XP untuk UGC Campaigns
- **Masalah**: Klaim kampanye UGC murni mengubah DB.
- **Solusi**: Refaktor `handleClaimUgcCampaign` di `_tasks-bundle.ts` untuk memanggil `awardOnChainXp('awardUgcTaskXp', [wallet_address, totalXp])` setelah seluruh sub-tugas tervalidasi selesai.

### ⚠️ 3. State Integrity: Eliminasi Gacha Tier Drift
- **Masalah**: Hadiah "Bronze Upgrade" memicu database-only tier upgrade. SBT on-chain tidak ter-mint.
- **Solusi**: Ganti hadiah "Bronze Upgrade" pada Gacha Wheel (`handleSpinGacha`) dengan **hadiah alternatif (misal: +150 XP atau +5 Tickets)**. Ini karena minting SBT bersifat sequential, non-transferable, dan harus di-mint secara native oleh user sendiri menggunakan wallet mereka di contract DailyAppV16. Mengubah tier secara langsung di database memicu ketidaksinkronan permanen dengan SBT.

### 🟡 4. UI/UX: Optimistic Sync & Loader Stability
- **Masalah**: Setelah klaim sukses di frontend, refetch database terkadang mendahului update on-chain/DB sync.
- **Solusi**: Tambahkan penundaan refetch yang aman (1.5s - 2s) dan manfaatkan state optimistis `setUserClaims` di frontend untuk menyembunyikan tugas secara instan demi kelancaran UX.

---

## 📈 5. PROPOSED CODE MODIFICATIONS

### A. Modifikasi `_tasks-bundle.ts`

#### 1. Pada `handleClaim`:
```typescript
// Tambahkan panggilan awardOnChainXp sebelum/setelah validasi
const onChainTx = await awardOnChainXp('awardSocialXp', [wallet_address.toLowerCase() as `0x${string}`, BigInt(xp)]);
// Masukkan txHash ke logActivity jika ada
```

#### 2. Pada `handleClaimUgcCampaign`:
```typescript
// Tambahkan panggilan awardOnChainXp untuk UGC XP
const onChainTx = await awardOnChainXp('awardUgcTaskXp', [wallet_address.toLowerCase() as `0x${string}`, BigInt(totalXp)]);
```

#### 3. Pada `handleSpinGacha` (Gacha prizes refactor):
```typescript
const segmentPrizes = [
    { text: '+50 XP', category: 'XP', amount: 50 },
    { text: '+100 XP', category: 'XP', amount: 100 },
    { text: 'Double Streak', category: 'STREAK', amount: 1 },
    { text: '+150 XP Bonus', category: 'XP', amount: 150 }, // Menggantikan Tier Upgrade untuk mencegah drift SBT
    { text: '+3 Tickets', category: 'TICKET', amount: 3 },
    { text: 'Bonus Multiplier', category: 'XP', amount: 150 }
];
```

---

*Report compiled by Antigravity | Lead Senior Staff Engineer & QA | Ecosystem Protocol v3.64.36*
