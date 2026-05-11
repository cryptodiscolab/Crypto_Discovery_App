import { createClient } from '@supabase/supabase-js';

// Hardened Supabase Client Singleton
// Prevents "Multiple GoTrueClient instances" warning on low-spec hardware
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.group("Supabase Critical Error");
    console.error("Supabase environment variables are missing!");
    console.info("VITE_SUPABASE_URL:", supabaseUrl ? "Found" : "MISSING");
    console.info("VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "Found" : "MISSING");
    console.groupEnd();
}

// Singleton implementation using globalThis
if (!(globalThis as any).supabaseInstance && supabaseUrl && supabaseAnonKey) {
    (globalThis as any).supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
} else if (!(globalThis as any).supabaseInstance) {
    // Mock client to prevent crashes if env vars are missing
    (globalThis as any).supabaseInstance = {
        from: () => ({
            select: () => ({ order: () => ({ range: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: "Supabase not initialized" } }) }) }) }) }),
            upsert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: "Supabase not initialized" } }) }) })
        })
    };
}

export const supabase = (globalThis as any).supabaseInstance;

// Helper: Clean wallet address untuk konsistensi (lowercase)
// Prevents case-sensitivity bugs in EVM address comparisons
export const cleanWallet = (address: string | null | undefined) => {
    if (!address) return null;
    return address.toLowerCase().trim();
};

