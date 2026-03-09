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
  { name: 'DailyApp V13.1', addr: '0xEF8ab11E070359B9C0aA367656893B029c1d04d4' },
  { name: 'MasterX', addr: '0x78a566a11AcDA14b2A4F776227f61097C7381C84' },
  { name: 'Raffle', addr: '0x2c28bced53Cdfe9d9ECe7DFa79fE1066e453DE08' },
  { name: 'CMS V2', addr: '0x555D06933CC45038c42a1ba1F74140A5e4E0695d' }
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
