// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title DailyAppV16
 * @notice Deployable all-on-chain XP ledger plus soulbound membership NFT.
 * @dev V16 intentionally drops V15 sponsorship/payment baggage to stay below
 *      the 24 KiB contract-size limit. Raffle, UGC, swap, and purchase systems
 *      award XP through role-gated channel functions.
 */
contract DailyAppV16 is UUPSUpgradeable {
    error InvalidTier();
    error Blacklisted();
    error InvalidAddress();
    error Unauthorized();
    error InvalidParameters();
    error MaxLimitReached();
    error NotFound();
    error TransferFailed();
    error BurnExceedsLimit();
    error RateLimitReached();

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant RAFFLE_ROLE = keccak256("RAFFLE_ROLE");
    bytes32 public constant SOCIAL_ROLE = keccak256("SOCIAL_ROLE");
    bytes32 public constant UGC_ROLE = keccak256("UGC_ROLE");
    bytes32 public constant MOJO_ROLE = keccak256("MOJO_ROLE");
    bytes32 public constant SWAP_ROLE = keccak256("SWAP_ROLE");
    bytes32 public constant PURCHASE_ROLE = keccak256("PURCHASE_ROLE");

    uint256 public constant MAX_USERS = 1_000_000;
    uint256 public constant MAX_MULTIPLIER_BP = 15_000;
    uint256 public constant MAX_TASK_REWARD = 10_000;
    uint256 public constant REFERRAL_ACTIVATION_TASK_COUNT = 3;
    uint256 public constant MAX_BURN_PER_CALL = 50_000;
    uint256 public constant MAX_BATCH_SIZE = 200;
    uint256 public constant EPOCH_DURATION = 24 hours;
    uint256 public constant MAX_RAFFLE_XP_PER_EPOCH = 5_000;
    uint256 public constant MAX_SOCIAL_XP_PER_EPOCH = 2_000;
    uint256 public constant MAX_UGC_XP_PER_EPOCH = 10_000;
    uint256 public constant MAX_MOJO_XP_PER_EPOCH = 500;
    uint256 public constant MAX_SWAP_XP_PER_EPOCH = 3_000;
    uint256 public constant MAX_PURCHASE_XP_PER_EPOCH = 5_000;

    enum NFTTier { NONE, BRONZE, SILVER, GOLD, PLATINUM, DIAMOND }
    enum XpSource {
        DAILY_BONUS,
        ONCHAIN_TASK,
        REFERRAL,
        RAFFLE_BUY,
        RAFFLE_WIN,
        SOCIAL_TASK,
        UGC_TASK,
        UGC_RAFFLE,
        MOJO,
        SWAP,
        PURCHASE,
        ADMIN_AWARD
    }

    struct NFTConfig {
        uint256 pointsRequired;
        uint256 mintPrice;
        uint256 dailyBonus;
        uint256 multiplierBP;
        uint256 maxSupply;
        uint256 currentSupply;
        bool isOpen;
    }

    struct Task {
        uint256 baseReward;
        bool isActive;
        uint256 cooldown;
        NFTTier minTier;
        string title;
        string link;
        uint256 createdAt;
        bool requiresVerification;
        uint256 sponsorshipId;
    }

    struct UserStats {
        uint256 points;
        uint256 totalTasksCompleted;
        uint256 referralCount;
        NFTTier currentTier;
        uint256 tasksForReferralProgress;
        uint256 lastDailyBonusClaim;
        bool isBlacklisted;
    }

    struct EpochTracker {
        uint256 start;
        uint256 spent;
    }

    string public name;
    string public symbol;
    address public creatorToken;
    address public usdcToken;
    address public masterXContract;

    uint256 public userCount;
    uint256 public nextTaskId;
    uint256 public dailyBonusAmount;
    uint256 public baseReferralReward;

    mapping(bytes32 => mapping(address => bool)) private _roles;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;

    mapping(NFTTier => NFTConfig) public nftConfigs;
    mapping(uint256 => Task) public tasks;
    mapping(address => UserStats) public userStats;
    mapping(address => mapping(uint256 => uint256)) public lastTaskTime;
    mapping(address => address) public referrerOf;
    mapping(address => mapping(uint256 => bool)) public hasCompletedTask;
    mapping(address => bool) private _hasJoined;
    mapping(NFTTier => string) public tierURIs;
    mapping(address => mapping(uint256 => bool)) public taskVerified;
    mapping(address => uint256) public lastActivityTime;
    mapping(address => EpochTracker) public raffleEpoch;
    mapping(address => EpochTracker) public socialEpoch;
    mapping(address => EpochTracker) public ugcEpoch;
    mapping(address => EpochTracker) public mojoEpoch;
    mapping(address => EpochTracker) public swapEpoch;
    mapping(address => EpochTracker) public purchaseEpoch;
    mapping(address => uint256) public lifetimeXp;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    event TaskCompleted(address indexed user, uint256 taskId, uint256 reward, uint256 timestamp);
    event NewMemberJoined(address indexed user, address indexed referrer, uint256 timestamp);
    event NFTMinted(address indexed user, NFTTier tier, uint256 tokenId);
    event NFTUpgraded(address indexed user, NFTTier fromTier, NFTTier toTier);
    event TaskAdded(uint256 indexed taskId, string title, uint256 baseReward, bool requiresVerification);
    event TaskUpdated(uint256 indexed taskId, bool isActive);
    event TaskVerified(address indexed user, uint256 indexed taskId, uint256 timestamp);
    event UserBlacklisted(address indexed user, bool status);
    event ConfigUpdated(NFTTier indexed tier, uint256 pointsRequired, uint256 mintPrice, uint256 multiplierBP);
    event TierURIUpdated(NFTTier indexed tier, string uri);
    event XpAwarded(address indexed user, uint256 amount, XpSource indexed source, uint256 newTotal, uint256 timestamp);
    event TreasuryWithdrawn(address indexed to, uint256 amount);

    modifier onlyRole(bytes32 role) {
        if (!hasRole(role, msg.sender)) revert Unauthorized();
        _;
    }

    modifier notBlacklisted() {
        if (userStats[msg.sender].isBlacklisted) revert Blacklisted();
        _;
    }

    modifier validAddress(address account) {
        if (account == address(0)) revert InvalidAddress();
        _;
    }

    modifier validTier(NFTTier tier) {
        if (tier > NFTTier.DIAMOND) revert InvalidTier();
        _;
    }

    // ── Minimal Pausable (avoids PausableUpgradeable import to stay < 24 KiB) ──
    bool private _paused;
    event Paused(address account);
    event Unpaused(address account);

    modifier whenNotPaused() {
        if (_paused) revert Unauthorized();
        _;
    }

    // ── Minimal ReentrancyGuard (avoids extra import) ──
    bool private _locked;

    modifier nonReentrant() {
        if (_locked) revert Unauthorized();
        _locked = true;
        _;
        _locked = false;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address tokenAddress, address usdcAddress, address initialOwner)
        public
        initializer
        validAddress(tokenAddress)
        validAddress(usdcAddress)
        validAddress(initialOwner)
    {
        __UUPSUpgradeable_init();

        name = "DailyApp Membership";
        symbol = "MEMBER";
        creatorToken = tokenAddress;
        usdcToken = usdcAddress;
        dailyBonusAmount = 100;
        baseReferralReward = 50;
        nextTaskId = 2;

        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(ADMIN_ROLE, initialOwner);
    }

    function _authorizeUpgrade(address) internal override onlyRole(ADMIN_ROLE) {}

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    function grantRole(bytes32 role, address account) public onlyRole(ADMIN_ROLE) validAddress(account) {
        _grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) public onlyRole(ADMIN_ROLE) {
        if (_roles[role][account]) {
            _roles[role][account] = false;
            emit RoleRevoked(role, account, msg.sender);
        }
    }

    function _grantRole(bytes32 role, address account) internal {
        if (!_roles[role][account]) {
            _roles[role][account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }

    function grantRaffleRole(address bot) external onlyRole(ADMIN_ROLE) { _grantRole(RAFFLE_ROLE, bot); }
    function grantSocialRole(address bot) external onlyRole(ADMIN_ROLE) { _grantRole(SOCIAL_ROLE, bot); }
    function grantUgcRole(address bot) external onlyRole(ADMIN_ROLE) { _grantRole(UGC_ROLE, bot); }
    function grantMojoRole(address bot) external onlyRole(ADMIN_ROLE) { _grantRole(MOJO_ROLE, bot); }
    function grantSwapRole(address bot) external onlyRole(ADMIN_ROLE) { _grantRole(SWAP_ROLE, bot); }
    function grantPurchaseRole(address bot) external onlyRole(ADMIN_ROLE) { _grantRole(PURCHASE_ROLE, bot); }
    function grantVerifierRole(address bot) external onlyRole(ADMIN_ROLE) { _grantRole(VERIFIER_ROLE, bot); }

    function balanceOf(address owner) public view validAddress(owner) returns (uint256) {
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        if (owner == address(0)) revert NotFound();
        return owner;
    }

    function tokenURI(uint256 tokenId) public view returns (string memory) {
        NFTTier tier = userStats[ownerOf(tokenId)].currentTier;
        string memory uri = tierURIs[tier];
        if (bytes(uri).length == 0) revert NotFound();
        return uri;
    }

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f;
    }

    function approve(address, uint256) external pure { revert Unauthorized(); }
    function setApprovalForAll(address, bool) external pure { revert Unauthorized(); }
    function transferFrom(address, address, uint256) external pure { revert Unauthorized(); }
    function safeTransferFrom(address, address, uint256) external pure { revert Unauthorized(); }
    function safeTransferFrom(address, address, uint256, bytes calldata) external pure { revert Unauthorized(); }
    function getApproved(uint256) external pure returns (address) { return address(0); }
    function isApprovedForAll(address, address) external pure returns (bool) { return false; }

    function _mint(address to, uint256 tokenId) internal validAddress(to) {
        if (_owners[tokenId] != address(0) || _balances[to] != 0) revert Unauthorized();
        _owners[tokenId] = to;
        _balances[to] = 1;
        emit Transfer(address(0), to, tokenId);
    }

    function _creditXp(address user, uint256 amount, XpSource source) internal validAddress(user) {
        if (amount == 0) revert InvalidParameters();
        userStats[user].points += amount;
        lifetimeXp[user] += amount;
        emit XpAwarded(user, amount, source, userStats[user].points, block.timestamp);
    }

    function _awardXp(address user, uint256 amount, XpSource source, EpochTracker storage epoch, uint256 maxPerEpoch)
        internal
    {
        if (block.timestamp >= epoch.start + EPOCH_DURATION) {
            epoch.start = block.timestamp;
            epoch.spent = 0;
        }
        if (epoch.spent + amount > maxPerEpoch) revert RateLimitReached();
        epoch.spent += amount;
        _creditXp(user, amount, source);
    }

    function awardRaffleBuyXp(address user, uint256 tickets) external onlyRole(RAFFLE_ROLE) {
        _awardXp(user, tickets * 15, XpSource.RAFFLE_BUY, raffleEpoch[user], MAX_RAFFLE_XP_PER_EPOCH);
    }

    function awardRaffleWinXp(address user) external onlyRole(RAFFLE_ROLE) {
        _awardXp(user, 100, XpSource.RAFFLE_WIN, raffleEpoch[user], MAX_RAFFLE_XP_PER_EPOCH);
    }

    function awardSocialXp(address user, uint256 amount) external {
        if (!hasRole(SOCIAL_ROLE, msg.sender) && !hasRole(VERIFIER_ROLE, msg.sender)) revert Unauthorized();
        _awardXp(user, amount, XpSource.SOCIAL_TASK, socialEpoch[user], MAX_SOCIAL_XP_PER_EPOCH);
    }

    function awardUgcTaskXp(address user, uint256 amount) external onlyRole(UGC_ROLE) {
        _awardXp(user, amount, XpSource.UGC_TASK, ugcEpoch[user], MAX_UGC_XP_PER_EPOCH);
    }

    function awardUgcRaffleXp(address user, uint256 amount) external onlyRole(UGC_ROLE) {
        _awardXp(user, amount, XpSource.UGC_RAFFLE, ugcEpoch[user], MAX_UGC_XP_PER_EPOCH);
    }

    function awardMojoXp(address user, uint256 amount) external onlyRole(MOJO_ROLE) {
        _awardXp(user, amount, XpSource.MOJO, mojoEpoch[user], MAX_MOJO_XP_PER_EPOCH);
    }

    function awardSwapXp(address user, uint256 volumeInUsd) external onlyRole(SWAP_ROLE) {
        uint256 xp = volumeInUsd / (10 * 10**6);
        if (xp < 5) xp = 5;
        _awardXp(user, xp, XpSource.SWAP, swapEpoch[user], MAX_SWAP_XP_PER_EPOCH);
    }

    function awardPurchaseXp(address user, uint256 amountInUsd) external onlyRole(PURCHASE_ROLE) {
        _awardXp(user, (amountInUsd * 2) / 1e6, XpSource.PURCHASE, purchaseEpoch[user], MAX_PURCHASE_XP_PER_EPOCH);
    }

    function awardAdminBatchXp(address[] calldata users, uint256[] calldata amounts, XpSource source)
        external
        onlyRole(ADMIN_ROLE)
    {
        uint256 len = users.length;
        if (len == 0 || len > MAX_BATCH_SIZE || len != amounts.length) revert InvalidParameters();
        for (uint256 i = 0; i < len; i++) {
            _creditXp(users[i], amounts[i], source);
        }
    }

    function doTask(uint256 taskId, address referrer) external notBlacklisted whenNotPaused {
        Task memory task = tasks[taskId];
        UserStats storage stats = userStats[msg.sender];

        if (task.baseReward == 0) revert NotFound();
        if (!task.isActive) revert Unauthorized();
        if (stats.currentTier < task.minTier) revert InvalidTier();
        if (hasCompletedTask[msg.sender][taskId]) revert Unauthorized();
        if (block.timestamp < lastTaskTime[msg.sender][taskId] + task.cooldown) revert Unauthorized();
        if (task.requiresVerification && !taskVerified[msg.sender][taskId]) revert Unauthorized();

        _joinIfNeeded(msg.sender);

        if (referrerOf[msg.sender] == address(0) && referrer != address(0) && referrer != msg.sender && _hasJoined[referrer]) {
            referrerOf[msg.sender] = referrer;
            emit NewMemberJoined(msg.sender, referrer, block.timestamp);
        }

        uint256 multiplier = nftConfigs[stats.currentTier].multiplierBP;
        if (multiplier == 0) multiplier = 10_000;
        if (stats.currentTier == NFTTier.BRONZE || stats.currentTier == NFTTier.SILVER) {
            if (lastActivityTime[msg.sender] > 0 && block.timestamp <= lastActivityTime[msg.sender] + 48 hours) {
                multiplier = (multiplier * 11_000) / 10_000;
                if (multiplier > MAX_MULTIPLIER_BP) multiplier = MAX_MULTIPLIER_BP;
            }
        }

        lastActivityTime[msg.sender] = block.timestamp;
        uint256 reward = (task.baseReward * multiplier) / 10_000;
        _creditXp(msg.sender, reward, XpSource.ONCHAIN_TASK);

        stats.totalTasksCompleted++;
        stats.tasksForReferralProgress++;
        lastTaskTime[msg.sender][taskId] = block.timestamp;
        hasCompletedTask[msg.sender][taskId] = task.sponsorshipId > 0;

        if (task.requiresVerification) taskVerified[msg.sender][taskId] = false;
        if (stats.tasksForReferralProgress == REFERRAL_ACTIVATION_TASK_COUNT) {
            address savedReferrer = referrerOf[msg.sender];
            if (savedReferrer != address(0) && !userStats[savedReferrer].isBlacklisted) {
                _creditXp(savedReferrer, baseReferralReward, XpSource.REFERRAL);
                userStats[savedReferrer].referralCount++;
            }
        }

        emit TaskCompleted(msg.sender, taskId, reward, block.timestamp);
    }

    /// @notice Emergency pause — stops doTask, claimDailyBonus, mintNFT, upgradeNFT
    function pause() external onlyRole(ADMIN_ROLE) {
        _paused = true;
        emit Paused(msg.sender);
    }

    function paused() public view returns (bool) {
        return _paused;
    }

    /// @notice Resume contract operations
    function unpause() external onlyRole(ADMIN_ROLE) {
        _paused = false;
        emit Unpaused(msg.sender);
    }

    function claimDailyBonus() external notBlacklisted whenNotPaused {
        UserStats storage stats = userStats[msg.sender];
        if (block.timestamp < stats.lastDailyBonusClaim + 24 hours) revert Unauthorized();
        _joinIfNeeded(msg.sender);
        stats.lastDailyBonusClaim = block.timestamp;
        _creditXp(msg.sender, dailyBonusAmount, XpSource.DAILY_BONUS);
        emit TaskCompleted(msg.sender, 0, dailyBonusAmount, block.timestamp);
    }

    function _joinIfNeeded(address user) internal {
        if (!_hasJoined[user]) {
            if (userCount >= MAX_USERS) revert MaxLimitReached();
            _hasJoined[user] = true;
            userCount++;
        }
    }

    function markTaskAsVerified(address user, uint256 taskId) external onlyRole(VERIFIER_ROLE) validAddress(user) {
        if (tasks[taskId].baseReward == 0 || !tasks[taskId].requiresVerification || taskVerified[user][taskId]) {
            revert InvalidParameters();
        }
        taskVerified[user][taskId] = true;
        emit TaskVerified(user, taskId, block.timestamp);
    }

    function isTaskVerified(address user, uint256 taskId) external view returns (bool) {
        return taskVerified[user][taskId];
    }

    function mintNFT(NFTTier tier) external payable notBlacklisted validTier(tier) whenNotPaused {
        _mintOrUpgrade(tier);
    }

    function upgradeNFT() external payable notBlacklisted whenNotPaused {
        NFTTier currentTier = userStats[msg.sender].currentTier;
        if (currentTier >= NFTTier.DIAMOND) revert MaxLimitReached();
        _mintOrUpgrade(NFTTier(uint256(currentTier) + 1));
    }

    function _mintOrUpgrade(NFTTier tier) internal {
        NFTConfig storage config = nftConfigs[tier];
        UserStats storage stats = userStats[msg.sender];
        NFTTier currentTier = stats.currentTier;

        if (currentTier == tier || uint256(tier) != uint256(currentTier) + 1) revert InvalidParameters();
        if (stats.points < config.pointsRequired || msg.value < config.mintPrice || !config.isOpen) revert Unauthorized();
        if (config.currentSupply >= config.maxSupply) revert MaxLimitReached();

        stats.points -= config.pointsRequired;
        config.currentSupply++;
        stats.currentTier = tier;

        if (balanceOf(msg.sender) == 0) {
            uint256 tokenId = uint256(uint160(msg.sender));
            _mint(msg.sender, tokenId);
            emit NFTMinted(msg.sender, tier, tokenId);
        } else {
            emit NFTUpgraded(msg.sender, currentTier, tier);
        }

        if (msg.value > config.mintPrice) {
            (bool ok, ) = payable(msg.sender).call{value: msg.value - config.mintPrice}("");
            if (!ok) revert TransferFailed();
        }
    }

    function burnPoints(address user, uint256 amount) external {
        if (msg.sender != masterXContract && !hasRole(ADMIN_ROLE, msg.sender)) revert Unauthorized();
        if (amount > MAX_BURN_PER_CALL) revert BurnExceedsLimit();
        if (userStats[user].points < amount) revert Unauthorized();
        userStats[user].points -= amount;
    }

    function updateUserTier(address user, NFTTier tier) external validAddress(user) validTier(tier) {
        if (msg.sender != masterXContract && !hasRole(ADMIN_ROLE, msg.sender)) revert Unauthorized();
        NFTTier oldTier = userStats[user].currentTier;
        userStats[user].currentTier = tier;
        if (tier != NFTTier.NONE && balanceOf(user) == 0) {
            uint256 tokenId = uint256(uint160(user));
            _mint(user, tokenId);
            emit NFTMinted(user, tier, tokenId);
        } else {
            emit NFTUpgraded(user, oldTier, tier);
        }
    }

    function batchMigrateUsers(address[] calldata users, UserStats[] calldata stats) external onlyRole(ADMIN_ROLE) {
        uint256 len = users.length;
        if (len == 0 || len > MAX_BATCH_SIZE || len != stats.length) revert InvalidParameters();
        for (uint256 i = 0; i < len; i++) {
            address user = users[i];
            if (user == address(0)) revert InvalidAddress();
            _joinIfNeeded(user);
            userStats[user] = stats[i];
            if (lifetimeXp[user] < stats[i].points) lifetimeXp[user] = stats[i].points;
            if (stats[i].currentTier != NFTTier.NONE && balanceOf(user) == 0) {
                _mint(user, uint256(uint160(user)));
            }
        }
    }

    function addTask(
        uint256 baseReward,
        uint256 cooldown,
        NFTTier minTier,
        string calldata title,
        string calldata link,
        bool requiresVerification
    ) public onlyRole(ADMIN_ROLE) validTier(minTier) {
        if (baseReward == 0 || baseReward > MAX_TASK_REWARD || cooldown < 1 hours) revert InvalidParameters();
        if (bytes(title).length == 0 || bytes(title).length > 100 || bytes(link).length > 200) revert InvalidParameters();

        uint256 taskId = nextTaskId++;
        tasks[taskId] = Task(baseReward, false, cooldown, minTier, title, link, block.timestamp, requiresVerification, 0);
        emit TaskAdded(taskId, title, baseReward, requiresVerification);
    }

    function addTaskBatch(
        uint256[] calldata baseRewards,
        uint256[] calldata cooldowns,
        NFTTier[] calldata minTiers,
        string[] calldata titles,
        string[] calldata links,
        bool[] calldata requiresVerifications
    ) external onlyRole(ADMIN_ROLE) {
        uint256 len = baseRewards.length;
        if (len == 0 || len > MAX_BATCH_SIZE || len != cooldowns.length || len != minTiers.length ||
            len != titles.length || len != links.length || len != requiresVerifications.length) {
            revert InvalidParameters();
        }
        for (uint256 i = 0; i < len; i++) {
            addTask(baseRewards[i], cooldowns[i], minTiers[i], titles[i], links[i], requiresVerifications[i]);
        }
    }

    function setTaskActive(uint256 taskId, bool isActive) external onlyRole(ADMIN_ROLE) {
        if (tasks[taskId].baseReward == 0) revert NotFound();
        tasks[taskId].isActive = isActive;
        emit TaskUpdated(taskId, isActive);
    }

    function getTask(uint256 taskId) external view returns (Task memory) {
        if (tasks[taskId].baseReward == 0) revert NotFound();
        return tasks[taskId];
    }

    function setNFTConfigsBatch(
        NFTTier[] calldata tiers,
        uint256[] calldata pointsRequired,
        uint256[] calldata mintPrices,
        uint256[] calldata dailyBonuses,
        uint256[] calldata multiplierBPs,
        uint256[] calldata maxSupplies,
        bool[] calldata isOpen
    ) external onlyRole(ADMIN_ROLE) {
        uint256 len = tiers.length;
        if (len == 0 || len > MAX_BATCH_SIZE || len != pointsRequired.length || len != mintPrices.length ||
            len != dailyBonuses.length || len != multiplierBPs.length || len != maxSupplies.length ||
            len != isOpen.length) {
            revert InvalidParameters();
        }
        for (uint256 i = 0; i < len; i++) {
            _setNFTConfig(tiers[i], pointsRequired[i], mintPrices[i], dailyBonuses[i], multiplierBPs[i], maxSupplies[i], isOpen[i]);
        }
    }

    function updateNFTConfig(
        NFTTier tier,
        uint256 pointsRequired,
        uint256 mintPrice,
        uint256 multiplierBP,
        uint256 dailyBonus,
        uint256 maxSupply,
        bool isOpen
    ) external onlyRole(ADMIN_ROLE) {
        _setNFTConfig(tier, pointsRequired, mintPrice, dailyBonus, multiplierBP, maxSupply, isOpen);
    }

    function _setNFTConfig(
        NFTTier tier,
        uint256 pointsRequired,
        uint256 mintPrice,
        uint256 dailyBonus,
        uint256 multiplierBP,
        uint256 maxSupply,
        bool isOpen
    ) internal validTier(tier) {
        if (pointsRequired == 0 || multiplierBP < 10_000 || multiplierBP > MAX_MULTIPLIER_BP) revert InvalidParameters();
        nftConfigs[tier] = NFTConfig(pointsRequired, mintPrice, dailyBonus, multiplierBP, maxSupply, nftConfigs[tier].currentSupply, isOpen);
        emit ConfigUpdated(tier, pointsRequired, mintPrice, multiplierBP);
    }

    function setTierURI(NFTTier tier, string calldata uri) external onlyRole(ADMIN_ROLE) validTier(tier) {
        if (bytes(uri).length == 0) revert InvalidParameters();
        tierURIs[tier] = uri;
        emit TierURIUpdated(tier, uri);
    }

    function setTierStatus(NFTTier tier, bool status) external onlyRole(ADMIN_ROLE) validTier(tier) {
        nftConfigs[tier].isOpen = status;
    }

    function setUserBlacklist(address user, bool status) external onlyRole(ADMIN_ROLE) validAddress(user) {
        userStats[user].isBlacklisted = status;
        emit UserBlacklisted(user, status);
    }

    function setGlobalRewards(uint256 daily, uint256 referral) external onlyRole(ADMIN_ROLE) {
        dailyBonusAmount = daily;
        baseReferralReward = referral;
    }

    function setMasterX(address masterX) external onlyRole(ADMIN_ROLE) validAddress(masterX) {
        masterXContract = masterX;
    }

    function setCreatorToken(address token) external onlyRole(ADMIN_ROLE) validAddress(token) {
        creatorToken = token;
    }

    function setUSDCToken(address token) external onlyRole(ADMIN_ROLE) validAddress(token) {
        usdcToken = token;
    }

    function withdrawTreasury(address payable to, uint256 amount) external onlyRole(ADMIN_ROLE) validAddress(to) nonReentrant {
        uint256 value = amount == 0 ? address(this).balance : amount;
        if (value == 0 || value > address(this).balance) revert InvalidParameters();
        (bool ok, ) = to.call{value: value}("");
        if (!ok) revert TransferFailed();
        emit TreasuryWithdrawn(to, value);
    }

    receive() external payable {}
}
