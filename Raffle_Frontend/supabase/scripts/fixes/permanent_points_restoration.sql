-- ============================================================
-- 💎 PERMANENT POINTS RESTORATION & SYNC REPAIR 💎
-- Melakukan restorasi permanen poin legacy ke dalam tabel klaim.
-- ============================================================

-- 1. BUAT JANGKAR: Dummy Task untuk XP Legacy
-- Kita buat satu task khusus sebagai referensi poin lama agar riwayat tetap ada.
INSERT INTO public.daily_tasks (id, description, xp_reward, is_active, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000000', 
    'LEGACY_XP_RESTORE: Migrasi Poin dari Sistem Lama', 
    0, 
    false, 
    NOW()
) ON CONFLICT (id) DO NOTHING;


-- 2. RESTORE RIWAYAT KLAIM
-- Memasukkan poin dari kolom 'points' ke dalam tabel 'user_task_claims' 
-- sebagai bukti riwayat permanen agar Master Sync tidak menghapusnya.
INSERT INTO public.user_task_claims (wallet_address, task_id, xp_earned, claimed_at)
SELECT 
    wallet_address, 
    '00000000-0000-0000-0000-000000000000' as task_id, 
    points as xp_earned, 
    NOW() as claimed_at
FROM public.user_profiles
WHERE points > 0
ON CONFLICT (wallet_address, task_id) DO UPDATE SET
    xp_earned = EXCLUDED.xp_earned;


-- 3. FINAL SYNC & VERIFICATION
-- Jalankan ulang fungsi sinkronisasi utama untuk memastikan profil bersih.
UPDATE public.user_profiles p
SET xp = (
    SELECT COALESCE(SUM(xp_earned), 0)
    FROM public.user_task_claims c
    WHERE LOWER(c.wallet_address) = LOWER(p.wallet_address)
);

-- ============================================================
-- ✅ RESTORASI SELESAI. 
-- ✅ Poin Anda sekarang aman di dalam riwayat 'user_task_claims'.
-- ✅ Master Sync sekarang akan melindungi poin ini selamanya.
-- ============================================================
