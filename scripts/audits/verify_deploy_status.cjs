const { ethers } = require('hardhat');

async function main() {
  const addresses = [
    { name: 'DailyApp V12 (Mainnet - Reserved)', addr: '[RESERVED]' },
    { name: 'DailyApp V13.2 (Sepolia)', addr: '0xaC430adE9217e2280b852EA29b91d14b12b3E151' },
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
