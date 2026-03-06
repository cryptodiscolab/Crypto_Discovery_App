-- ============================================
-- SQL MIGRATION: ANTI-CHEAT (CEGAH KLAIM BERULANG)
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Tambah kolom target_id ke tabel daily_tasks
-- Kolom ini menyimpan Username/ID Akun (misal: 'chebrothers')
ALTER TABLE public.daily_tasks 
ADD COLUMN IF NOT EXISTS target_id TEXT;

-- 2. Tambah kolom target_id ke tabel user_task_claims
-- Kolom ini mencatat user mana saja yang sudah klaim target tersebut
ALTER TABLE public.user_task_claims 
ADD COLUMN IF NOT EXISTS target_id TEXT;

-- 3. (Opsional) Tambah index untuk performa Anti-Cheat
CREATE INDEX IF NOT EXISTS idx_user_task_claims_target 
ON public.user_task_claims(wallet_address, platform, action_type, target_id);

-- SELESAI. Fitur "Cegah Klaim Berulang" sekarang aktif di Backend dan Dashboard.
