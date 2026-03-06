-- ============================================
-- SQL MIGRATION: SCHEMA CONSISTENCY (TITLE COLUMN)
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Tambah kolom title ke tabel daily_tasks agar sinkron dengan Dashboard & Contract
ALTER TABLE public.daily_tasks 
ADD COLUMN IF NOT EXISTS title TEXT;

-- 2. Migrasi data lama dari description ke title (opsional tapi disarankan)
UPDATE public.daily_tasks 
SET title = description 
WHERE title IS NULL;

-- 3. Update Unique Constraint untuk menyertakan integritas lebih kuat (opsional)
-- Kita sudah punya constraint (platform, action_type, target_id)
-- Itu sudah cukup unik, jadi tidak perlu diubah, hanya datanya yang perlu konsisten.

-- SELESAI. Dashboard dan Bot sekarang bicara dalam bahasa yang sama (TITLE).
