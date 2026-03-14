/**
 * ADMIN TOKEN MANAGER
 * CLI tool for managing allowed tokens in the database.
 * Path: .agents/scripts/admin-token-manager.js
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listTokens() {
    console.log('📋 [Admin Token Manager] Fetching allowed tokens...');
    const { data, error } = await supabase
        .from('allowed_tokens')
        .select('*')
        .order('chain_id', { ascending: true });

    if (error) {
        console.error('❌ Error fetching tokens:', error.message);
        return;
    }

    if (data.length === 0) {
        console.log('📭 No tokens whitelisted.');
    } else {
        console.table(data.map(t => ({
            Chain: t.chain_id,
            Symbol: t.symbol,
            Address: t.address,
            Decimals: t.decimals,
            Active: t.is_active
        })));
    }
}

async function whitelistToken(chainId, address, symbol, decimals) {
    console.log(`📡 [Admin Token Manager] Whitelisting ${symbol} on chain ${chainId}...`);
    
    const { data, error } = await supabase
        .from('allowed_tokens')
        .upsert({
            chain_id: parseInt(chainId),
            address: address.toLowerCase(),
            symbol: symbol.toUpperCase(),
            decimals: parseInt(decimals),
            is_active: true
        }, { onConflict: 'chain_id,address' })
        .select();

    if (error) {
        console.error('❌ Error whitelisting token:', error.message);
    } else {
        console.log('✅ Token whitelisted successfully:', data[0]);
    }
}

async function deactivateToken(chainId, address) {
    console.log(`🚫 [Admin Token Manager] Deactivating token ${address} on chain ${chainId}...`);
    const { error } = await supabase
        .from('allowed_tokens')
        .update({ is_active: false })
        .eq('chain_id', chainId)
        .eq('address', address.toLowerCase());

    if (error) {
        console.error('❌ Error deactivating token:', error.message);
    } else {
        console.log('✅ Token deactivated.');
    }
}

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'list':
        listTokens();
        break;
    case 'add':
        if (args.length < 5) {
            console.log('Usage: node admin-token-manager.js add <chainId> <address> <symbol> <decimals>');
        } else {
            whitelistToken(args[1], args[2], args[3], args[4]);
        }
        break;
    case 'remove':
        if (args.length < 3) {
            console.log('Usage: node admin-token-manager.js remove <chainId> <address>');
        } else {
            deactivateToken(args[1], args[2]);
        }
        break;
    default:
        console.log('Available commands: list, add, remove');
}
