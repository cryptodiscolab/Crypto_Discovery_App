import { createClient } from '@supabase/supabase-js';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

// Centralized Environment Consumption
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const neynarApiKey = process.env.NEYNAR_API_KEY;

/**
 * Neynar Identity Sync Protocol:
 * Uses @neynar/nodejs-sdk for robust data procurement.
 * Optimized for low-latency identity mapping.
 */
export default async function handler(req, res) {
    if (!supabaseServiceKey || !supabaseUrl || !neynarApiKey) {
        console.error("[Sync] Missing Configuration:", { supabaseUrl: !!supabaseUrl, supabaseServiceKey: !!supabaseServiceKey, neynarApiKey: !!neynarApiKey });
        return res.status(500).json({ error: 'System Configuration Incomplete' });
    }

    const cleanWallet = (w) => w?.trim?.().toLowerCase() ?? null;

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { address } = req.body;
    const wallet = cleanWallet(address);

    console.log(`[Sync] Starting sync for wallet: ${wallet}`);

    if (!wallet) {
        console.warn("[Sync] Aborted: Invalid Wallet Address");
        return res.status(200).json({ skipped: true, message: 'Invalid Wallet' });
    }

    // Initialize Supabase and Neynar with safety
    let supabase;
    let neynar;
    try {
        supabase = createClient(supabaseUrl, supabaseServiceKey, {
            global: { headers: { 'x-user-wallet': wallet } }
        });
        neynar = new NeynarAPIClient({ apiKey: neynarApiKey });
    } catch (initErr) {
        console.error("[Sync] Client Initialization Error:", initErr.message);
        return res.status(500).json({ error: "Client Init Failed: " + initErr.message });
    }

    try {
        // 1. Procure Farcaster Metadata via Neynar SDK
        console.log(`[Sync] Fetching data from Neynar for: ${wallet}`);
        let fcUser = null;
        try {

            // SDK v3 Correct Method (Verified via node_modules source)
            // Method signature: fetchBulkUsersByEthOrSolAddress(params: { addresses: string[], ... })
            let response;
            if (typeof neynar.fetchBulkUsersByEthOrSolAddress === 'function') {
                response = await neynar.fetchBulkUsersByEthOrSolAddress({ addresses: [wallet] });
            } else {
                // inspect client structure to debug
                console.log("Neynar Client Keys:", Object.keys(neynar));
                throw new Error("Neynar SDK method fetchBulkUsersByEthOrSolAddress not found.");
            }


            // LOGGING: Inspect the actual structure
            console.log(`[Sync] Raw Neynar Response for ${wallet}:`, JSON.stringify(response, null, 2));

            // Flexible Parsing
            // SDK v3 fetchBulkUsersByEthereumAddress returns: { [lowerCaseAddress]: [UserObject] }
            if (response && response[wallet.toLowerCase()]) {
                const users = response[wallet.toLowerCase()];
                if (users && users.length > 0) {
                    fcUser = users[0];
                }
            }
            // Fallback parsing just in case structure is different
            else if (response?.users) {
                fcUser = response.users[0];
            }

            if (fcUser) {
                console.log(`[Sync] User Found: ${fcUser.username} (FID: ${fcUser.fid})`);
            } else {
                console.warn("[Sync] User Not Found in Neynar response. Keys:", Object.keys(response || {}));
            }
        } catch (nErr) {
            console.error("[Sync] Neynar API Call Error (Non-blocking):", nErr.message);
        }

        // 2. Prepare Profile State
        console.log("[Sync] Preparing profile data...");
        const profile = {
            address: wallet,
            updated_at: new Date().toISOString()
        };

        if (fcUser) {
            profile.display_name = fcUser.display_name || null;
            profile.pfp_url = fcUser.pfp_url || null;
            profile.bio = fcUser.profile?.bio?.text || null;
            profile.neynar_score = fcUser.experimental?.neynar_user_score || 0;
        } else {
            profile.neynar_score = 0;
        }

        // 3. Commit to Database using Robust Upsert
        console.log("[Sync] Upserting to 'profiles' table for:", wallet);
        const { data, error } = await supabase
            .from("profiles")
            .upsert(profile, { onConflict: "address" })
            .select()
            .maybeSingle(); // Better for cases where upsert doesn't return exactly 1 row

        if (error) {
            console.error("[Sync] Supabase Upsert Failed:", error);
            return res.status(500).json({ error: "Database commit failed: " + error.message, details: error });
        }

        console.log("[Sync] Successfully synced profile for:", wallet);
        return res.status(200).json({
            ok: true,
            profile: data,
            synced: !!fcUser,
            score: profile.neynar_score
        });

    } catch (err) {
        console.error('[Sync] Fatal Pipeline Error:', err.message, err.stack);
        return res.status(500).json({
            error: err.message,
            stack: err.stack,
            env_status: {
                url: !!supabaseUrl,
                key: !!supabaseServiceKey,
                neynar: !!neynarApiKey
            }
        });
    }
}


