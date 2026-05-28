const { ethers } = require('hardhat');

async function main() {
  const provider = ethers.provider;
  const raffleAddr = '0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7';
  const raffle = new ethers.Contract(raffleAddr, ['function airnodeRrp() view returns (address)'], provider);
  try {
    const rrp = await raffle.airnodeRrp();
    console.log(`Raffle contract ${raffleAddr} has airnodeRrp set to: ${rrp}`);
    
    // Check if the rrp address has code
    const code = await provider.getCode(rrp);
    console.log(`Address ${rrp} has code length: ${code ? code.length : 0} bytes`);
  } catch (e) {
    console.error(`Error fetching airnodeRrp:`, e.message);
  }
}

main().catch(console.error);
