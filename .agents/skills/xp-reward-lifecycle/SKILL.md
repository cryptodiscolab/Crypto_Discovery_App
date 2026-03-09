# XP & Reward Lifecycle Manager Skill

Skill ini menangani logika inti pemberian reward dan sinkronisasi XP dengan kepatuhan mutlak pada **.cursorrules (Master Architect Protocol)**.

## 📜 Master Architect Protocol Alignment

### 1. Staff Engineer Mode (Staff-Only)
- **Logika Sync**: Jelaskan alur sinkronisasi XP (Frontend -> Backend -> DB) dalam maksimal 3 poin bullet.
- **Dev Plan Mandatory**: Sebelum mengubah logika perhitungan `xpDelta`, sajikan "Development Plan".
- **Zero Trust Enforcement**: Semua update XP WAJIB melalui backend API.

### 2. Verified Infrastructure Reference (DO NOT GUESS)
| Key | Value |
|---|---|
| DailyApp V12 (Latest) | `0xfc12f4FEFf825860c5145680bde38BF222cC669A` |
| MasterX V2 (Latest) | `0x78a566a11AcDA14b2A4F776227f61097C7381C84` |

### 3. Bahasa & Komunikasi
- **Technical/Chat**: **Bahasa Indonesia**.
- **User Facing/UI**: **Bahasa Inggris (English)**.

## 🏆 Kompetensi Inti

### 1. Zero-Trust XP Syncing
- **Mechanism**: XP TIDAK diperbolehkan diupdate langsung dari frontend.
- **Workflow**: 
    1. User transaksi on-chain.
    2. Frontend menangkap event sukses & sign message.
    3. Backend API `/api/sync/xp` memverifikasi signature & data on-chain.
    4. Backend menulis ke Supabase menggunakan `SERVICE_ROLE_KEY`.

### 2. The Delta XP Calculation Pitfall (CRITICAL)
- **Apples-to-Apples Rule**: Poin on-chain HARUS dibandingkan HANYA dengan poin on-chain yang sudah tercatat di DB (`SUM(xp_earned)` dari platform 'blockchain').
- ** xpDelta = onChainXP - sumDBBlockchainXP**.

### 4. Underdog Catch-Up Bonus
- **Logic**: Bronze & Silver tiers get +10% XP if `lastActivityTime` is within 48h.
- **Verification**: Always verify the user's `lastActivity` timestamp from the contract before claiming success in the UI.

### 5. Real-Time SBT Sync
- **Trigger**: Minting or Upgrading an SBT MUST trigger an immediate database update (via `user-bundle.js`) to set the new tier in `user_profiles`.

## 📋 Checklist Reward & XP
- [ ] Apakah operasi tulis DB dilakukan di Server-Side API?
- [ ] Apakah `wallet_address` sudah di-lowercase sebelum query?
- [ ] Apakah `xpDelta` menggunakan metode Apples-to-Apples?
- [ ] Apakah ABI diimpor via Proxy dari `contracts.js`?
- [ ] Apakah `npm run build` berhasil?
- [ ] Apakah chat teknis menggunakan Bahasa Indonesia?

## 🚨 Pantangan
- Menggunakan `supabase.from('profiles').update()` di sisi client.
- Mengabaikan validasi address penanda tangan di backend.
- **Mengimpor fungsi ethers.js dari package viem.**
- Mencampur Bahasa Indonesia ke dalam elemen UI.
