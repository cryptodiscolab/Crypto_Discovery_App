require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("hardhat-contract-sizer");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 1,
            },
            viaIR: true,
        },
    },
    networks: {
        // camelCase (legacy)
        baseSepolia: {
            url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
        // kebab-case alias — dipakai oleh scripts dengan --network base-sepolia
        "base-sepolia": {
            url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
    },
    etherscan: {
        apiKey: process.env.BASESCAN_API_KEY || "",
    },
    // Contract size checker — run manually: npx hardhat size-contracts
    contractSizer: {
        alphaSort: false,
        runOnCompile: false,   // keep false on low-spec machine
        disambiguatePaths: false,
        strict: true,          // fails if any contract > 24KB
    },
};
