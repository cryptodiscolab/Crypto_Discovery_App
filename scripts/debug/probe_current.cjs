const { ethers } = require('hardhat');

async function main() {
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  console.log(`📡 Network: ${network.name} (ChainID: ${network.chainId})`);

  const contracts = [
    { name: 'DailyApp V16 Proxy', addr: '0xb592D6819Ea310d83034cD80FDDC2e754D0a5353' },
    { name: 'MasterX (New)', addr: '0x1b573DdD9a1679505ae64498564523222c758EC2' },
    { name: 'Raffle (Active QRNG)', addr: '0x1501273b0a02D8a313ae2cDb1C5CeAeeE0C1d32C' },
    { name: 'CMS V2', addr: '0xd992f0c869E82EC3B6779038Aa4fCE5F16305edC' },
    { name: 'DailyApp V15 (Legacy)', addr: '0x0D6f339795EeA5129461388F25dE4f87e92b8DA2' },
    { name: 'MasterX (Old)', addr: '0x980770dAcE8f13E10632D3EC1410FAA4c707076c' }
  ];

  for (const c of contracts) {
    const code = await provider.getCode(c.addr);
    const exists = code && code !== '0x' && code !== '0x0';
    console.log(`${exists ? '✅' : '❌'} ${c.name}: ${c.addr} (${exists ? code.length + ' bytes' : 'NOT DEPLOYED'})`);
    
    if (exists) {
      if (c.name.includes('Proxy')) {
        try {
          const contract = new ethers.Contract(c.addr, ['function masterXContract() view returns (address)'], provider);
          const masterX = await contract.masterXContract();
          console.log(`   └─ Linked MasterX: ${masterX}`);
        } catch (e) {
          console.log(`   └─ Failed to fetch MasterX link: ${e.message}`);
        }
      }
      if (c.name.includes('MasterX (New)')) {
        try {
          const contract = new ethers.Contract(c.addr, [
            'function dailyAppContract() view returns (address)',
            'function raffleContract() view returns (address)',
            'function owner() view returns (address)'
          ], provider);
          const dailyApp = await contract.dailyAppContract();
          const raffle = await contract.raffleContract();
          const owner = await contract.owner();
          console.log(`   ├─ Linked DailyApp: ${dailyApp}`);
          console.log(`   ├─ Linked Raffle: ${raffle}`);
          console.log(`   └─ Owner: ${owner}`);
        } catch (e) {
          console.log(`   └─ Failed to fetch MasterX links: ${e.message}`);
        }
      }
      if (c.name.includes('Raffle (New)')) {
        try {
          const contract = new ethers.Contract(c.addr, [
            'function masterContract() view returns (address)',
            'function owner() view returns (address)'
          ], provider);
          const master = await contract.masterContract();
          const owner = await contract.owner();
          console.log(`   ├─ Linked MasterX: ${master}`);
          console.log(`   └─ Owner: ${owner}`);
        } catch (e) {
          console.log(`   └─ Failed to fetch Raffle links: ${e.message}`);
        }
      }
    }
  }
}

main().catch(console.error);
