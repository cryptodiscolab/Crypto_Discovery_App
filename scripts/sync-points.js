const { ethers } = require("hardhat");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

/**
 * Sync XP points from On-chain Events (PointsAwarded) to Supabase
 * Ensures Raffle Ticket purchases are credited to user leaderboard.
 */
async function main() {
    const MASTER_X_ADDRESS = process.env.MASTER_X_ADDRESS;
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!MASTER_X_ADDRESS || !SUPABASE_URL || !SUPABASE_KEY) {
        console.error("❌ Missing config (MASTER_X_ADDRESS, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY)");
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const masterContract = await ethers.getContractAt("CryptoDiscoMasterX", MASTER_X_ADDRESS);

    console.log("📡 Listening for PointsAwarded events from:", MASTER_X_ADDRESS);

    // Fetch last 5000 blocks to backfill recent purchases
    const filter = masterContract.filters.PointsAwarded();
    const events = await masterContract.queryFilter(filter, -5000);

    console.log(`🔍 Found ${events.length} historical events.`);

    for (const event of events) {
        const [user, points, reason] = event.args;

        if (reason === "Raffle Purchase") {
            const cleanAddress = user.toLowerCase();
            const xp = Number(points);
            const eventId = `${event.transactionHash}_${event.logIndex}`;

            console.log(`✨ Syncing ${xp} XP for ${cleanAddress} (Raffle Purchase)`);

            // Insert into user_task_claims to trigger automatic profile sync
            const { error } = await supabase.from('user_task_claims').upsert({
                wallet_address: cleanAddress,
                task_id: `ONCHAIN_RAFFLE_${eventId}`, // Deterministic ID to prevent double counting
                xp_earned: xp,
                claimed_at: new Date().toISOString()
            }, { onConflict: 'wallet_address, task_id' });

            if (error) {
                console.error(`❌ Sync failed for ${cleanAddress}:`, error.message);
            }
        }
    }

    console.log("✅ Sync completed.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
