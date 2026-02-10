
// Standardized JSON ABIs for reliable contract interaction

export const DISCO_MASTER_ABI = [
    {
        "inputs": [],
        "name": "totalSBTPoolBalance",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "name": "users",
        "outputs": [
            { "internalType": "uint256", "name": "points", "type": "uint256" },
            { "internalType": "uint8", "name": "tier", "type": "uint8" },
            { "internalType": "uint256", "name": "lastClaimTimestamp", "type": "uint256" },
            { "internalType": "uint256", "name": "referralCount", "type": "uint256" },
            { "internalType": "bool", "name": "isVerified", "type": "bool" },
            { "internalType": "address", "name": "referrer", "type": "address" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "claimSBTRewards",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

export const CMS_CONTRACT_ABI = [
    {
        "inputs": [],
        "name": "getAnnouncement",
        "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getNews",
        "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getFeatureCards",
        "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "string", "name": "_json", "type": "string" }],
        "name": "updateAnnouncement",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

export const RAFFLE_ABI = [
    {
        "inputs": [
            { "internalType": "address[]", "name": "_nftContracts", "type": "address[]" },
            { "internalType": "uint256[]", "name": "_tokenIds", "type": "uint256[]" },
            { "internalType": "uint256", "name": "_duration", "type": "uint256" }
        ],
        "name": "createRaffle",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "_raffleId", "type": "uint256" },
            { "internalType": "uint256", "name": "_amount", "type": "uint256" },
            { "internalType": "bool", "name": "_useFreeTickets", "type": "bool" }
        ],
        "name": "buyTickets",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "_raffleId", "type": "uint256" }],
        "name": "getRaffleInfo",
        "outputs": [
            { "internalType": "uint256", "name": "raffleId", "type": "uint256" },
            { "internalType": "address", "name": "creator", "type": "address" },
            { "internalType": "uint256", "name": "startTime", "type": "uint256" },
            { "internalType": "uint256", "name": "endTime", "type": "uint256" },
            { "internalType": "uint256", "name": "ticketsSold", "type": "uint256" },
            { "internalType": "uint256", "name": "paidTicketsSold", "type": "uint256" },
            { "internalType": "bool", "name": "isActive", "type": "bool" },
            { "internalType": "bool", "name": "isCompleted", "type": "bool" },
            { "internalType": "address", "name": "winner", "type": "address" },
            { "internalType": "uint256", "name": "nftCount", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

export const V12_ABI = [
    {
        "inputs": [
            { "internalType": "uint256[]", "name": "_baseRewards", "type": "uint256[]" },
            { "internalType": "uint256[]", "name": "_cooldowns", "type": "uint256[]" },
            { "internalType": "enum DailyAppV12Secured.NFTTier[]", "name": "_minTiers", "type": "uint8[]" },
            { "internalType": "string[]", "name": "_titles", "type": "string[]" },
            { "internalType": "string[]", "name": "_links", "type": "string[]" },
            { "internalType": "bool[]", "name": "_requiresVerifications", "type": "bool[]" }
        ],
        "name": "addTaskBatch",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "_baseReward", "type": "uint256" },
            { "internalType": "uint256", "name": "_cooldown", "type": "uint256" },
            { "internalType": "uint8", "name": "_minTier", "type": "uint8" },
            { "internalType": "string", "name": "_title", "type": "string" },
            { "internalType": "string", "name": "_link", "type": "string" },
            { "internalType": "bool", "name": "_requiresVerification", "type": "bool" }
        ],
        "name": "addTask",
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
        "inputs": [],
        "name": "nextTaskId",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }],
        "name": "getUserStats",
        "outputs": [
            {
                "components": [
                    { "internalType": "uint256", "name": "points", "type": "uint256" },
                    { "internalType": "uint256", "name": "totalTasksCompleted", "type": "uint256" },
                    { "internalType": "uint256", "name": "referralCount", "type": "uint256" },
                    { "internalType": "uint8", "name": "currentTier", "type": "uint8" },
                    { "internalType": "uint256", "name": "tasksForReferralProgress", "type": "uint256" },
                    { "internalType": "uint256", "name": "lastDailyBonusClaim", "type": "uint256" },
                    { "internalType": "bool", "name": "isBlacklisted", "type": "bool" }
                ],
                "internalType": "struct DailyAppV12Secured.UserStats",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "_taskId", "type": "uint256" }],
        "name": "getTask",
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
                "internalType": "struct DailyAppV12Secured.Task",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

export const CHAINLINK_ORACLE_ABI = [
    {
        "inputs": [],
        "name": "latestRoundData",
        "outputs": [
            { "internalType": "uint80", "name": "roundId", "type": "uint80" },
            { "internalType": "int256", "name": "answer", "type": "int256" },
            { "internalType": "uint256", "name": "startedAt", "type": "uint256" },
            { "internalType": "uint256", "name": "updatedAt", "type": "uint256" },
            { "internalType": "uint80", "name": "answeredInRound", "type": "uint80" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
        "stateMutability": "view",
        "type": "function"
    }
];

