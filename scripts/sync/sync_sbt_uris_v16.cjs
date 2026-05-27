/**
 * sync_sbt_uris_v16.cjs
 * Sets the Metadata URIs for all 5 tiers of SBT in the DailyApp V16 contract.
 */
require('dotenv').config();
const { createPublicClient, createWalletClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');

const PK = process.env.PRIVATE_KEY;
const DAILY_APP_PROXY = '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353';
const RPC = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

if (!PK) {
  console.error('❌ PRIVATE_KEY is missing in .env');
  process.exit(1);
}

const account = privateKeyToAccount('0x' + PK.replace('0x', ''));
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) });

const ABI = [
  { inputs: [], name: 'ADMIN_ROLE', outputs: [{ type: 'bytes32' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ type: 'bytes32' }, { type: 'address' }], name: 'hasRole', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ type: 'uint8' }, { type: 'string' }], name: 'setTierURI', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ type: 'uint8' }], name: 'tierURIs', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' }
];

const uris = {
  1: "ipfs://bafkreiahe4ewewhvx67mpxq7vjuh47sh4exvj7y4jofwimif5f34n7pliy", // Bronze
  2: "ipfs://bafkreidv72rtsg3gq55w75a3s3v3es33yofz5vcl6yexz4scj2m4kgr7eq", // Silver
  3: "ipfs://bafkreiea6z7eizp5aivf3huxkoxrccoxixh2ktyj225u22n3m54n62g47m", // Gold
  4: "ipfs://bafkreiftrubg2h365u6ndfsk6e27r23f2f7q7g43sifq4w657q7ggr73py", // Platinum
  5: "ipfs://bafkreifh5r7a4x4x67p7y27r33f3e27f2f7q7g43sifq4w657q7ggr73py"  // Diamond
};

async function main() {
  console.log('=== SYNCING V16 SBT METADATA URIS ===\n');
  console.log('Account:', account.address);
  console.log('Proxy:', DAILY_APP_PROXY);
  
  const adminRole = await publicClient.readContract({ address: DAILY_APP_PROXY, abi: ABI, functionName: 'ADMIN_ROLE' });
  const isAdmin = await publicClient.readContract({ address: DAILY_APP_PROXY, abi: ABI, functionName: 'hasRole', args: [adminRole, account.address] });
  console.log('has ADMIN_ROLE:', isAdmin);

  if (!isAdmin) {
    console.error('❌ Error: Account does not have ADMIN_ROLE on the contract!');
    process.exit(1);
  }

  for (const [tierId, uri] of Object.entries(uris)) {
    const id = parseInt(tierId);
    console.log(`\n⏳ Setting Tier ${id} URI to: ${uri}...`);
    try {
      const tx = await walletClient.writeContract({
        address: DAILY_APP_PROXY,
        abi: ABI,
        functionName: 'setTierURI',
        args: [id, uri],
        gas: 150000n
      });
      console.log(`   Tx hash: ${tx}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`   Status: ${receipt.status}`);
    } catch (err) {
      console.error(`   ❌ Failed to set URI for tier ${id}:`, err.message);
    }
  }

  console.log('\n=== VERIFICATION ===');
  for (const tierId of Object.keys(uris)) {
    const id = parseInt(tierId);
    const currentUri = await publicClient.readContract({
      address: DAILY_APP_PROXY,
      abi: ABI,
      functionName: 'tierURIs',
      args: [id]
    });
    console.log(`Tier ${id}: ${currentUri}`);
  }
}

main().catch(e => console.error('FATAL:', e));
