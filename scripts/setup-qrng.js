require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
    console.log("========================================");
    console.log("🎲 Setting up API3 QRNG (Nodary) Integration");
    console.log("========================================\n");

    const airnodeAddress = process.env.AIRNODE_ADDRESS;
    const endpointId = process.env.ENDPOINT_ID_UINT256;

    // Alamat Kontrak lo
    const rawContract = "0x393B57dC5f73D06f12b18CF305a8e50FC8EdFF7de";
    // Alamat Sponsor Wallet
    const rawSponsor = "0x7186E5d35F126C3c809670f567B594582f3c7D61";

    // PAKSA ke format Checksum yang bener biar Ethers v6 nggak marah
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