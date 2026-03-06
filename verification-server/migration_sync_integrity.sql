-- ============================================
-- SQL MIGRATION: UNIQUE CONSTRAINT FOR TASK SYNC
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Tambah constraint unik untuk mencegah duplikasi saat sync batch
-- Urutan: platform, action_type, target_id
-- Ini memungkinkan kita menggunakan UPSERT dengan aman.

ALTER TABLE public.daily_tasks 
ADD CONSTRAINT daily_tasks_platform_action_target_key 
UNIQUE (platform, action_type, target_id);

-- 2. Verifikasi index pendukung (opsional karena constraint otomatis membuat index)
-- CREATE INDEX IF NOT EXISTS idx_daily_tasks_sync_lookup 
-- ON public.daily_tasks(platform, action_type, target_id);

-- SELESAI. Sinkronisasi batch admin sekarang memiliki integritas database yang kuat.
