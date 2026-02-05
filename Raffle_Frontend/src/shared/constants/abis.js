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

// Content CMS V2 Contract ABI
export const CMS_CONTRACT_ABI = [
    // Content storage (view)
    "function announcementJSON() view returns (string)",
    "function newsJSON() view returns (string)",
    "function featureCardsJSON() view returns (string)",

    // Content getters (view)
    "function getAnnouncement() view returns (string)",
    "function getNews() view returns (string)",
    "function getFeatureCards() view returns (string)",

    // Content updates (write)
    "function updateAnnouncement(string) external",
    "function updateNews(string) external",
    "function updateFeatureCards(string) external",
    "function batchUpdate(string, string, string) external",

    // Role management (write)
    "function grantOperator(address) external",
    "function revokeOperator(address) external",

    // Role checks (view)
    "function isOperator(address) view returns (bool)",
    "function hasRole(bytes32, address) view returns (bool)",

    // Sponsored access whitelist (write)
    "function grantPrivilege(address, uint256) external",
    "function revokePrivilege(address, uint256) external",
    "function batchGrantPrivileges(address[], uint256[]) external",

    // Sponsored access checks (view)
    "function hasPrivilege(address, uint256) view returns (bool)",
    "function hasAccess(address, uint256) view returns (bool)",

    // Feature ID constants
    "function FEATURE_FREE_DAILY_TASK() view returns (uint256)",
    "function FEATURE_FREE_RAFFLE_TICKET() view returns (uint256)",
    "function FEATURE_PREMIUM_ACCESS() view returns (uint256)",

    // Events
    "event ContentUpdated(string contentType, uint256 timestamp)",
    "event BatchContentUpdated(uint256 timestamp)",
    "event PrivilegeGranted(address indexed user, uint256 indexed featureId, uint256 timestamp)",
    "event PrivilegeRevoked(address indexed user, uint256 indexed featureId, uint256 timestamp)",
    "event BatchPrivilegesGranted(uint256 userCount, uint256 timestamp)"
];


