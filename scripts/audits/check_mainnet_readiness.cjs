const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;
  
  console.log("Network:", (await provider.getNetwork()).name);
  console.log("Account:", deployer.address);
  
  const bal = await provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(bal), "ETH");
  
  // Also double check a few more potential AirnodeRrp addresses
  const potentials = [
    '0x2ab9f26E18b6103274414940251539D0105e2Add',
    '0xf8112d765E47c6999DB8eDf34B3f6c8d4A489370',
    '0x5E69C13b19280d44be589D1C86576F0E0D1C688e'
  ];
  
  for (const addr of potentials) {
    const code = await provider.getCode(addr.toLowerCase());
    console.log(`Code at ${addr}: ${code === '0x' ? 'NONE' : 'EXISTS'}`);
  }
}

main().catch(console.error);
