export const DISCO_MASTER_ABI = [
    // Revenue Stats
    "function totalSBTPoolBalance() view returns (uint256)",
    "function maxGasPrice() view returns (uint256)",
    "function owner() view returns (address)",

    // User Data
    "function users(address) view returns (uint256 points, uint8 tier, uint256 lastClaimTimestamp, uint256 referralCount, bool isVerified, address referrer)",
    "function tierClaimablePerHolder(uint8 tier) view returns (uint256)",

    // Actions
    "function claimSBTRewards() external",
    "function distributeSBTPool() external",

    // Events
    "event SBTPoolDistributed(uint256 amount, uint256 timestamp)",
    "event ClaimProcessed(address indexed user, uint8 tier, uint256 amount)"
];
