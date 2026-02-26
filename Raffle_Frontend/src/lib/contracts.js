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
            { "internalType": "uint256", "name": "_rewardPoolAmount", "type": "uint256" }
        ],
        "name": "buySponsorshipWithToken",
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
    }
];

export const CONTRACTS = {
    MASTER_X: import.meta.env.VITE_CONTRACT_ADDRESS || "0xf074b0457d5c092bb67e62734B13C5f4cBC69e89",
    DAILY_APP: import.meta.env.VITE_V12_CONTRACT_ADDRESS || import.meta.env.VITE_CONTRACT_ADDRESS,
};

