-- ============================================
-- 💎 DATABASE HARMONY v2 - FINAL SYNC 💎
-- ============================================
-- Deskripsi: Mengharmonisasikan database dengan fitur aplikasi terbaru.
-- Menangani: Pembersihan Duplikat, Anti-Cheat, XP Standardization, & Sync Triggers.
-- Instruksi: Jalankan Script ini di Supabase SQL Editor.
-- ============================================

-- §1. DATA CLEANUP (PEMBERSIHAN DUPLIKAT)
-- Hapus duplikasi klaim yang menyebabkan error pada index
DELETE FROM public.user_task_claims a
USING public.user_task_claims b
WHERE a.id < b.id 
  AND a.wallet_address = b.wallet_address 
  AND a.task_id = b.task_id;

-- §2. ANTI-CHEAT SECURITY (INDEX UNIK)
-- Pastikan user tidak bisa mengklaim task yang sama dua kali
CREATE UNIQUE INDEX IF NOT EXISTS uidx_user_task_unique 
ON public.user_task_claims (wallet_address, task_id);

-- §3. SCHEMA HARMONY (STANDARISASI KOLOM)
-- Kita akan menggunakan 'xp' sebagai standar utama (menggantikan total_xp)
DO $$ 
BEGIN 
    -- Tambahkan kolom xp jika belum ada
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='xp') THEN
        ALTER TABLE public.user_profiles ADD COLUMN xp INTEGER DEFAULT 0;
    END IF;

    -- Tambahkan kolom updated_at jika belum ada (Penting untuk View)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='updated_at') THEN
        ALTER TABLE public.user_profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    -- Jika total_xp ada, pindahkan datanya ke xp
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='total_xp') THEN
        UPDATE public.user_profiles SET xp = GREATEST(xp, total_xp);
    END IF;
END $$;

-- §3b. DAILY TASKS EVOLUTION (KOLOM BARU)
-- Tambahkan kolom yang diperlukan untuk fitur Expiration
ALTER TABLE public.daily_tasks ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.daily_tasks ADD COLUMN IF NOT EXISTS min_neynar_score FLOAT DEFAULT 0;

-- §4. MASTER SYNC FUNCTION (SOURCE OF TRUTH)
-- Fungsi tunggal untuk menghitung ulang XP dari rincian klaim
CREATE OR REPLACE FUNCTION public.sync_user_xp_final()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
BEGIN
    -- A. Pastikan profil ada
    INSERT INTO public.user_profiles (wallet_address, xp, tier)
    VALUES (LOWER(NEW.wallet_address), 0, 1)
    ON CONFLICT (wallet_address) DO NOTHING;

    -- B. Sinkronisasi XP Agresif
    UPDATE public.user_profiles
    SET 
        xp = (
            SELECT COALESCE(SUM(xp_earned), 0)
            FROM public.user_task_claims
            WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address)
        ),
        updated_at = NOW()
    WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address);
    
    RETURN NEW;
END;
$$;

-- §5. RESET & RE-APPLY TRIGGERS
DROP TRIGGER IF EXISTS trg_sync_user_xp_on_claim ON public.user_task_claims;
DROP TRIGGER IF EXISTS trg_sync_xp_on_claim ON public.user_task_claims;
DROP TRIGGER IF EXISTS trg_sync_xp_final ON public.user_task_claims;

CREATE TRIGGER trg_sync_xp_final
AFTER INSERT ON public.user_task_claims
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_xp_final();

-- §6. GLOBAL DATA RE-CALCULATION (SINKRONISASI TOTAL SEKARANG)
-- Hitung ulang semua XP user di seluruh database agar sinkron
UPDATE public.user_profiles p
SET xp = (
    SELECT COALESCE(SUM(xp_earned), 0)
    FROM public.user_task_claims c
    WHERE LOWER(c.wallet_address) = LOWER(p.wallet_address)
);

-- §7. MASTER VIEW RE-CREATION (v_user_full_profile)
-- Consolidated Identity: Menggunakan sistem tier dinamis dari sbt_thresholds
DROP VIEW IF EXISTS public.v_user_full_profile CASCADE;
CREATE OR REPLACE VIEW public.v_user_full_profile AS
SELECT 
    up.wallet_address,
    up.fid,
    COALESCE(up.username, '') as username,
    COALESCE(up.display_name, '') as display_name, 
    up.pfp_url, -- TAMBAHKAN INI: Dibutuhkan oleh LeaderboardPage.jsx
    COALESCE(up.neynar_score, 0) as neynar_score,
    COALESCE(up.xp, 0) as xp,
    COALESCE(up.xp, 0) as total_xp, -- Alias agar frontend tidak error
    COALESCE(up.tier, 1) as tier,
    -- DYNAMIC RANK NAME: Mengambil nama tier tertinggi yang dicapai berdasarkan XP
    (
        SELECT st.tier_name 
        FROM public.sbt_thresholds st 
        WHERE COALESCE(up.xp, 0) >= st.min_xp 
        ORDER BY st.min_xp DESC 
        LIMIT 1
    ) as rank_name,
    COALESCE(up.updated_at, up.created_at) as updated_at
FROM public.user_profiles up;

GRANT SELECT ON public.v_user_full_profile TO anon, authenticated;

-- ============================================
-- ✅ DATABASE HARMONY v2 APPLIED
-- ============================================
