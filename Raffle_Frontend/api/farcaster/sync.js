import { createClient } from '@supabase/supabase-js';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

// Centralized Environment Consumption
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

    // Initialize Supabase with header for context awareness
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        global: {
            headers: { 'x-user-wallet': wallet }
        }
    });
    const neynar = new NeynarAPIClient(neynarApiKey);

    try {
        // 1. Procure Farcaster Metadata via Neynar SDK
        console.log("[Sync] Fetching data from Neynar...");
        const neynarData = await neynar.lookupUserByVerification(wallet);
        const fcUser = neynarData.result?.user || null;

        // 2. Prepare Profile State
        console.log("[Sync] Preparing profile data...");
        const profile = {
            wallet_address: wallet,
            last_sync: new Date().toISOString()
        };

        if (fcUser) {
            console.log(`[Sync] Farcaster user found: ${fcUser.username} (FID: ${fcUser.fid})`);
            profile.fid = fcUser.fid;
            profile.farcaster_username = fcUser.username; // Note: Column in DB is farcaster_username
            profile.display_name = fcUser.display_name;
            profile.pfp_url = fcUser.pfp_url;
            profile.bio = fcUser.profile?.bio?.text || '';
            profile.power_badge = fcUser.power_badge || false;
            // Note: Update columns if they exist in DB
            profile.neynar_score = fcUser.experimental?.neynar_user_score || 0;
            console.log(`[Sync] Neynar Score: ${profile.neynar_score}`);
        } else {
            console.log("[Sync] No Farcaster user found for this wallet.");
            profile.neynar_score = 0;
        }

        // 3. Commit to Database using Robust Upsert
        console.log("[Sync] Upserting to 'profiles' table...");
        const { data, error } = await supabase
            .from("profiles")
            .upsert(profile, { onConflict: "wallet_address" })
            .select()
            .single();

        if (error) {
            console.error("[Sync] Supabase Upsert Failed:", error);
            throw new Error("Database commit failed: " + error.message);
        }

        console.log("[Sync] Successfully synced profile for:", wallet);

        return res.status(200).json({
            ok: true,
            profile: data,
            synced: !!fcUser,
            score: profile.neynar_score
        });

    } catch (err) {
        console.error('[Sync] Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}


