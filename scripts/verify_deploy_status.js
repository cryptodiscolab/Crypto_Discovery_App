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

const addresses = [
  { name: 'DailyApp V13.1', addr: '0x87a3d1203Bf20E7dF5659A819ED79a67b236F571' },
  { name: 'MasterX', addr: '0x1ED8B135F01522505717D1E620c4EF869D7D25e7' },
  { name: 'Raffle', addr: '0x012FAdd087540e1B51a587f420e77D007fED2a84' },
  { name: 'CMS V2', addr: '0x8D5ef43A69DDc9f9d4bCc6dF3DcCcDBEDa53A302' }
];

console.log('--- VERIFYING ON BASE MAINNET ---');
for (const item of addresses) {
  const code = await mainnetClient.getCode({ address: item.addr });
  console.log(`${item.name} (${item.addr}): ${code !== '0x' ? '✅ DEPLOYED' : '❌ NOT FOUND'}`);
}

console.log('\n--- VERIFYING ON BASE SEPOLIA ---');
for (const item of addresses) {
  const code = await sepoliaClient.getCode({ address: item.addr });
  console.log(`${item.name} (${item.addr}): ${code !== '0x' ? '✅ DEPLOYED' : '❌ NOT FOUND'}`);
}
