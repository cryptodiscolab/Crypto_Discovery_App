name: Supabase Database Audit & Architecture Manager
description: Protokol khusus untuk melakukan audit struktur, kebijakan RLS, integritas data, dan manajemen arsitektur multi-schema (public & auth) di Supabase.
---

# Supabase Database Audit & Security Manager Skill

Skill ini menetapkan protokol wajib bagi asisten untuk memantau, memvalidasi, dan mengamankan infrastruktur database Supabase, memastikan kepatuhan terhadap standar **Zero Trust Frontend**.

## 🛡️ Kompetensi Inti

### 1. Audit Row Level Security (RLS)
- **Status Wajib**: Setiap tabel di skema `public` WAJIB memiliki RLS aktif.
- **Validasi Kebijakan**:
    - **SELECT**: Boleh `true` untuk data umum (public reader).
    - **INSERT/UPDATE/DELETE**: **DILARANG** mengandalkan kustom header (e.g., `request.headers`). Harus melalui verifikasi signature di Backend API.
- **Permissive RLS Policy Ban**: DILARANG keras menggunakan `USING (true)` untuk operasi `Write`.
- **Pengecekan Rutin**: Selalu bandingkan kebijakan di database dengan file `supabase_rls_policies.sql`.

### 2. Database Function Isolation
- **Search Path Isolation**: Setiap fungsi SQL (`CREATE FUNCTION`) WAJIB memiliki deklarasi `SET search_path = public` (atau skema terkait) untuk mencegah *Search Path Hijacking*.
- **Security Definer**: Gunakan `SECURITY DEFINER` hanya jika diperlukan, dan pastikan `search_path` terkunci jika menggunakannya.

### 2. Integritas Data & Web3 Identity
- **Lower-Case Mandate**: Semua kolom `wallet_address` harus memiliki constraint `CHECK (wallet_address = LOWER(wallet_address))`.
- **Primary Key**: Gunakan `wallet_address` sebagai Primary Key pada tabel profil untuk efisiensi indexing Web3.
- **Unique Constraints**: Pastikan tabel klaim memiliki unique index pada kombinasi `(wallet_address, task_id, (claimed_at::date))` untuk mencegah double-claim.

### 3. Audit Sinkronisasi Logika (Triggers & Functions)
- **XP Balancing**: Pastikan trigger `sync_user_xp()` selalu aktif setelah setiap `INSERT` pada `user_task_claims`.
- **Atomic Operations**: Pastikan penambahan `total_xp` di profil dan `current_claims` di task terjadi dalam satu transaksi database.
- **Admin Verification**: Periksa fungsi `is_admin_wallet()` agar selalu mencocokkan dengan alamat admin resmi yang tertera di `.cursorrules`.

### 4. Identity & Schema Architecture (Multi-Schema Awareness)
- **Auth Schema Protection**: Menyadari keberadaan skema `auth` (auth.users, auth.sessions, dll) sebagai area yang dikelola platform. DILARANG memodifikasi tabel `auth` secara langsung melalui script SQL publik kecuali untuk trigger yang sangat spesifik.
- **Cross-Schema Linking**: Jika bermigrasi dari Web3-Native ke Hybrid Auth, gunakan tipe data `UUID` untuk referensi ke `auth.users.id` dan pastikan foreign key memiliki aksi `ON DELETE CASCADE`.
- **Identity Isolation**: Pisahkan data sensitif (email, encrypted_password di `auth`) dari data sosial/game (xp, tier di `public.user_profiles`).
- **Audit Log Entry**: Pahami bahwa `auth.audit_log_entries` mencatat aktivitas otentikasi. Untuk mutasi data aplikasi, gunakan tabel audit kustom di skema `public`.

### 5. Advanced Database Management
- **Schema Migrations**: Setiap perubahan schema HARUS didokumentasikan dalam folder `supabase/migrations/` atau file SQL versi (`v1`, `v2`).
- **Constraint Integrity**: Selain data types, audit harus mencakup `CHECK constraints`, `UNIQUE indexes`, dan `Foreign Key` integrity untuk mencegah data yatim (*orphan data*).
- **Service Role Isolation**: Pastikan `service_role` memiliki izin penuh hanya pada tabel yang diperlukan untuk operasional backend, dan tetap gunakan RLS `SELECT` untuk publik.

### 6. Zero Trust Enforcement (SIWE & Viem)
- **Backend Verification**: Semua mutasi data WAJIB diverifikasi menggunakan `viem` di sisi server sebelum mengeksekusi query dengan `SERVICE_ROLE_KEY`.
- **No Direct Frontend Write**: Pastikan tidak ada komponen React yang mengimpor `supabase` client untuk melakukan `.insert()` atau `.update()` ke tabel target Zero Trust.

## 📋 Protokol Operasional Audit

Sebelum menyetujui perubahan skema atau kebijakan, asisten harus:
1.  Membaca file skema terbaru (`supabase_schema.sql`).
2.  Memverifikasi apakah kebijakan RLS baru membuka celah bagi serangan Client-Side.
3.  Memastikan konstrain lowercase tidak terlewat.
4.  Memeriksa dampak bytecode atau performa query (indexing) pada tabel yang besar.
5.  Memastikan `SERVICE_ROLE_KEY` hanya digunakan di direktori `verification-server` atau route API Next.js.

## 🚨 Pantangan (Forbidden)
- Memberikan akses `ALL` kepada `anon` atau `authenticated` di tabel `user_profiles` atau `point_settings`.
- Mengabaikan error sinkronisasi XP antara Visual (Frontend) dan Database.
- Mengabaikan warning linter mengenai `search_path` yang mutable pada fungsi database.
- Melakukan modifikasi destruktif pada skema `auth` secara langsung.
- Menyimpan `PRIVATE_KEY` atau `SERVICE_ROLE_KEY` di tabel yang bisa dibaca publik.
