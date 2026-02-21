-- ========================================================
-- FINAL CONSOLIDATED FIX: RESOLVE PK & CONSTRAINT ERRORS
-- ========================================================

DO $$ 
DECLARE 
    pk_name TEXT;
BEGIN 
    -- 1. Cari nama constraint Primary Key pada tabel user_stats
    SELECT conname INTO pk_name
    FROM pg_constraint 
    WHERE contype = 'p' 
    AND conrelid = 'public.user_stats'::regclass;

    -- 2. Drop Primary Key lama (yang mengandung 'fid')
    IF pk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.user_stats DROP CONSTRAINT ' || quote_ident(pk_name);
    END IF;

    -- 3. Set wallet_address sebagai Primary Key baru
    -- Pastikan wallet_address tidak null (seharusnya sudah PK-ready)
    ALTER TABLE public.user_stats ADD PRIMARY KEY (wallet_address);

    -- 4. Sekarang fid bisa dilepas dari kewajiban NOT NULL
    ALTER TABLE public.user_stats ALTER COLUMN fid DROP NOT NULL;

    -- 5. Tambahkan constraint Unique pada wallet_address jika belum ada 
    -- (Opsional jika sudah jadi PK, tapi baik untuk kejelasan)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_stats_wallet_address_key' 
        AND conrelid = 'public.user_stats'::regclass
    ) THEN
        ALTER TABLE public.user_stats ADD CONSTRAINT user_stats_wallet_address_key UNIQUE (wallet_address);
    END IF;

END $$;

-- 6. Update Sync Trigger Function (Robust Version)
CREATE OR REPLACE FUNCTION public.fn_sync_user_data_propagation()
RETURNS TRIGGER AS $$
BEGIN
    -- SYNC TO: public.profiles
    INSERT INTO public.profiles (address, display_name, bio, pfp_url, neynar_score, updated_at)
    VALUES (
        NEW.wallet_address,
        NEW.display_name,
        NEW.bio,
        NEW.pfp_url,
        COALESCE(NEW.neynar_score, 0),
        NOW()
    )
    ON CONFLICT (address) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        bio = EXCLUDED.bio,
        pfp_url = EXCLUDED.pfp_url,
        neynar_score = EXCLUDED.neynar_score,
        updated_at = NOW();

    -- SYNC TO: public.user_stats
    INSERT INTO public.user_stats (wallet_address, fid, total_xp, current_level, last_login_at, created_at)
    VALUES (
        NEW.wallet_address,
        NEW.fid,
        COALESCE(NEW.total_xp, 0),
        COALESCE(NEW.tier, 1),
        COALESCE(NEW.last_login_at, NOW()),
        COALESCE(NEW.created_at, NOW())
    )
    ON CONFLICT (wallet_address) DO UPDATE SET
        fid = COALESCE(EXCLUDED.fid, public.user_stats.fid),
        total_xp = EXCLUDED.total_xp,
        current_level = EXCLUDED.current_level,
        last_login_at = EXCLUDED.last_login_at;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Re-apply Trigger
DROP TRIGGER IF EXISTS trg_sync_user_data_on_update ON public.user_profiles;
CREATE TRIGGER trg_sync_user_data_on_update
    AFTER INSERT OR UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_user_data_propagation();
