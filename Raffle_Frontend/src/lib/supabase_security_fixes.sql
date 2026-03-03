-- ============================================
-- 🛡️ SUPABASE SECURITY HARDENING (SEARCH PATH & RLS LOCKDOWN)
-- Target: Resolve Search Path Hijacking and Permissive RLS Policies
-- ============================================

-- ─── 1. SECURING DATABASE FUNCTIONS (SEARCH PATH ISOLATION) ─────────────────
-- Menambahkan 'SET search_path = public' untuk mencegah Search Path Hijacking.
-- Menggunakan blok DO untuk menangani berbagai signature fungsi secara otomatis.

DO $$
DECLARE
    func_name text;
    func_schema text;
    func_args text;
BEGIN
    FOR func_schema, func_name, func_args IN 
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'calculate_trust_score_v2', 'fn_deactivate_expired_tasks', 'calculate_trust_score',
              'handle_new_user', 'update_total_points', 'fn_refresh_rank_scores',
              'fn_increment_user_xp', 'sync_user_xp_final', 'sync_user_xp',
              'trg_sync_total_xp_shadow', 'fn_sync_user_data_propagation', 'sync_user_points',
              'fn_compute_leaderboard_tiers', 'fn_get_tier_distribution', 'set_campaign_end_date',
              'validate_task_platform_url', 'check_and_increment_participants', 'update_updated_at_column'
          )
    LOOP
        EXECUTE 'ALTER FUNCTION ' || func_schema || '.' || func_name || '(' || func_args || ') SET search_path = public';
    END LOOP;
END $$;

-- ─── 2. LOCKDOWN PERMISSIVE RLS POLICIES ─────────────────────────────────────
-- Menggunakan blok DO untuk memastikan tabel ada sebelum memodifikasi RLS.

-- 📌 Tabel: point_settings
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'point_settings') THEN
        ALTER TABLE public.point_settings ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow All Access for Now" ON public.point_settings;
        DROP POLICY IF EXISTS "Public Read Access" ON public.point_settings;
        CREATE POLICY "Public Read Access" ON public.point_settings FOR SELECT USING (true);
    END IF;
END $$;

-- 📌 Tabel: ens_subdomains
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ens_subdomains') THEN
        ALTER TABLE public.ens_subdomains ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Admin Insert Access" ON public.ens_subdomains;
        DROP POLICY IF EXISTS "Public Read Access" ON public.ens_subdomains;
        CREATE POLICY "Public Read Access" ON public.ens_subdomains FOR SELECT USING (true);
    END IF;
END $$;

-- 📌 Tabel: global_announcements (Pembersihan Opsional)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'global_announcements') THEN
        ALTER TABLE public.global_announcements ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow all for now" ON public.global_announcements;
        DROP POLICY IF EXISTS "Public Read Access" ON public.global_announcements;
        CREATE POLICY "Public Read Access" ON public.global_announcements FOR SELECT USING (true);
    END IF;
END $$;

-- ─── 3. VERIFICATION ────────────────────────────────────────────────────────
-- Run this to check if RLS is enabled on all tables
-- SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND relkind = 'r';
