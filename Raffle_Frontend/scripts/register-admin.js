import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL or SERVICE_ROLE_KEY missing from .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function registerAdmins() {
  const rawAdminWallets = [
    process.env.ADMIN_ADDRESS,
    process.env.VITE_ADMIN_ADDRESS,
    process.env.VITE_ADMIN_WALLETS
  ].join(',');

  const adminWallets = Array.from(new Set(
    rawAdminWallets
      .split(',')
      .map(a => a?.trim().toLowerCase())
      .filter(Boolean)
  ));

  if (adminWallets.length === 0) {
    console.log('No admin wallets found in .env. Skipping registration.');
    return;
  }

  console.log(`Registering ${adminWallets.length} admin wallets:`, adminWallets);

  for (const wallet of adminWallets) {
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ 
        wallet_address: wallet, 
        is_admin: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'wallet_address' });

    if (error) {
      console.error(`Failed to register wallet ${wallet}:`, error.message);
    } else {
      console.log(`Successfully registered wallet: ${wallet}`);
    }
  }

  // Generate dynamic SQL for is_admin_wallet function
  const listSql = adminWallets.map(w => `LOWER('${w}')`).join(', ');
  const functionSql = `
CREATE OR REPLACE FUNCTION is_admin_wallet(wallet TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN LOWER(wallet) IN (${listSql});
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `;

  console.log('\n--- SQL TO RUN IN SUPABASE SQL EDITOR ---');
  console.log(functionSql);
  console.log('--- END SQL ---');
  
  // Attempt to update function via RPC if possible (requires pre-defined rpc)
  // For now, we print it for the user as per .cursorrules Section 17.3
}

registerAdmins().catch(console.error);
