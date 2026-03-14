# 🪩 Product Requirements Document: Crypto Disco Application
**Version: 3.6.0 — Atomic Script Organization & Orchestration Readiness**
**Tanggal**: 2026-03-14
**Status**: Active — Base Sepolia (Testnet) ✅ | Base Mainnet (Launch Ready)
**Author**: Antigravity (Nexus Orchestrator)

> **Catatan**: Dokumen ini adalah sumber kebenaran tunggal untuk Crypto Disco Ekosistem. Memperkenalkan standardisasi **Atomic Script Organization** untuk skalabilitas dev-ops dan integrasi n8n.

---

## 📋 Changelog

| Versi | Tanggal | Ringkasan |
|---|---|---|
| **3.6.0** | 2026-03-14 | **Atomic Script Organization**: Reorganisasi 100+ script ke dalam kategori `audits/`, `deployments/`, `sync/`, `debug/`, dan `_archive/`. Perbaikan dependensi internal dan update protokol `.cursorrules`. Evaluasi n8n Atom 3.0 untuk orkestrasi visual. |
| 3.5.0 | 2026-03-14 | **Zero-Hardcode Housecleaning**: Standardisasi `PROFILE_LIMITS` (Name, Bio, Username, Avatar size) dan `STREAK_WINDOW` via environment variables. **Universal API Normalization**: Konsolidasi inisialisasi Supabase Admin. |
| 3.4.0 | 2026-03-14 | **Farcaster Immersion**: Frame 2.0 theme sync. **Movement 2.0**: Real-time Hype Feed. **Underdog Bonus**: +10% XP for Bronze/Silver. |

---

## 2. Arsitektur & Technical Stack

### 2.3 DevOps & Automation (v3.6.0)

Ecosystem menggunakan pola **"Hybrid Atomic Automation"**:
- **Atoms (Scripts)**: Logika fungsional tetap berada di dalam repository dalam bentuk script modular di folder `scripts/`.
- **Categories**:
    - `audits/`: Verifikasi integritas (Ecosystem Sync, DB Check).
    - `deployments/`: Lifecycle Smart Contract.
    - `sync/`: Data & Environment parity.
    - `debug/`: Maintenance & local tools.
- **Orchestration**: n8n (atau manual CLI) bertindak sebagai konduktor yang memanggil "Atoms" ini secara berurutan.

---

## 6. Security & Audit Mandates

### 6.2 Atomic Script Hygiene (v3.6.0)
- **LAW**: Dilarang meletakkan script baru langsung di root `scripts/`. Wajib dimasukkan ke sub-folder kategori yang sesuai.
- **RELATIVE PATHS**: Semua script wajib menggunakan `path.join(__dirname, ...)` untuk menjamin portabilitas antar kategori folder.

---

*PRD Version: 3.6.0 — Atomic Script Organization & Orchestration Readiness*
*Berdasarkan protokol Full-Stack Sync. Scripts Organized. Orchestration Ready. Legacy Archived.*
