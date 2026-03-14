# 🪩 Product Requirements Document: Crypto Disco Application
**Version: 3.7.0 — Admin Token & Tier Hardening (Zero-Hardcode)**
**Tanggal**: 2026-03-15
**Status**: Active — Base Sepolia (Testnet) ✅ | Base Mainnet (Launch Ready)
**Author**: Antigravity (Nexus Orchestrator)

> **Catatan**: Dokumen ini adalah sumber kebenaran tunggal untuk Crypto Disco Ekosistem. Memperkenalkan **Admin Token Management** dan **Dynamic Tier Segmenting** untuk menghilangkan hardcoded logic pada lapisan identitas dan ekonomi.

---

## 📋 Changelog

| Versi | Tanggal | Ringkasan |
|---|---|---|
| **3.7.0** | 2026-03-15 | **Admin Token Management**: DASHBOARD UI untuk whitelist token (Contract + DB Sync). **Tier Hardening**: Dinamis rank (Rookie/Bronze/Gold/Platinum/Diamond) via DB percentiles. **Multi-Chain Whitelist**: Support composite key `(chain_id, address)`. |
| 3.6.0 | 2026-03-14 | **Atomic Script Organization**: Reorganisasi script ke kategori `audits/`, `deployments/`, dsb. |
| 3.5.0 | 2026-03-14 | **Zero-Hardcode Housecleaning**: Standardisasi environment variables. |

---

## 2. Arsitektur & Technical Stack

### 2.4 Data Integrity & Zero-Hardcode (v3.7.0)
Ecosystem mengadopsi prinsip **"Database-Driven Logic"**:
- **Allowed Tokens**: Daftar token yang diterima dikelola secara dinamis di tabel `allowed_tokens`. Tidak ada alamat token yang di-hardcode di backend.
- **Dynamic Tiers**: Rank user (Diamond, Platinum, dsb.) dihitung berdasarkan persentil dinamis di `system_settings` dan mapping level di `sbt_thresholds`.
- **Admin Orchestration**: Setiap perubahan state on-chain via Admin Dashboard wajib disinkronkan langsung ke database untuk menjamin konsistensi UI.

---

## 4. Fitur & Fungsionalitas

### 4.5 Admin Dashboard Suite (v3.7.0)
- **Token Whitelist Hub**: UI untuk menambah/menghapus token antar rantai (Multi-Chain).
- **Economy Analytics**: Tracking gross revenue dan net profit (rake-adjusted) secara real-time.
- **Manual Tier Override**: Kemampuan admin untuk mengubah level user secara manual (Priority Mode).

---

## 6. Security & Audit Mandates

### 6.3 Admin Sync Mandate (v3.7.0)
- **LAW**: Setiap aksi admin yang mengubah state aset/konfigurasi (Whitelist Token, SBT Upgrade) WAJIB melakukan signed request ke Backend Bundle untuk sinkronisasi Database SEGERA setelah konfirmasi transaksi on-chain.

---

*PRD Version: 3.7.0 — Admin Token & Tier Hardening (Zero-Hardcode)*
*Berdasarkan protokol Zero-Hardcode. Admin Empowered. Tiers Dynamic.*
