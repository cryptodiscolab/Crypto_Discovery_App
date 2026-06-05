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
  { name: 'MasterX', addr: '0x980770dAcE8f13E10632D3EC1410FAA4c707076c' },
];

const sepoliaAddresses = [
  { name: 'DailyApp V16', addr: '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353' },
  { name: 'MasterX (New)', addr: '0x1b573DdD9a1679505ae64498564523222c758EC2' },
  { name: 'Raffle (Active QRNG)', addr: '0x1501273b0a02D8a313ae2cDb1C5CeAeeE0C1d32C' },
  { name: 'CMS V2', addr: '0xd992f0c869E82EC3B6779038Aa4fCE5F16305edC' },
  { name: 'DailyApp V15 (Legacy)', addr: '0x0D6f339795EeA5129461388F25dE4f87e92b8DA2' },
  { name: 'MasterX (Legacy)', addr: '0x980770dAcE8f13E10632D3EC1410FAA4c707076c' }
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
