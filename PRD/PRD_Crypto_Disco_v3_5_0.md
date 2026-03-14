# 🪩 Product Requirements Document: Crypto Disco Application
**Version: 3.5.0 — Zero-Hardcode Housecleaning & Universal API Edition**
**Tanggal**: 2026-03-14
**Status**: Active — Base Sepolia (Testnet) ✅ | Base Mainnet (Launch Ready)
**Author**: Antigravity (Nexus Orchestrator)

> **Catatan**: Dokumen ini adalah sumber kebenaran tunggal untuk Crypto Disco Ekosistem. Menambah standardisasi `PROFILE_LIMITS`, `STREAK_WINDOW`, dan normalisasi universal pada seluruh API Bundle.

---

## 📋 Changelog

| Versi | Tanggal | Ringkasan |
|---|---|---|
| **3.5.0** | 2026-03-14 | **Zero-Hardcode Housecleaning**: Standardisasi `PROFILE_LIMITS` (Name, Bio, Username, Avatar size) dan `STREAK_WINDOW` via environment variables. **Universal API Normalization**: Konsolidasi inisialisasi Supabase Admin dan sanitasi `.trim().toLowerCase()` pada `user-bundle`, `campaigns`, `notify`, dan `is-admin`. |
| 3.4.0 | 2026-03-14 | **Farcaster Immersion**: Frame 2.0 theme sync, safe area handling. **Movement 2.0**: Real-time Hype Feed from DB logs. **Underdog Bonus**: +10% XP for Bronze/Silver. |
| 3.3.3 | 2026-03-13 | Social Reliability Upgrade: Iterative pagination (500 items). |

---

## 1. Visi & Ekonomi Ekosistem
*(Sama seperti v3.4.0)*

## 2. Arsitektur & Technical Stack
*(Sama seperti v3.4.0)*

### 2.2 Smart Contract Addresses
*(Sama seperti v3.4.0 - Verifikasi di Section 43/45)*

---

## 3. API Bundles & Routing (Vercel Core)

API bertindak sebagai **"Trust Bridge"** antara Blockchain dan UI. Semua endpoint wajib EIP-191 Signature Verification & ENV-SANITY normalization.

| Bundle | Fungsi Utama | Status |
|---|---|---|
| **`user-bundle.js`** | Login sync, XP sync, Identity linking, Profile Update (Limit Enforced) | ✅ Normalized |
| **`tasks-bundle.js`** | Social task verification, XP granting | ✅ Audited |
| **`campaigns.js`** | Campaign joining & validation | ✅ Normalized |
| **`notify.js`** | Push notifications & social signals | ✅ Normalized |
| **`is-admin.js`** | Multi-source admin verification | ✅ Normalized |

---

## 4. Zero-Hardcode Configuration (v3.5.0)

Semua parameter sistem wajib diambil dari `process.env` atau database.

### 4.1 Profile & Character Limits (`PROFILE_LIMITS`)
| Key | Default | Env Var Source |
|---|---|---|
| **Max Name Length** | 50 | `MAX_NAME_LEN` |
| **Max Bio Length** | 160 | `MAX_BIO_LEN` |
| **Max Username Length** | 30 | `MAX_USERNAME_LEN` |
| **Max Avatar Size** | 1,048,576 bytes | `MAX_AVATAR_BYTES` |

### 4.2 Streak Window (`STREAK_WINDOW`)
| Key | Default | Env Var Source |
|---|---|---|
| **Min Claim Gap** | 20 hours | `STREAK_WINDOW_MIN_HOURS` |
| **Max Claim Gap** | 48 hours | `STREAK_WINDOW_MAX_HOURS` |

---

## 6. Security & Audit Mandates

### 6.1 ENV-SANITY Mandate (v3.5.0 — ENFORCED)
- **LAW**: Semua akses `process.env` di API wajib menggunakan `.trim()` di level inisialisasi.
- **NORMALIZATION**: Wallet address wajib menggunakan `.trim().toLowerCase()` sebelum query database atau validasi signature.

---

*PRD Version: 3.5.0 — Zero-Hardcode Housecleaning & Universal API Edition*
*Berdasarkan protokol Full-Stack Sync. Profile Limits Enforced. Universal API Normalized. Zero Hardcode Housecleaned.*
