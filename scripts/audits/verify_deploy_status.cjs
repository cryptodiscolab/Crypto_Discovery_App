const { ethers } = require('hardhat');

async function main() {
  const addresses = [
    { name: 'DailyApp V12 (Mainnet - Reserved)', addr: '[RESERVED]' },
    { name: 'DailyApp V16 (Sepolia)', addr: '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353' },
    { name: 'MasterX (New)', addr: '0x1b573DdD9a1679505ae64498564523222c758EC2' },
    { name: 'Raffle (New)', addr: '0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7' },
    { name: 'CMS V2', addr: '0xd992f0c869E82EC3B6779038Aa4fCE5F16305edC' },
    { name: 'DailyApp V15 (Legacy)', addr: '0x0D6f339795EeA5129461388F25dE4f87e92b8DA2' },
    { name: 'MasterX (Legacy)', addr: '0x980770dAcE8f13E10632D3EC1410FAA4c707076c' },
    { name: 'AirnodeRrpV0 (Base Sepolia legacy/no-code risk)', addr: '0x2ab9f26E18b6103274414940251539D0105e2Add' },
    { name: 'AirnodeRrpV0 (Base Sepolia valid)', addr: '0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd' },
    { name: 'AirnodeRrpV0 (Latest Doc 8453)', addr: '0x32A334335EBe9d83dfB33B3EF803328e7529246E' }
  ];

  const provider = ethers.provider;
  const network = await provider.getNetwork();
  console.log(`📡 Probing Network: ${network.name} (ChainID: ${network.chainId})`);

  console.log('\n--- VERIFICATION STATUS ---');
  for (const item of addresses) {
    if (item.addr === '[RESERVED]' || !item.addr.startsWith('0x')) {
      console.log(`⏭️  ${item.name}: SKIP (RESERVED)`);
      continue;
    }
    const code = await provider.getCode(item.addr.toLowerCase());
    const isDeployed = code && code !== '0x' && code !== '0x0';
    if (!isDeployed) {
      console.log(`❌ ${item.name} (${item.addr}): NOT DEPLOYED`);
    } else {
      console.log(`✅ ${item.name} (${item.addr}): DEPLOYED (${code.length} bytes)`);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
