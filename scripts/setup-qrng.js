require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
    console.log("========================================");
    console.log("🎲 Setting up API3 QRNG (Nodary) Integration");
    console.log("========================================\n");

    const rawAirnode = process.env.AIRNODE_ADDRESS;
    const endpointId = process.env.ENDPOINT_ID_UINT256;

    // Alamat Kontrak yang benar (deployed)
    const rawContract = "0xd7f6d4589A04F51D22B3a5965860EB40fb219c78";
    // Alamat Sponsor Wallet (dengan checksum yang benar)
    const rawSponsor = "0x7186e5D35f126c3C809670F567b594582f3C7d61";

    // PAKSA ke format Checksum yang bener biar Ethers v6 nggak marah (Node v23 fix)
    const airnodeAddress = ethers.getAddress(rawAirnode);
    const contractAddress = ethers.getAddress(rawContract);
    const sponsorWallet = ethers.getAddress(rawSponsor);

    if (!airnodeAddress || !endpointId) {
        throw new Error("Missing AIRNODE_ADDRESS or ENDPOINT_ID_UINT256 in .env");
    }

    console.log("📍 Configuration Details (Checksum Fixed):");
    console.log("   Contract (Sponsor):", contractAddress);
    console.log("   Derived Sponsor Wallet:", sponsorWallet);

    const [deployer] = await ethers.getSigners();
    console.log("\n⏳ Gaspol setting via deployer:", deployer.address);

    const CryptoDiscoMaster = await ethers.getContractFactory("CryptoDiscoMaster");
    const contract = CryptoDiscoMaster.attach(contractAddress);

    // Kirim transaksi resmi
    const tx = await contract.setQRNGParameters(
        airnodeAddress,
        endpointId,
        sponsorWallet
    );

    console.log("   Transaction Hash:", tx.hash);
    await tx.wait();

    console.log("\n✅ QRNG Parameters set successfully!");
    console.log("🎉 AMANAH: Sekarang isi saldo " + sponsorWallet + " pake 0.01 ETH Sepolia!");
}

main().catch((error) => {
    console.error("\n❌ ERROR TETEP MUNCUL? Cek ini:", error.message);
    process.exit(1);
});