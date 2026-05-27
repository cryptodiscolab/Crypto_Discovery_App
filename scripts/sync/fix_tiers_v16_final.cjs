/**
 * fix_tiers_v16_final.cjs
 * Fixes V16 tier sync in one shot.
 * - Grants ADMIN_ROLE if needed
 * - Sets setNFTConfigsBatch
 */
require('dotenv').config();
const { createPublicClient, createWalletClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');

const PK = process.env.PRIVATE_KEY;
const DAILY_APP_PROXY = '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353';
const RPC = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

const account = privateKeyToAccount('0x' + PK.replace('0x', ''));
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) });

// Minimal ABI
const ABI = [
  { inputs: [], name: 'ADMIN_ROLE', outputs: [{ type: 'bytes32' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'DEFAULT_ADMIN_ROLE', outputs: [{ type: 'bytes32' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ type: 'bytes32' }, { type: 'address' }], name: 'hasRole', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ type: 'bytes32' }, { type: 'address' }], name: 'grantRole', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [
    { type: 'uint8[]' }, { type: 'uint256[]' }, { type: 'uint256[]' },
    { type: 'uint256[]' }, { type: 'uint256[]' }, { type: 'uint256[]' }, { type: 'bool[]' }
  ], name: 'setNFTConfigsBatch', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ type: 'uint8' }], name: 'nftConfigs', outputs: [
    { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' },
    { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bool' }
  ], stateMutability: 'view', type: 'function' },
];

async function main() {
  console.log('=== FIX V16 TIERS ===\n');
  console.log('Account:', account.address);
  console.log('Proxy:', DAILY_APP_PROXY);
  console.log('RPC:', RPC, '\n');

  // 1. Read roles
  const adminRole = await publicClient.readContract({ address: DAILY_APP_PROXY, abi: ABI, functionName: 'ADMIN_ROLE' });
  const defaultAdmin = await publicClient.readContract({ address: DAILY_APP_PROXY, abi: ABI, functionName: 'DEFAULT_ADMIN_ROLE' });
  console.log('ADMIN_ROLE:', adminRole);
  console.log('DEFAULT_ADMIN_ROLE:', defaultAdmin, '\n');

  // 2. Check permissions
  const isDefault = await publicClient.readContract({ address: DAILY_APP_PROXY, abi: ABI, functionName: 'hasRole', args: [defaultAdmin, account.address] });
  const isAdmin = await publicClient.readContract({ address: DAILY_APP_PROXY, abi: ABI, functionName: 'hasRole', args: [adminRole, account.address] });
  console.log('has DEFAULT_ADMIN_ROLE:', isDefault);
  console.log('has ADMIN_ROLE:', isAdmin);

  // 3. If has default admin, grant self ADMIN_ROLE
  if (isDefault && !isAdmin) {
    console.log('\nGranting ADMIN_ROLE to self...');
    const tx1 = await walletClient.writeContract({ address: DAILY_APP_PROXY, abi: ABI, functionName: 'grantRole', args: [adminRole, account.address], gas: 200000n });
    console.log('Tx:', tx1);
    const r1 = await publicClient.waitForTransactionReceipt({ hash: tx1 });
    console.log('Status:', r1.status);
    if (r1.status !== 'success') { console.log('FAILED'); return; }
  } else if (!isDefault) {
    console.log('\nNo DEFAULT_ADMIN_ROLE. Cannot proceed without admin grant.');
    console.log('Check who has DEFAULT_ADMIN_ROLE in Admin Dashboard.');
    return;
  }

  // 4. Set nftConfigsBatch
  console.log('\nSetting nftConfigsBatch...');
  const tx2 = await walletClient.writeContract({
    address: DAILY_APP_PROXY,
    abi: ABI,
    functionName: 'setNFTConfigsBatch',
    args: [
      [1, 2, 3, 4, 5],
      [100n, 500n, 1500n, 4000n, 10000n],
      ['600000000000000','1200000000000000','2000000000000000','12000000000000000','25000000000000000'].map(BigInt),
      [5n, 10n, 20n, 40n, 100n],
      [200n, 500n, 1000n, 1500n, 2000n],
      [1000n, 500n, 250n, 100n, 50n],
      [true, true, true, true, true]
    ],
    gas: 500000n,
  });
  console.log('Tx:', tx2);
  const r2 = await publicClient.waitForTransactionReceipt({ hash: tx2 });
  console.log('Status:', r2.status, 'Block:', r2.blockNumber);

  // 5. Verify
  console.log('\n=== VERIFICATION ===');
  let allGood = true;
  const expected = [100, 500, 1500, 4000, 10000];
  for (let i = 1; i <= 5; i++) {
    const cfg = await publicClient.readContract({ address: DAILY_APP_PROXY, abi: ABI, functionName: 'nftConfigs', args: [i] });
    const tierNames = ['NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
    const ok = Number(cfg[0]) === expected[i-1] && cfg[6] === true;
    if (!ok) allGood = false;
    console.log(`${ok ? '✅' : '❌'} ${tierNames[i]}: pointsRequired=${Number(cfg[0])} isOpen=${cfg[6]}`);
  }
  console.log(`\n${allGood ? '✅ ALL TIERS FIXED' : '❌ Some still broken'}`);
}

main().catch(e => console.error('FATAL:', e.message || e));