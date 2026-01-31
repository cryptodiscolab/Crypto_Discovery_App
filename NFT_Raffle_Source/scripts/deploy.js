const hre = require("hardhat");

async function main() {
  console.log("Deploying NFTRaffle contract to Base network...");

  // API3 AirnodeRrpV0 addresses (Verified from references.json)
  const AIRNODE_RRP_ADDRESSES = {
    "base-sepolia": "0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd",
    base: "0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd",
    localhost: "0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd", // placeholder
    hardhat: "0xa0AD79D995DdeeB18a14eAef56A549A04e3Aa1Bd", // placeholder
  };

  // API3 QRNG Provider details (Nodary)
  const AIRNODE_ADDRESS = "0x6238772544f029ecaBfDED4300f13A3c4FE84E1D";
  const ENDPOINT_ID = "0xfb6d017bb87991b7495f563db3c8cf59ff87b09781947bb1e417006ad7f55a78";

  const network = hre.network.name;
  const airnodeRrpAddress = AIRNODE_RRP_ADDRESSES[network];

  if (!airnodeRrpAddress) {
    throw new Error(`AirnodeRrp address not found for network: ${network}`);
  }

  console.log("Network:", network);
  console.log("AirnodeRrp Address:", airnodeRrpAddress);

  const NFTRaffle = await hre.ethers.getContractFactory("NFTRaffle");

  console.log("Sending deployment transaction...");
  const nftRaffle = await NFTRaffle.deploy(airnodeRrpAddress, {
    gasLimit: 3000000,
  });

  console.log("Waiting for deployment...");
  await nftRaffle.waitForDeployment();

  const contractAddress = await nftRaffle.getAddress();
  console.log("NFTRaffle deployed to:", contractAddress);

  console.log("Setting QRNG Parameters...");
  // Note: Sponsor Wallet needs to be derived for real usage.
  const sponsorWallet = contractAddress;

  const tx = await nftRaffle.setQrngParameters(
    AIRNODE_ADDRESS,
    ENDPOINT_ID,
    sponsorWallet
  );
  await tx.wait();
  console.log("QRNG Parameters set.");

  // Wait for block confirmations
  if (network !== "hardhat" && network !== "localhost") {
    console.log("Waiting for block confirmations for verification...");
    await nftRaffle.deploymentTransaction().wait(5);

    console.log("Verifying contract on Basescan...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [airnodeRrpAddress],
      });
      console.log("Contract verified successfully!");
    } catch (error) {
      console.log("Verification error:", error.message);
    }
  }

  console.log("\n=== Deployment Summary ===");
  console.log("Contract Address:", contractAddress);
  console.log("Network:", network);
  console.log("Explorer URL:", `https://${network === "base" ? "" : "sepolia."}basescan.org/address/${contractAddress}`);
  console.log("\nIMPORTANT: You MUST derive your Sponsor Wallet and update it using setQrngParameters!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
