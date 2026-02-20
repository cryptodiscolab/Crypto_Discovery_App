export const MASTER_X_ABI = [
    // ── User Data ──────────────────────────────────────────────
    {
        "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "name": "users",
        "outputs": [
            { "internalType": "uint256", "name": "points", "type": "uint256" },
            { "internalType": "uint256", "name": "totalClaimed", "type": "uint256" },
            { "internalType": "uint256", "name": "lastClaimTime", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    // ── Tier Info ──────────────────────────────────────────────
    {
        "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
        "name": "getUserTier",
        "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "name": "userRewardDebt",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    // ── Accumulated Reward Per Share (indexed by SBTTier enum) ─
    {
        "inputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
        "name": "accRewardPerShare",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    // ── Pool Stats ─────────────────────────────────────────────
    {
        "inputs": [],
        "name": "totalSBTPoolBalance",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalLockedRewards",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "lastDistributeTimestamp",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    // ── Holder Counts ──────────────────────────────────────────
    {
        "inputs": [],
        "name": "diamondHolders",
        "outputs": [{ "internalType": "uint32", "name": "", "type": "uint32" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "platinumHolders",
        "outputs": [{ "internalType": "uint32", "name": "", "type": "uint32" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "goldHolders",
        "outputs": [{ "internalType": "uint32", "name": "", "type": "uint32" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "silverHolders",
        "outputs": [{ "internalType": "uint32", "name": "", "type": "uint32" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "bronzeHolders",
        "outputs": [{ "internalType": "uint32", "name": "", "type": "uint32" }],
        "stateMutability": "view",
        "type": "function"
    },
    // ── Pending Reward ─────────────────────────────────────────
    {
        "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
        "name": "pendingReward",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    // ── Claim ──────────────────────────────────────────────────
    {
        "inputs": [],
        "name": "claimReward",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    // ── Events ─────────────────────────────────────────────────
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "points", "type": "uint256" },
            { "indexed": false, "internalType": "string", "name": "reason", "type": "string" }
        ],
        "name": "PointsAwarded",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
            { "indexed": false, "internalType": "uint8", "name": "oldTier", "type": "uint8" },
            { "indexed": false, "internalType": "uint8", "name": "newTier", "type": "uint8" }
        ],
        "name": "TierUpdated",
        "type": "event"
    }
] as const;


export const DAILY_APP_ABI = [
    {
        "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "name": "tasks",
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
        "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "name": "sponsorRequests",
        "outputs": [
            { "internalType": "address", "name": "sponsor", "type": "address" },
            { "internalType": "uint8", "name": "level", "type": "uint8" },
            { "internalType": "string", "name": "contactEmail", "type": "string" },
            { "internalType": "uint256", "name": "rewardPool", "type": "uint256" },
            { "internalType": "uint8", "name": "status", "type": "uint8" },
            { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
        ],
        "stateMutability": "view",
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
        "name": "approveSponsorship",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "_fee", "type": "uint256" }],
        "name": "setSponsorshipPlatformFee",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "bool", "name": "_status", "type": "bool" }],
        "name": "setAutoApproveSponsorship",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "sponsorshipPlatformFee",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "autoApproveSponsorship",
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
        "inputs": [{ "internalType": "uint256[]", "name": "_taskIds", "type": "uint256[]" }],
        "name": "doBatchTasks",
        "outputs": [],
        "stateMutability": "nonpayable",
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
        "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "name": "unsyncedPoints",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
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
        "inputs": [],
        "name": "claimDailyBonus",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

export const CONTRACTS = {
    MASTER_X: process.env.NEXT_PUBLIC_MASTER_X_ADDRESS as `0x${string}`,
    DAILY_APP: process.env.NEXT_PUBLIC_DAILY_APP_ADDRESS as `0x${string}`,
};
