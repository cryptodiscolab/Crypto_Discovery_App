import { createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';

const mainnetClient = createPublicClient({ 
  chain: base, 
  transport: http('https://mainnet.base.org') 
});

const sepoliaClient = createPublicClient({ 
  chain: baseSepolia, 
  transport: http('https://sepolia.base.org') 
});

const mainnetAddresses = [
  { name: 'DailyApp V12 (Mainnet)', addr: '[RESERVED]' },
  { name: 'MasterX', addr: '0x1ED8B135F01522505717D1E620C4Ef869D7D25e7' },
];

const sepoliaAddresses = [
  { name: 'DailyApp V13.2', addr: '0xaC430adE9217e2280b852EA29b91d14b12b3E151' },
  { name: 'MasterX', addr: '0x1ED8B135F01522505717D1E620C4Ef869D7D25e7' },
  { name: 'Raffle', addr: '0xc20DbecD24f83Ca047257B7bdd7767C36260DEbB' },
  { name: 'CMS V2', addr: '0xd992f0c869E82EC3B6779038Aa4fCE5F16305edC' }
];

console.log('--- VERIFYING ON BASE MAINNET ---');
for (const item of mainnetAddresses) {
  if (item.addr === '[RESERVED]') {
    console.log(`${item.name}: SKIP (RESERVED)`);
    continue;
  }
  const code = await mainnetClient.getCode({ address: item.addr });
  const isDeployed = code && code !== '0x' && code !== '0x0';
  const hexProof = isDeployed ? ` (Proof: ${code.substring(0, 10)}...)` : '';
  console.log(`${item.name} (${item.addr}): ${isDeployed ? '✅ DEPLOYED' : '❌ NOT FOUND'}${hexProof}`);
}

console.log('\n--- VERIFYING ON BASE SEPOLIA ---');
for (const item of sepoliaAddresses) {
  const code = await sepoliaClient.getCode({ address: item.addr });
  const isDeployed = code && code !== '0x' && code !== '0x0';
  const hexProof = isDeployed ? ` (Proof: ${code.substring(0, 10)}...)` : '';
  console.log(`${item.name} (${item.addr}): ${isDeployed ? '✅ DEPLOYED' : '❌ NOT FOUND'}${hexProof}`);
}
