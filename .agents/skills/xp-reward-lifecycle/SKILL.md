# XP & Reward Lifecycle Manager Skill

Skill ini menangani logika inti pemberian reward dan sinkronisasi XP dengan kepatuhan mutlak pada **.cursorrules (Master Architect Protocol)**.

## 📜 Master Architect Protocol Alignment

### 1. Staff Engineer Mode (Staff-Only)
- **Logika Sync**: Jelaskan alur sinkronisasi XP (Frontend -> Backend -> DB) dalam maksimal 3 poin bullet.
- **Dev Plan Mandatory**: Sebelum mengubah logika perhitungan `xpDelta`, sajikan "Development Plan".
- **Zero Trust Enforcement**: Semua update XP WAJIB melalui backend API.
- **Surgical Fix Mandate**: Dilarang menghapus seluruh kode saat perbaikan. Hanya ganti baris yang error saja.
- **Zero-Hardcode Mandate (Lurah Protocol)**: Prohibit use of static values for XP, Fees, and Rewards. Every system-level parameter must be dynamic. Strictly audit all `api/` and `src/` files for hardcoded reward strings or pricing.

### 2. Verified Infrastructure Reference (v3.38.25)
| Key | Value |
|---|---|
| DailyApp (Tasks) | `0xfA75627c1A5516e2Bc7d1c75FA31fF05Cc2f8721` |
| MasterX (XP) | `0xa4E3091B717DfB8532219C93A0C170f8f2D7aec3` |

### 3. Bahasa & Komunikasi
- **Technical/Chat**: **Bahasa Indonesia**.
- **User Facing/UI**: **Bahasa Inggris (English)**.

## 🏆 Kompetensi Inti

### 1. Verification-First XP Sync (v3.38.25) - MANDATORY
- **Verification-First Mandate**: Website MUST capture `tx_hash` from on-chain transactions and pass it to the backend.
- **Backend Responsibility**: Backend MUST verify the `tx_hash` via RPC and update `user_profiles.total_xp` EXPLICITLY.
- **NO Passive Triggers**: Do NOT rely on DB triggers for XP recalculation (deprecated and deleted in v3.38.25).
- **Workflow**: 
    1. User performs an on-chain transaction.
    2. Frontend sends `tx_hash` to `/api/user/xp` or similar.
    3. Backend verifies the hash with the blockchain.
    4. Backend updates `user_profiles.total_xp` and logs the claim.
    5. User profile reflects change instantly, bypassing indexing lag.

### 2. The Multiplied Raffle XP (v3.26.0)
- **Raffle Ticket Logic**: XP untuk `raffle_buy` **HARUS** dikalikan dengan kuantitas tiket di backend sebelum diinsert ke `user_task_claims`.
- **Award Values (v3.25.0)**: 
    - `raffle_create`: 500 XP.
    - `raffle_buy`: 100 XP per unit.
    - `raffle_win`: 1000 XP.

### 3. Dynamic Tier Percentile & SBT Indexing (v3.26.0)
- **SBT Threshold Precision (v3.26.0)**: ALWAYS use `min_xp` from `sbt_thresholds`. **PROHIBITED** to use `xp_required`.
- **View Mirror Sync (v3.26.0)**: Ensure `v_user_full_profile` SQL View is updated whenever columns are added to the XP source tables.
- **Logic**: Tier (Diamond-Bronze) tidak lagi statis. Tier dihitung di SQL View `v_user_full_profile` menggunakan `PERCENT_RANK()` terhadap `total_xp`.
- **Diamond/Platinum Gating**: Selalu gunakan View ini untuk validasi akses fitur eksklusif.
- **Platinum Support**: v3.25.0 adds full indexing support for Platinum tier rewards.

### 4. Underdog Catch-Up Bonus
- **Logic**: Bronze & Silver tiers get +10% XP if `lastActivityTime` is within 48h (Blockchain source).

- [x] Apakah `tx_hash` dikirim dari frontend untuk verifikasi instan?
- [x] Apakah `total_xp` diupdate secara eksplisit oleh backend (bukan trigger)?
- [x] Apakah `v_user_full_profile` sudah digunakan untuk pengecekan Tier/Rank?
- [x] Apakah `npm run build` berhasil?
- [ ] **Atomic Script Enforced**: Apakah script operasional sudah berada di folder kategori yang benar di `scripts/`?

## 🚨 Pantangan
- Mengandalkan DB Trigger untuk sinkronisasi XP — WAJIB update eksplisit via backend.
- Lupa mempassing `tx_hash` dari frontend ke backend saat klaim berhasil.
- Mengabaikan `raffle_wins` counter — panggil RPC `fn_increment_raffle_wins`.
- Menggunakan `profiles` table (deprecated).
