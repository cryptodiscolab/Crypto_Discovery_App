-- ==========================================
-- AGENT VAULT: Secure Brain Storage
-- ==========================================
-- Tabel ini menyimpan instruksi .cursorrules dan skill .agents secara privat.
-- Hanya Admin dengan SERVICE_ROLE_KEY (Server-side) yang bisa mengakses.

CREATE TABLE IF NOT EXISTS public.agent_vault (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_path TEXT UNIQUE NOT NULL, -- Contoh: '.cursorrules', '.agents/skills/sentinel/SKILL.md'
    content TEXT NOT NULL,
    category TEXT NOT NULL, -- 'protocol', 'skill', 'script'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1
);

-- AKTIFKAN RLS (ROW LEVEL SECURITY)
ALTER TABLE public.agent_vault ENABLE ROW LEVEL SECURITY;

-- KEBIJAKAN KEAMANAN: 
-- 1. Publik/Anonim: TIDAK BOLEH BACA/TULIS (0% Akses)
-- 2. Authenticated User: TIDAK BOLEH BACA (Khusus Vault)
-- 3. Service Role (Agent): FULL ACCESS (Internal Only)

DROP POLICY IF EXISTS "Deny All Public Access" ON public.agent_vault;
CREATE POLICY "Deny All Public Access" ON public.agent_vault 
FOR ALL USING (false);

-- Catatan: Service Role secara default melewati RLS, 
-- jadi Agent tetap bisa sync asalkan menggunakan SERVICE_ROLE_KEY.
