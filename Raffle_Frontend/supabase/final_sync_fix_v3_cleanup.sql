-- ========================================================
-- FINAL CONSOLIDATED FIX V3: CLEANUP & STRUCTURE RESET
-- ========================================================

DO $$ 
DECLARE 
    pk_name TEXT;
BEGIN 
    -- 1. Hapus data "sampah" (Baris yang tidak punya wallet_address)
    -- Karena kita bermigrasi ke Wallet-Based SoT, data tanpa wallet tidak valid.
    DELETE FROM public.user_stats WHERE wallet_address IS NULL;

    -- 2. Pastikan semua wallet_address yang ada dalam format lowercase
    UPDATE public.user_stats SET wallet_address = LOWER(wallet_address);

    -- 3. Cari nama constraint Primary Key pada tabel user_stats
    SELECT conname INTO pk_name
    FROM pg_constraint 
    WHERE contype = 'p' 
    AND conrelid = 'public.user_stats'::regclass;

    -- 4. Drop Primary Key lama (yang mengandung 'fid')
    IF pk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.user_stats DROP CONSTRAINT ' || quote_ident(pk_name);
    END IF;

    -- 5. Set wallet_address sebagai Primary Key baru (Sekarang dijamin NOT NULL)
    ALTER TABLE public.user_stats ALTER COLUMN wallet_address SET NOT NULL;
    ALTER TABLE public.user_stats ADD PRIMARY KEY (wallet_address);

    -- 6. Sekarang fid bisa dilepas dari kewajiban NOT NULL
    ALTER TABLE public.user_stats ALTER COLUMN fid DROP NOT NULL;

END $$;

-- 7. Update Sync Trigger Function (Robust Version)
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

-- 8. Re-apply Trigger
DROP TRIGGER IF EXISTS trg_sync_user_data_on_update ON public.user_profiles;
CREATE TRIGGER trg_sync_user_data_on_update
    AFTER INSERT OR UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_user_data_propagation();
