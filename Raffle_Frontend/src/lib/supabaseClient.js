import { createClient } from '@supabase/supabase-js';

// Hardened Supabase Client Singleton
// Prevents "Multiple GoTrueClient instances" warning on low-spec hardware
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase environment variables are missing!");
}

// Singleton implementation using globalThis
if (!globalThis.supabaseInstance) {
    globalThis.supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = globalThis.supabaseInstance;
