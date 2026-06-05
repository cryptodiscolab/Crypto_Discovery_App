// QRNG Configuration Script for Hardhat Console
// Copy-paste this into hardhat console after running: npx hardhat console --network baseSepolia

const contractAddress = "0x393B57dC5f73D06f12b18CF305a8e50FC8EdFF7de";
const airnodeAddress = "0x6238772544f029ecaBfDED4300f13A3c4FE84E1D";
const endpointId = "0xfb6d017bb87991b7495f563db3c8cf59ff87b09781947bb1e417006ad7f55a78";
const sponsorWallet = "0x40eF15db2F08F322abCE913ead1cF039FDC48d92";

console.log("🎲 Configuring QRNG on CryptoDiscoMaster...\n");
console.log("Contract:", contractAddress);
console.log("Airnode:", airnodeAddress);
console.log("Sponsor Wallet:", sponsorWallet);
console.log("\n⏳ Sending transaction...\n");

const contract = await ethers.getContractAt("CryptoDiscoMaster", contractAddress);
const tx = await contract.setQRNGParameters(airnodeAddress, endpointId, sponsorWallet);

console.log("📝 Transaction Hash:", tx.hash);
console.log("⏳ Waiting for confirmation...\n");

const receipt = await tx.wait();

console.log("✅ QRNG CONFIGURED SUCCESSFULLY!");
console.log("📊 Block Number:", receipt.blockNumber);
console.log("⛽ Gas Used:", receipt.gasUsed.toString());
console.log("\n🎉 Setup Complete! Raffle is now ready to use QRNG.");
