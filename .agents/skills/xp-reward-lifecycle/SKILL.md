# XP & Reward Lifecycle Manager Skill

Skill ini menangani logika inti pemberian reward dan sinkronisasi XP dengan kepatuhan mutlak pada **.cursorrules (Master Architect Protocol)**.

## 📜 Master Architect Protocol Alignment

### 1. Staff Engineer Mode (Staff-Only)
- **Logika Sync**: Jelaskan alur sinkronisasi XP (Frontend -> Backend -> DB) dalam maksimal 3 poin bullet.
- **Dev Plan Mandatory**: Sebelum mengubah logika perhitungan `xpDelta`, sajikan "Development Plan".
- **Zero Trust Enforcement**: Semua update XP WAJIB melalui backend API.
- **Zero-Hardcode Mandate (Lurah Protocol)**: Prohibit use of static values for XP, Fees, and Rewards. Every system-level parameter must be dynamic. Strictly audit all `api/` and `src/` files for hardcoded reward strings or pricing.

### 2. Verified Infrastructure Reference (v3.2)
| Key | Value |
|---|---|
| DailyApp (Tasks) | `0x7A85f4150823d79ff51982c39C0b09048EA6cba3` |
| MasterX (XP) | `0x474126AD2E111d4286d75C598bCf1B1e1461E71A` |

### 3. Bahasa & Komunikasi
- **Technical/Chat**: **Bahasa Indonesia**.
- **User Facing/UI**: **Bahasa Inggris (English)**.

## 🏆 Kompetensi Inti

### 1. Zero-Trust XP Syncing (v3.2)
- **Mechanism**: XP TIDAK diperbolehkan diupdate langsung dari frontend.
- **Workflow**: 
    1. User transaksi on-chain.
    2. Frontend panggil `/api/tasks-bundle?action=social-verify` (untuk klaim).
    3. Backend memverifikasi `txHash` dan data on-chain.
    4. Backend menginsert record ke `user_task_claims`.
    5. **DB Trigger (`trg_sync_xp_on_claim`)** secara otomatis menghitung ulang `total_xp` di `user_profiles`.

### 2. The Multiplied Raffle XP (NEW v3.2)
- **Raffle Ticket Logic**: XP untuk `raffle_buy` **HARUS** dikalikan dengan kuantitas tiket di backend sebelum diinsert ke `user_task_claims`.
- **Award Values (v3.2)**: 
    - `raffle_create`: 500 XP.
    - `raffle_buy`: 100 XP per unit.
    - `raffle_win`: 1000 XP.

### 3. Dynamic Tier Percentile (v3.2)
- **Logic**: Tier (Diamond-Bronze) tidak lagi statis. Tier dihitung di SQL View `v_user_full_profile` menggunakan `PERCENT_RANK()` terhadap `total_xp`.
- **Diamond/Platinum Gating**: Selalu gunakan View ini untuk validasi akses fitur eksklusif.

### 4. Underdog Catch-Up Bonus
- **Logic**: Bronze & Silver tiers get +10% XP if `lastActivityTime` is within 48h (Blockchain source).

## 📋 Checklist Reward & XP (v3.2)
- [x] Apakah `user_task_claims` menjadi target utama penulisan (bukan set `total_xp` manual)?
- [x] Apakah XP pembelian tiket sudah dikalikan dengan jumlah tiket?
- [x] Apakah `v_user_full_profile` sudah digunakan untuk pengecekan Tier/Rank?
- [x] Apakah `npm run build` berhasil?

## 🚨 Pantangan
- Mengupdate kolom `total_xp` secara manual di kode — biarkan DB Trigger yang menangani.
- Mengabaikan `raffle_wins` counter — panggil RPC `fn_increment_raffle_wins`.
- Menggunakan `profiles` table (deprecated).
