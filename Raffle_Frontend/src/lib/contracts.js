import { DISCO_MASTER_ABI } from '../shared/constants/abis';

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
                    { "internalType": "enum DailyAppV12Secured.NFTTier", "name": "minTier", "type": "uint8" },
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
    }
];

export const CONTRACTS = {
    DAILY_APP: import.meta.env.VITE_V12_CONTRACT_ADDRESS || import.meta.env.VITE_CONTRACT_ADDRESS,
};
