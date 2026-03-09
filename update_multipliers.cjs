const { createClient } = require('@supabase/supabase-js');
const { createPublicClient, createWalletClient, http, parseAbi } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');
require('dotenv').config();

// Contract Addresses
const DAILY_APP_ADDRESS = process.env.VITE_V12_CONTRACT_ADDRESS;

async function updateMultipliers() {
    console.log('=== Balancing Tier Multipliers (Basis Points) ===');
    
    // Config: [TierIndex, MultiplierBP]
    // 0: NONE, 1: BRONZE, 2: SILVER, 3: GOLD, 4: PLATINUM, 5: DIAMOND
    const tiers = [1, 2, 3, 4, 5];
    const newMultipliers = [10000, 11000, 12000, 13500, 15000];
    
    // Note: Since we don't want to change pointsRequired/mintPrice/etc., 
    // we should use setNFTConfig for each tier or read first.
    // However, to keep it simple and safe for the user to copy, I will provide the script template.
    
    console.log('Target Multipliers:');
    tiers.forEach((t, i) => {
        console.log(`Tier ${t}: ${newMultipliers[i]} BP (${newMultipliers[i]/10000}x)`);
    });

    console.log('\nSuggested Action: Run setNFTConfig for each tier via Admin Dashboard or this script if private key is available.');
}

updateMultipliers();
