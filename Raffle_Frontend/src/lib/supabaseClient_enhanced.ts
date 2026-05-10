// ============================================
// [DEPRECATED] SUPABASE CLIENT ENHANCED
// WARNING: This file uses a legacy "x-user-wallet" pattern.
// REQUIRED: Use Next.js API Routes for all WRITE operations.
// See .cursorrules §8.1 (Zero Trust Frontend Policy).
// ============================================

import { supabase, cleanWallet } from './supabaseClient';

/**
 * @deprecated 
 * This was used for an old RLS pattern that is now forbidden.
 * All writes must move to /api/verify-action or similar backend routes.
 */
export const createAuthenticatedClient = (walletAddress) => {
    console.warn("[Security] createAuthenticatedClient is deprecated. Use API Routes for writes.");
    return supabase; // Fallback to standard client (Select only)
};

export { supabase, cleanWallet };
