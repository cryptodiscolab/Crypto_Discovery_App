const { ethers } = require('hardhat');

async function main() {
  const addresses = [
    { name: 'DailyApp V13.1 (Mainnet)', addr: '0x87a3d1203Bf20E7dF5659A819ED79a67b236F571' },
    { name: 'DailyApp V13.1 (Sepolia)', addr: '0x87a3d1203Bf20E7dF5659A819ED79a67b236F571' },
    { name: 'MasterX', addr: '0x1ED8B135F01522505717D1E620c4EF869D7D25e7' },
    { name: 'Raffle', addr: '0x012FAdd087540e1B51a587f420e77D007fED2a84' },
    { name: 'CMS V2', addr: '0x8D5ef43A69DDc9f9d4bCc6dF3DcCcDBEDa53A302' },
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
