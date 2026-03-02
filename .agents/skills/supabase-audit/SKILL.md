---
name: Supabase Database Audit & Security Manager
description: Protokol khusus untuk melakukan audit struktur, kebijakan RLS, dan integritas data pada database Supabase di Crypto Disco App.
---

# Supabase Database Audit & Security Manager Skill

Skill ini menetapkan protokol wajib bagi asisten untuk memantau, memvalidasi, dan mengamankan infrastruktur database Supabase, memastikan kepatuhan terhadap standar **Zero Trust Frontend**.

## 🛡️ Kompetensi Inti

### 1. Audit Row Level Security (RLS)
- **Status Wajib**: Setiap tabel di skema `public` WAJIB memiliki RLS yang aktif.
- **Validasi Kebijakan**:
    - **SELECT**: Boleh `true` jika data bersifat publik (misal: leaderboard).
    - **INSERT/UPDATE/DELETE**: DILARANG keras menggunakan `true` atau mengandalkan header kustom di sisi klien. Kebijakan harus membatasi penulisan hanya melalui `SERVICE_ROLE` atau verifikasi backend yang ketat.
- **Pengecekan Rutin**: Selalu bandingkan kebijakan di database dengan file `supabase_rls_policies.sql`.

### 2. Integritas Data & Web3 Identity
- **Lower-Case Mandate**: Semua kolom `wallet_address` harus memiliki constraint `CHECK (wallet_address = LOWER(wallet_address))`.
- **Primary Key**: Gunakan `wallet_address` sebagai Primary Key pada tabel profil untuk efisiensi indexing Web3.
- **Unique Constraints**: Pastikan tabel klaim memiliki unique index pada kombinasi `(wallet_address, task_id, (claimed_at::date))` untuk mencegah double-claim.

### 3. Audit Sinkronisasi Logika (Triggers & Functions)
- **XP Balancing**: Pastikan trigger `sync_user_xp()` selalu aktif setelah setiap `INSERT` pada `user_task_claims`.
- **Atomic Operations**: Pastikan penambahan `total_xp` di profil dan `current_claims` di task terjadi dalam satu transaksi database.
- **Admin Verification**: Periksa fungsi `is_admin_wallet()` agar selalu mencocokkan dengan alamat admin resmi yang tertera di `.cursorrules`.

### 4. Zero Trust Enforcement
- **Backend-Only Writes**: Verifikasi bahwa tidak ada kode frontend yang melakukan `.insert()` atau `.update()` langsung ke tabel sensitif.
- **API logs**: Sarankan pembuatan tabel `audit_logs` untuk mencatat setiap mutasi data yang dilakukan melalui backend.

## 📋 Protokol Operasional Audit

Sebelum menyetujui perubahan skema atau kebijakan, asisten harus:
1.  Membaca file skema terbaru (`supabase_schema.sql`).
2.  Memverifikasi apakah kebijakan RLS baru membuka celah bagi serangan Client-Side.
3.  Memastikan konstrain lowercase tidak terlewat.
4.  Memeriksa dampak bytecode atau performa query (indexing) pada tabel yang besar.
5.  Memastikan `SERVICE_ROLE_KEY` hanya digunakan di direktori `verification-server` atau route API Next.js.

## 🚨 Pantangan (Forbidden)
- Memberikan akses `ALL` kepada `anon` atau `authenticated` di tabel `user_profiles`.
- Mengabaikan error sinkronisasi XP antara Visual (Frontend) dan Database.
- Menyimpan `PRIVATE_KEY` atau `SERVICE_ROLE_KEY` di tabel yang bisa dibaca publik.
