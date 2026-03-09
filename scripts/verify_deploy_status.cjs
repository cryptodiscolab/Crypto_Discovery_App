const { ethers } = require('hardhat');

async function main() {
  const addresses = [
    { name: 'DailyApp V13.1 (Mainnet)', addr: '0xEF8ab11E070359B9C0aA367656893B029c1d04d4' },
    { name: 'DailyApp V13.1 (Sepolia)', addr: '0xDe613DE5e6C0fB61012af83343f2b3c5F5461219' },
    { name: 'MasterX', addr: '0x78a566a11AcDA14b2A4F776227f61097C7381C84' },
    { name: 'Raffle', addr: '0x2c28bced53Cdfe9d9ECe7DFa79fE1066e453DE08' },
    { name: 'CMS V2', addr: '0x555D06933CC45038c42a1ba1F74140A5e4E0695d' },
    { name: 'AirnodeRrpV0 (Sepolia?)', addr: '0x2ab9f26E18b6103274414940251539D0105e2Add' },
    { name: 'AirnodeRrpV0 (Latest Doc 8453)', addr: '0x32A334335EBe9d83dfB33B3EF803328e7529246E' }
  ];

  const provider = ethers.provider;
  const network = await provider.getNetwork();
  console.log(`📡 Probing Network: ${network.name} (ChainID: ${network.chainId})`);

  console.log('\n--- VERIFICATION STATUS ---');
  for (const item of addresses) {
    const code = await provider.getCode(item.addr.toLowerCase());
    if (code === '0x') {
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
