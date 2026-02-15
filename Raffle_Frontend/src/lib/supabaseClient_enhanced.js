// ============================================
// SUPABASE CLIENT WITH CUSTOM HEADERS
// Web3 Wallet Authentication via x-user-wallet
// ============================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase environment variables are missing!");
}

// Helper: Clean wallet address untuk konsistensi (lowercase)
export const cleanWallet = (address) => {
    if (!address) return null;
    return address.toLowerCase().trim();
};

// ============================================
// AUTHENTICATED SUPABASE CLIENT FACTORY
// ============================================

// Cache for authenticated clients to avoid "Multiple GoTrueClient instances" warnings
const clientCache = new Map();

/**
 * Creates a Supabase client with custom x-user-wallet header
 * This header is validated by RLS policies for write operations
 * 
 * @param {string} walletAddress - User's connected wallet address
 * @returns {SupabaseClient} Authenticated Supabase client
 */
export const createAuthenticatedClient = (walletAddress) => {
    if (!walletAddress) {
        throw new Error('Wallet address is required for authenticated operations');
    }

    const clean = cleanWallet(walletAddress);

    // Return cached client if it exists
    if (clientCache.has(clean)) {
        return clientCache.get(clean);
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: {
                'x-user-wallet': clean,
            },
        },
    });

    clientCache.set(clean, client);
    return client;
};

// ============================================
// BASE SUPABASE CLIENT (Read-Only Operations)
// ============================================

// Singleton implementation for read-only operations
if (!globalThis.supabaseInstance) {
    globalThis.supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = globalThis.supabaseInstance;

// ============================================
// USAGE EXAMPLES
// ============================================

/**
 * Example 1: Fetch active tasks (No auth required)
 * 
 * const { data: tasks } = await supabase
 *     .from('daily_tasks')
 *     .select('*')
 *     .eq('is_active', true);
 */

/**
 * Example 2: Create user profile (Auth required)
 * 
 * const authenticatedClient = createAuthenticatedClient(userWallet);
 * const { data, error } = await authenticatedClient
 *     .from('user_profiles')
 *     .insert({ wallet_address: cleanWallet(userWallet) });
 */

/**
 * Example 3: Claim task (Auth required)
 * 
 * const authenticatedClient = createAuthenticatedClient(userWallet);
 * const { data, error } = await authenticatedClient
 *     .from('user_task_claims')
 *     .insert({
 *         wallet_address: cleanWallet(userWallet),
 *         task_id: taskId,
 *         xp_earned: xpReward,
 *     });
 */

/**
 * Example 4: Admin - Create task (Auth required, admin wallet only)
 * 
 * const adminClient = createAuthenticatedClient(MASTER_ADMIN_WALLET);
 * const { data, error } = await adminClient
 *     .from('daily_tasks')
 *     .insert({
 *         description: 'New daily task',
 *         xp_reward: 50,
 *         task_type: 'daily',
 *     });
 */
