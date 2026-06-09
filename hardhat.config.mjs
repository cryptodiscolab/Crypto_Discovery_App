import "dotenv/config";
import hardhatEth from "@nomicfoundation/hardhat-ethers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import hardhatUpgrades from "@openzeppelin/hardhat-upgrades";

export default {
    plugins: [
        hardhatEth,
        hardhatMocha,
        hardhatVerify,
        hardhatUpgrades,
    ],
    solidity: {
        compilers: [
            {
                version: "0.8.22",
                settings: {
                    optimizer: { enabled: true, runs: 1 },
                    viaIR: true,
                },
            },
            {
                version: "0.8.20",
                settings: {
                    optimizer: { enabled: true, runs: 1 },
                    viaIR: true,
                },
            },
        ],
    },
    networks: {
        "base-sepolia": {
            type: "http",
            url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
        "base-mainnet": {
            type: "http",
            url: process.env.VITE_BASE_RPC_URL || "https://mainnet.base.org",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
    },
    etherscan: {
        apiKey: {
            "base-sepolia": process.env.BASESCAN_API_KEY || "",
        },
        customChains: [
            {
                network: "base-sepolia",
                chainId: 84532,
                urls: {
                    apiURL: "https://api-sepolia.basescan.org/api",
                    browserURL: "https://sepolia.basescan.org",
                },
            },
        ],
    },
};