import { DISCO_MASTER_ABI } from '../shared/constants/abis';

export const MASTER_X_ABI = DISCO_MASTER_ABI;
export const DAILY_APP_ABI = [
    {
        "inputs": [
            { "internalType": "uint256", "name": "_startId", "type": "uint256" },
            { "internalType": "uint256", "name": "_endId", "type": "uint256" }
        ],
        "name": "getTasksInRange",
        "outputs": [
            {
                "components": [
                    { "internalType": "uint256", "name": "baseReward", "type": "uint256" },
                    { "internalType": "bool", "name": "isActive", "type": "bool" },
                    { "internalType": "uint256", "name": "cooldown", "type": "uint256" },
                    { "internalType": "uint8", "name": "minTier", "type": "uint8" },
                    { "internalType": "string", "name": "title", "type": "string" },
                    { "internalType": "string", "name": "link", "type": "string" },
                    { "internalType": "uint256", "name": "createdAt", "type": "uint256" },
                    { "internalType": "bool", "name": "requiresVerification", "type": "bool" },
                    { "internalType": "uint256", "name": "sponsorshipId", "type": "uint256" }
                ],
                "internalType": "struct DailyAppV12Secured.Task[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "_taskId", "type": "uint256" }],
        "name": "getTask",
        "outputs": [
            { "internalType": "uint256", "name": "baseReward", "type": "uint256" },
            { "internalType": "bool", "name": "isActive", "type": "bool" },
            { "internalType": "uint256", "name": "cooldown", "type": "uint256" },
            { "internalType": "uint8", "name": "minTier", "type": "uint8" },
            { "internalType": "string", "name": "title", "type": "string" },
            { "internalType": "string", "name": "link", "type": "string" },
            { "internalType": "uint256", "name": "createdAt", "type": "uint256" },
            { "internalType": "bool", "name": "requiresVerification", "type": "bool" },
            { "internalType": "uint256", "name": "sponsorshipId", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "name": "claimableRewards",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "", "type": "address" },
            { "internalType": "uint256", "name": "", "type": "uint256" }
        ],
        "name": "hasCompletedTask",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "claimRewards",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "_user", "type": "address" },
            { "internalType": "uint256", "name": "_amount", "type": "uint256" }
        ],
        "name": "addClaimableReward",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "", "type": "address" },
            { "internalType": "uint256", "name": "", "type": "uint256" }
        ],
        "name": "userSponsorshipProgress",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "_user", "type": "address" },
            { "internalType": "uint256", "name": "_taskId", "type": "uint256" }
        ],
        "name": "isTaskVerified",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "nextTaskId",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getDailyTasks",
        "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "nextSponsorId",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "_sponsorId", "type": "uint256" }],
        "name": "getSponsorTasks",
        "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "name": "sponsorships",
        "outputs": [
            { "internalType": "string", "name": "name", "type": "string" },
            { "internalType": "uint256", "name": "totalTasks", "type": "uint256" },
            { "internalType": "bool", "name": "isActive", "type": "bool" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "name": "unsyncedPoints",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "syncMasterXPoints",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256[]", "name": "_taskIds", "type": "uint256[]" }],
        "name": "doBatchTasks",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "_taskId", "type": "uint256" },
            { "internalType": "address", "name": "_referrer", "type": "address" }
        ],
        "name": "doTask",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "name": "hasDoneTask",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "claimDailyBonus",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint8", "name": "_level", "type": "uint8" },
            { "internalType": "string[]", "name": "_titles", "type": "string[]" },
            { "internalType": "string[]", "name": "_links", "type": "string[]" },
            { "internalType": "string", "name": "_email", "type": "string" },
            { "internalType": "uint256", "name": "_rewardPoolAmount", "type": "uint256" },
            { "internalType": "address", "name": "_paymentToken", "type": "address" }
        ],
        "name": "buySponsorshipWithToken",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "_token", "type": "address" }],
        "name": "allowedPaymentTokens",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "_token", "type": "address" },
            { "internalType": "bool", "name": "_status", "type": "bool" }
        ],
        "name": "setAllowedToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "_reqId", "type": "uint256" }],
        "name": "renewSponsorship",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "name": "userStats",
        "outputs": [
            { "internalType": "uint256", "name": "points", "type": "uint256" },
            { "internalType": "uint256", "name": "totalTasksCompleted", "type": "uint256" },
            { "internalType": "uint256", "name": "referralCount", "type": "uint256" },
            { "internalType": "uint8", "name": "currentTier", "type": "uint8" },
            { "internalType": "uint256", "name": "tasksForReferralProgress", "type": "uint256" },
            { "internalType": "uint256", "name": "lastDailyBonusClaim", "type": "uint256" },
            { "internalType": "bool", "name": "isBlacklisted", "type": "bool" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint8", "name": "_level", "type": "uint8" },
            { "internalType": "string[]", "name": "_titles", "type": "string[]" },
            { "internalType": "string[]", "name": "_links", "type": "string[]" },
            { "internalType": "string", "name": "_email", "type": "string" }
        ],
        "name": "adminCreateSponsorship",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "_taskId", "type": "uint256" },
            { "internalType": "bool", "name": "_active", "type": "bool" }
        ],
        "name": "adminSetTaskActive",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

export const ERC20_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "spender", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
];

export const CONTRACTS = {
    // Master X: XP, Revenue Sharing, SBT tiers (LATEST DEPLOYED)
    MASTER_X: import.meta.env.VITE_MASTER_X_ADDRESS || "0x09b672B7B23ae226d80cD60777Ce7751fEbdd461",
    // Daily App V12: Tasks, Sponsorship, Daily Claim (LATEST DEPLOYED)
    DAILY_APP: import.meta.env.VITE_V12_CONTRACT_ADDRESS || "0x263e7dD71845C4C2B95D50859a7396C793C76435",
    // Raffle Contract (LATEST DEPLOYED)
    RAFFLE: import.meta.env.VITE_RAFFLE_ADDRESS || "0xE8b6333e40D9a5A6b4a1c83dB33f0CE73179292f",
    // Content CMS V2 (LATEST DEPLOYED)
    CMS: import.meta.env.VITE_CMS_CONTRACT_ADDRESS || "0x555D06933CC45038c42a1ba1F74140A5e4E0695d",
    // Tokens
    USDC: import.meta.env.VITE_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    CREATOR_TOKEN: import.meta.env.VITE_CREATOR_TOKEN_ADDRESS || "0x8bcf8b1959aaed2c33e55edc9d0b2633f7c7c35c",
};
