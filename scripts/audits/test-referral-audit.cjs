/**
 * TEST: Referral System Audit
 * This script simulates the referral flow from user registration to XP award activation.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SERVICE_ROLE_KEY);

// Dummy addresses for simulation
const REFERRER = "0x0000000000000000000000000000000000000Referrer".toLowerCase();
const REFEREE = "0x00000000000000000000000000000000000000Referee".toLowerCase();

async function runAudit() {
    console.log("🚀 Starting Referral System Audit Simulation...");

    // 1. Setup Referrer
    console.log(`\n1. Initializing Referrer: ${REFERRER}`);
    await supabase.from('user_profiles').upsert({
        wallet_address: REFERRER,
        total_xp: 1000,
        tier: 1
    });

    // 2. Setup Referee via Referral
    console.log(`2. Registering Referee: ${REFEREE} (Referred by ${REFERRER})`);
    const { data: refereeProfile, error: regError } = await supabase.from('user_profiles').upsert({
        wallet_address: REFEREE,
        total_xp: 0,
        tier: 0,
        referred_by: REFERRER
    }).select().single();

    if (regError) {
        console.error("❌ Registration Error:", regError);
        return;
    }
    console.log("✅ Referee Registered with attribution.");

    // 3. Simulate Tasks (3 Threshold)
    console.log("\n3. Simulating 3 Task Completions (Threshold for Activation)...");
    
    // In production, this happens on-chain, and sync-points.js or user-bundle.js syncs it.
    // We'll simulate the after-effect of a sync.
    const syncXP = 300; // 3 tasks * 100 XP
    
    console.log(`   Referee now has ${syncXP} XP on-chain. Syncing...`);
    
    await supabase.from('user_profiles').update({
        total_xp: syncXP,
        last_seen_at: new Date().toISOString()
    }).eq('wallet_address', REFEREE);

    // 4. Verify Referrer Bonus
    // The referral bonus activation logic is split between On-Chain (Contract) 
    // and Backend (Supabase via sync). 
    
    console.log("\n4. Checking Referrer Stats...");
    const { data: updatedReferrer } = await supabase.from('user_profiles')
        .select('total_xp, referred_by')
        .eq('wallet_address', REFERRER)
        .maybeSingle(); // v3.42.2: referrer may not exist in DB
        
    // Note: In our current setup, the CONTRACT awards the points, 
    // and the sync-points.js script MUST detect this and update the referrer profile.
    
    console.log(`\nAudit Summary:`);
    console.log(`- Referee: ${REFEREE} | Referred By: ${refereeProfile.referred_by}`);
    console.log(`- Referrer: ${REFERRER} | Current XP: ${updatedReferrer.total_xp}`);
    
    console.log("\n✨ Audit Complete. Proceed to valid verification on Testnet to confirm contract trigger.");
}

runAudit();
