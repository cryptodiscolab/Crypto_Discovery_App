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

// NFTRaffle Contract ABI
export const RAFFLE_ABI = [
    "function createRaffle(address[] calldata _nftContracts, uint256[] calldata _tokenIds, uint256 _duration) external",
    "function buyTickets(uint256 _raffleId, uint256 _amount, bool _useFreeTickets) external",
    "function drawWinner(uint256 _raffleId) external",
    "function claimPrizes(uint256 _raffleId) external",
    "function getRaffleInfo(uint256 _raffleId) external view returns (uint256 raffleId, address creator, uint256 startTime, uint256 endTime, uint256 ticketsSold, uint256 paidTicketsSold, bool isActive, bool isCompleted, address winner, uint256 nftCount)",
    "function getUserTickets(uint256 _raffleId, address _user) external view returns (uint256)",
    "function getUserInfo(address _user) external view returns (uint256 totalTicketsPurchased, uint256 totalWins, uint256 freeTicketsAvailable, uint256 lastFreeTicketClaim)",
    "function raffleIdCounter() external view returns (uint256)",
    "function ticketPrice() external view returns (uint256)",
    "function withdrawRaffleRevenue(uint256 _raffleId) external",
    "function withdrawFees() external",
    "function totalFees() external view returns (uint256)",
    "function owner() external view returns (address)"
];

// DailyApp V12 (Tasks & Points) ABI
export const V12_ABI = [
    "function doTask(uint256 _taskId, address _referrer) external",
    "function addTask(uint256 _baseReward, uint256 _cooldown, uint8 _minTier, string calldata _title, string calldata _link, bool _requiresVerification) external",
    "function markTaskAsVerified(address _user, uint256 _taskId) external",
    "function isTaskVerified(address _user, uint256 _taskId) external view returns (bool)",
    "function getUserStats(address _user) external view returns (uint256 points, uint256 totalTasksCompleted, uint256 referralCount, uint8 currentTier, uint256 tasksForReferralProgress, uint256 lastDailyBonusClaim, bool isBlacklisted)",
    "function getTask(uint256 _taskId) external view returns (uint256 baseReward, bool isActive, uint256 cooldown, uint8 minTier, string title, string link, uint256 createdAt, bool requiresVerification, uint256 sponsorshipId)",
    "function getContractStats() external view returns (uint256 totalUsers, uint256 totalTransactions, uint256 totalSponsors, uint256 contractTokenBalance, uint256 contractETHBalance)",
    "function nextTaskId() external view returns (uint256)",
    "function owner() external view returns (address)"
];
