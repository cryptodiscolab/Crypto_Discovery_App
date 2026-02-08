import { createClient } from '@supabase/supabase-js';

// Hardened Supabase Client: Supports both Vercel (Next.js) and Vite (IDX) env vars
// Uses a Singleton-like export to ensure single instantiation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase environment variables are missing! Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
