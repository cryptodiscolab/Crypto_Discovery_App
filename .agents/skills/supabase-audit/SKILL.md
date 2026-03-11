name: Supabase Database Audit & Architecture Manager
description: Protokol khusus untuk melakukan audit struktur, kebijakan RLS, integritas data, dan manajemen arsitektur multi-schema (public & auth) di Supabase.
---

# Supabase Database Audit & Master Protocol Architect

Skill ini menetapkan protokol wajib bagi Agent untuk memantau, memvalidasi, dan mengamankan infrastruktur database Supabase dengan menjadikan **.cursorrules (Master Architect Protocol)** sebagai panduan utama.

## 📜 Otoritas Data: Master Architect Protocol (.cursorrules)

### 1. Kepatuhan Mutlak
Audit skema database, kebijakan RLS, dan fungsi SQL wajib mematuhi aturan keamanan yang tertuang dalam `.cursorrules`.

### 2. Staff Engineer Mode (Staff-Only)
- **Tactical & Fast**: Jelaskan dampak perubahan skema dalam maksimal 3 poin bullet.
- **Development Plan Mandatory**: Setiap migrasi skema atau perubahan RLS WAJIB diawali dengan "Development Plan".
- **Zero Trust Enforcement**: Semua mutasi data WAJIB melalui API backend dengan verifikasi signature.

### 3. Bahasa & Komunikasi
- **Technical/Diskusi**: **Bahasa Indonesia**.
- **Schema/Labels/Data**: **Bahasa Inggris (English)**.

## 🏛️ Verified Infrastructure Reference (DO NOT GUESS)
| Key | Value |
|---|---|
| Supabase URL | `https://rbgzwhsdqnhwrwimjjfm.supabase.co` |
| Master Admin 1 | `0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B` |
| Master Admin 2 | `0x52260c30697674a7C837FEB2af21bBf3606795C8` |

## 🛡️ Kompetensi Inti

### 1. Audit Row Level Security (RLS)
- **Status Wajib**: Setiap tabel di skema `public` WAJIB memiliki RLS aktif.
- **Zero Client Write**: **DILARANG** melakukan `INSERT/UPDATE/DELETE` langsung dari client. Harus melalui verifikasi signature di Backend API.

### 2. Database Function Isolation
- **Search Path Isolation**: Setiap fungsi SQL (`CREATE FUNCTION`) WAJIB memiliki deklarasi `SET search_path = public`.

### 3. Integritas Data & Web3 Identity
- **Lower-Case Mandate**: Semua kolom `wallet_address` harus memiliki constraint `CHECK (wallet_address = LOWER(wallet_address))`.

### 4. Zero Trust Enforcement (SIWE & Viem)
- **Backend Verification**: Semua mutasi data WAJIB diverifikasi menggunakan `viem` di sisi server sebelum mengeksekusi query dengan `SERVICE_ROLE_KEY`.

## 📋 Protokol Operasional Audit
- [ ] Apakah RLS aktif di seluruh tabel public?
- [ ] Apakah konstrain lowercase sudah ada di kolom wallet_address?
- [ ] Apakah `SERVICE_ROLE_KEY` hanya digunakan di sisi server?
- [ ] Apakah migrasi skema sudah didokumentasikan di `supabase/migrations/`?
- [ ] Apakah chat teknis menggunakan Bahasa Indonesia?
- [ ] Apakah file `.agents` sudah di-sync ke cloud?

## 🚨 Pantangan
- Memberikan akses `Write` kepada `anon` atau `authenticated` dari sisi frontend.
- Mengabaikan `search_path` pada fungsi database.
- Menyimpan `PRIVATE_KEY` atau `SERVICE_ROLE_KEY` di tabel publik.
- Melakukan modifikasi skema tanpa Development Plan yang disetujui.
