-- ============================================================
-- 🆘 EMERGENCY RECOVERY & DATABASE SHIELD v1
-- Melindungi poin user dari penghapusan dan memulihkan data yang hilang.
-- ============================================================

-- 1. DATABASE SHIELD: Matikan fitur "Cascade Delete"
-- Agar saat Task dihapus, Riwayat Poin (Klaim) tetap aman tersimpan.
DO $$ 
DECLARE 
    current_fkey NAME;
BEGIN
    -- Cari nama foreign key yang menghubungkan klaim ke task
    SELECT conname INTO current_fkey
    FROM pg_constraint 
    WHERE conrelid = 'public.user_task_claims'::regclass 
    AND contype = 'f';

    -- Hapus foreign key yang lama jika ada
    IF current_fkey IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.user_task_claims DROP CONSTRAINT ' || current_fkey;
    END IF;

    -- Pasang foreign key baru TANPA "CASCADE DELETE"
    -- Kita gunakan "SET NULL" agar klaim tetap ada meskipun task dihapus
    ALTER TABLE public.user_task_claims 
    ADD CONSTRAINT user_task_claims_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES public.daily_tasks(id) 
    ON DELETE SET NULL;
END $$;


-- 2. XP RECOVERY: Tarik kembali poin dari kolom cadangan
-- Mengambil nilai dari 'points' (8100, 5100, dll) dan memindahkannya ke sistem XP baru
UPDATE public.user_profiles 
SET xp = points 
WHERE xp = 0 AND points > 0;


-- 3. SYNC FINAL: Pastikan Leaderboard langsung terupdate
-- Memicu penghitungan ulang tier berdasarkan poin yang baru dipulihkan
UPDATE public.user_profiles SET updated_at = NOW() WHERE points > 0;

-- ============================================================
-- ✅ SELESAI. Poin Anda harusnya sudah kembali di Leaderboard.
-- ✅ Menghapus Daily Task sekarang AMAN dan tidak akan menghapus poin lagi.
-- ============================================================
