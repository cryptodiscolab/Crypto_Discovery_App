# XP & Reward Lifecycle Manager Skill

Skill ini menangani logika inti pemberian reward dan sinkronisasi XP dengan kepatuhan mutlak pada **.cursorrules (Master Architect Protocol)**.

## 📜 Master Architect Protocol Alignment

### 1. Staff Engineer Mode (Staff-Only)
- **Logika Sync**: Jelaskan alur sinkronisasi XP (Frontend -> Backend -> DB) dalam maksimal 3 poin bullet.
- **Dev Plan Mandatory**: Sebelum mengubah logika perhitungan `xpDelta`, sajikan "Development Plan".
- **Zero Trust Enforcement**: Semua update XP WAJIB melalui backend API.
- **Surgical Fix Mandate**: Dilarang menghapus seluruh kode saat perbaikan. Hanya ganti baris yang error saja.
- **Zero-Hardcode Mandate (Lurah Protocol)**: Prohibit use of static values for XP, Fees, and Rewards. Every system-level parameter must be dynamic. Strictly audit all `api/` and `src/` files for hardcoded reward strings or pricing.

### 2. Verified Infrastructure Reference (v3.41.2)
| Key | Value |
|---|---|
| DailyApp (Tasks) | `0x369aBcD44d3D510f4a20788BBa6F47C99e57d267` |
| MasterX (XP) | `0x980770dAcE8f13E10632D3EC1410FAA4c707076c` |
| PRD Status | `v3.41.2 (Anti-Whale Economy LOCKED)` |

### 3. Bahasa & Komunikasi
- **Technical/Chat**: **Bahasa Indonesia**.
- **User Facing/UI**: **Bahasa Inggris (English)**.

## 🏆 Kompetensi Inti

### 1. Verification-First XP Sync (v3.41.0) - MANDATORY
- **Verification-First Mandate**: Website MUST capture `tx_hash` from on-chain transactions and pass it to the backend.
- **Backend Responsibility**: Backend MUST verify the `tx_hash` via RPC and update `user_profiles.total_xp` EXPLICITLY.
- **NO Passive Triggers**: Do NOT rely on DB triggers for XP recalculation (deprecated and deleted in v3.41.0).
- **Workflow**: 
    1. User performs an on-chain transaction.
    2. Frontend sends `tx_hash` to `/api/user/xp` or similar.
    3. Backend verifies the hash with the blockchain.
    4. Backend updates `user_profiles.total_xp` and logs the claim.
    5. User profile reflects change instantly, bypassing indexing lag.

### 2. Atomic Hybrid Scaling (v3.41.2) - MANDATORY
- **Formula**: `Final XP = MAX(5, ROUND(Base * GlobalMult * IndivMult * Underdog))`
- **Global Mult**: `1.5 / (1 + log10(Total_Users / 1000 + 1))` (Macro stability).
- **Indiv Mult**: `MAX(0.5, 1.0 - (User_XP / 20000))` (Micro catch-up).
- **Underdog Bonus**: +10% constant for Tier 0-2 (Bronze/Silver).
- **Zero-Hardcode Rule**: Prohibit manual multipliers in `tasks-bundle.js` or `user-bundle.js`. Send raw `points_value` to `fn_increment_xp`.

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
- [ ] **📈 ANTI-WHALE XP SCALING AUDIT (v3.41.2)**: Verifikasi bahwa XP scaling mengacu pada `fn_increment_xp` di database. PROHIBIT manual scaling di backend. Pastikan `p_amount` dikirim mentah (raw). **WAJIB.**
- [ ] **🧪 RPC TRUTHINESS & EVIDENCE AUDIT (v3.40.9)**: Apakah skrip verifikasi menggunakan `code && code !== '0x'`? Apakah laporan menyertakan bukti bytecode literal (10 karakter awal)? **WAJIB.**
- [ ] **✨ NATIVE+ UI HARDENING AUDIT**: Apakah seluruh elemen UI baru (labels, metadata, handles) sudah menggunakan `text-[11px] font-black uppercase tracking-widest`? Apakah legacy sizes (`text-xs`, etc.) sudah dibersihkan? **WAJIB.**

### Section 4.1: THE NATIVE+ BALANCED DESIGN STANDARD (v3.41.0)
- **Labels**: `text-[11px] font-black uppercase tracking-widest` (`.label-native`).
- **Content**: `text-[13px] font-medium leading-relaxed` (`.content-native`).
- **Values**: `text-[12px] font-bold tracking-wide` (`.value-native`).
- **Consistency**: Purge `text-xs`, `text-sm`, `text-[10px]`.

## 🚨 Pantangan
- Mengandalkan DB Trigger untuk sinkronisasi XP — WAJIB update eksplisit via backend.
- Lupa mempassing `tx_hash` dari frontend ke backend saat klaim berhasil.
- Mengabaikan `raffle_wins` counter — panggil RPC `fn_increment_raffle_wins`.
- Menggunakan `profiles` table (deprecated).
