# 🪩 Product Requirements Document: Crypto Disco Application
**Version: 3.4.0 — Farcaster Immersion & Movement 2.0 Edition**
**Tanggal**: 2026-03-14
**Status**: Active — Base Sepolia (Testnet) ✅ | Base Mainnet (Launch Ready)
**Author**: Antigravity (Nexus Orchestrator)

> **Catatan**: Dokumen ini adalah sumber kebenaran tunggal untuk Crypto Disco Ekosistem. Menambah dukungan Farcaster Frame 2.0 Immersion, Real-Time Hype Feed (Movement 2.0), dan Underdog Bonus.

---

## 📋 Changelog

| Versi | Tanggal | Ringkasan |
|---|---|---|
| **3.4.0** | 2026-03-14 | **Farcaster Immersion**: Frame 2.0 theme sync, safe area handling, & User Summary Bar. **Movement 2.0**: Real-time Hype Feed from DB logs. **Underdog Bonus**: +10% XP for Bronze/Silver. **Sentinel Hardening**: ENV-SANITY Mandate & A-D-R-R-E cycle. |
| 3.3.3 | 2026-03-13 | Social Reliability Upgrade: Iterative pagination (500 items). UX Fix: Interactive "Link Google/X" buttons on Profile Page. |
| 3.3 | 2026-03-13 | Unified master PRD. Audit-First Protocol, Zero-Hardcode Mandate, Multi-Model Agent Architecture. |
| 3.2 | 2026-03-12 | UGC Raffle metadata, XP multi-level awarding, DB Security Invoker, Admin Dashboard controls. |

---

## 1. Visi & Ekonomi Ekosistem

Crypto Disco adalah ekosistem gamifikasi Web3 di jaringan **Base** yang dirancang untuk retensi user harian melalui mekanisme Gacha, Misi Sosial, dan Ekonomi Sponsor. Sistem ini mengadopsi model **Revenue-Backing**, di mana pendapatan protokol (dari Raffle & Sponsorship) dibagikan kembali kepada pemegang **Soulbound Token (SBT)**.

### Core Value Proposition
- **Farcaster Native**: 100% immersive pengalaman Frame 2.0 (Theme, Layout, Safe Area).
- **Social Proof**: Real-time activity feed (Hype Feed) berbasis aksi nyata user di ekosistem.
- **Economic Loop**: Platform revenues (fees/sponsorships) are shared back with the community via SBT tiers.

---

## 2. Arsitektur & Technical Stack

### 2.1 Technical Architecture (Hybrid Decentralized)
- **Frontend**: React + Vite + Wagmi + RainbowKit + Viem (Web3).
- **Backend**: Vercel Serverless Functions (Node.js) — **Strict limit: < 12 functions**, bundled ke `*-bundle.js`.
- **Database**: Supabase (PostgreSQL) — Indexer & Social State.
- **SDK**: `@farcaster/frame-sdk` untuk Farcaster Frame 2.0 integration.

### 2.2 Smart Contract Addresses

| Contract | Base Mainnet (8453) | Base Sepolia (84532) | Env Key |
|---|---|---|---|
| **DailyApp V13** | `0x87a3d1203Bf20E7dF5659A819ED79a67b236F571` | `0x7A85f4150823d79ff51982c39C0b09048EA6cba3` | `VITE_V12_CONTRACT_ADDRESS` |
| **MasterX (XP)** | `[RESERVED]` | `0x474126AD2E111d4286d75C598bCf1B1e1461E71A` | `VITE_MASTER_X_ADDRESS` |
| **Raffle V2** | `[RESERVED]` | `0x92E8e19f77947E25664Ce42Ec9C4AD0b161Ed8D0` | `VITE_RAFFLE_ADDRESS` |

---

## 3. API Bundles & Routing (Vercel Core)

API bertindak sebagai **"Trust Bridge"** antara Blockchain dan UI. Semua endpoint wajib EIP-191 Signature Verification.

| Bundle | Fungsi Utama |
|---|---|
| **`user-bundle.js`** | Login sync, XP sync, Identity linking logs, Underdog Bonus logic |
| **`tasks-bundle.js`** | Social task verification, XP granting |

---

## 4. Database Configuration & Schema

### 4.1 Tabel Inti
| Tabel | Fungsi |
|---|---|
| **`user_profiles`** | Master data user (XP, Tier, FID, Wallet, `manual_xp_bonus`) |
| **`user_activity_logs`** | Movement 2.0 source: XP, SOCIAL, IDENTITY, TIER_UP events |
| **`system_settings`** | **Zero-Hardcode source**: `underdog_bonus_multiplier_bp`, `tier_pool_weights`, dst |

### 4.2 Integrated Ecosystem Flow (Movement 2.0)
1. **User Action**: Linking X/Google atau Claim XP.
2. **Backend**: Log activity ke `user_activity_logs` dengan category spesifik.
3. **Frontend**: `HypeFeed.jsx` melakukan real-time fetch + join profiles untuk display social proof yang otentik.

---

## 5. Frontend Pages & Features

### 5.1 Farcaster Frame 2.0 Immersion
| Fitur | Deskripsi |
|---|---|
| **Theme Sync** | App otomatis berubah antara Light/Dark mode mengikuti settingan Warpcast. |
| **Safe Area** | Dynamic padding adjustment menghindari elemen tertutup status bar atau bottom gesture bar. |
| **Layout Optimization** | Menghilangkan Header standar di dalam Frame 2.0 untuk native feel & memperluas viewport. |
| **User Summary Bar** | Sticky dashboard di HomePage yang menampilkan Avatar, XP, dan Wallet saat di dalam Frame. |

### 5.2 Movement 2.0: Real-Time Hype Feed
- **Authentic Feed**: Mengganti teks random dengan data log asli dari database.
- **Support Categories**: SOCIAL (Link identity), IDENTITY (Avatar update), TIER_UP, & XP_CLAIM.
- **UI Reflection**: Notifikasi "Hype" di landing page yang memperkuat urgensi & komunitas.

### 5.3 Economic Features
- **Underdog Bonus (v3.4)**: +10% XP multiplier untuk Bronze & Silver tier guna mendorong engagement user awal. Berbasis `system_settings`.
- **Daily Claim**: 100 XP/hari (config via `point_settings`).
- **Revenue Share**: Dividen 30% revenue protokol, tier-weighted.

---

## 6. Security & Audit Mandates

### 6.1 ENV-SANITY Mandate (v3.4 — CRITICAL)
- **LAW**: Semua akses `process.env` wajib menggunakan `.trim()` di level initialization/bundle entry.
- **PURPOSE**: Mencegah "Silent Corruption" akibat karakter `\r\n` atau double-quotes dari Vercel/Local env sync.

### 6.2 NEXUS EVOLUTION (A-D-R-R-E)
- Semua Agent AI wajib mengikuti siklus: **Analyze** -> **Detect** -> **Record** -> **Resolve** -> **Evolve**.
- Setiap kesalahan wajib di-record root-cause-nya untuk di-evolusi ke dalam `.cursorrules` atau `SKILL.md`.

---

## 7. Tiering System (Updated v3.4)

| Tier | Level | XP Threshold | Multiplier | Dividen Weight | Bonus |
|---|---|---|---|---|---|
| **Bronze** | 1 | 500 XP | 1.10x | ×1 | **Underdog (+10%)** |
| **Silver** | 2 | 2,000 XP | 1.20x | ×2 | **Underdog (+10%)** |
| **Gold** | 3 | 5,000 XP | 1.30x | ×3 | — |
| **Platinum** | 4 | Top 5% | 1.40x | ×5 | — |
| **Diamond** | 5 | Top 1% | 1.50x | ×10 | — |

---

## 8. Ecosystem Verification Status

| Module | Status | Core Logic |
|---|---|---|
| **Farcaster Immersion** | 🟢 100% | Theme Sync, Safe Area, Frame Layout Optimized |
| **Hype Feed (v2)** | 🟢 100% | Real-time logs fetch from DB |
| **Underdog Bonus** | 🟢 100% | Configurable +10% XP for low tiers |
| **ENV-SANITY** | 🟢 100% | Strict trim mandate on all serverless entries |
| **Social Verification**| 🟢 100% | Iterative pagination (500 items) |

---

*PRD Version: 3.4.0 — Farcaster Immersion & Movement 2.0 Edition*
*Berdasarkan protokol Full-Stack Sync. Immersion 100%. Social Proof Real-Time. Zero Hardcode. Sentinel Evaluated.*
