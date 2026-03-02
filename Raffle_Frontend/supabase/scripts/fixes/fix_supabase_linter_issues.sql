-- ============================================
-- CRYPTO DISCO APP - LINTER & SECURITY FIXES
-- ============================================
-- Menangani dua peringatan keamanan (Linter Errors) dari Supabase:
-- 1. SECURITY DEFINER di View v_user_full_profile
-- 2. RLS belum aktif pada tabel user_point_logs

-- ----------------------------------------------------------------------------
-- FIX #1: Mengubah View v_user_full_profile menjadi 'security_invoker'
-- Penjelasan: Security Definer secara otomatis menjalankan tabel dengan izin pembuatnya.
-- Menjalankan dengan hak invoker memastikan akses data tetap menghormati RLS si pemanggil.
-- ----------------------------------------------------------------------------

-- Kita tidak perlu menghapus ('DROP') view, cukup Alter untuk Postgres 15+
ALTER VIEW public.v_user_full_profile SET (security_invoker = true);

-- ----------------------------------------------------------------------------
-- FIX #2: Mengamankan Tabel user_point_logs (Mengaktifkan RLS)
-- Penjelasan: Tabel public yang terbuka sangat berbahaya. Mengaktifkan RLS 
-- secara default akan 'DENY' semua akses baca/tulis dari sisi Client (anon/auth).
-- Hanya Service Role (Backend) yang akan diizinkan membaca & mengedit table ini.
-- ----------------------------------------------------------------------------

-- 1. Aktifkan RLS
ALTER TABLE public.user_point_logs ENABLE ROW LEVEL SECURITY;

-- 2. Aturan: Hapus semua policy publik yang mungkin tidak sengaja terbuka
DROP POLICY IF EXISTS "Public can view logs" ON public.user_point_logs;
DROP POLICY IF EXISTS "Users can insert logs" ON public.user_point_logs;

-- (Opsional) Jika Anda ingin publik BISA melihat log, gunakan ini. 
-- Namun karena ini zero-trust backend, lebih baik kita biarkan kosong.
-- Policy Kosong = Client SIDE 'Total Deny'.
-- Service Role (Verification Server) otomatis diizinkan karena by-pass RLS.

-- ============================================
-- VERIFIKASI KEAMANAN (PRE-FLIGHT CHECK)
-- ============================================
-- ✅ View v_user_full_profile: Security Invoker
-- ✅ Table user_point_logs: RLS Enabled
-- ✅ Akses Tulis: Dibatasi secara mutlak pada backend Next.js API
