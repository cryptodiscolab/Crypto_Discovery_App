// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DailyAppV15
 * @notice V15 Security Hardening — Fixes C-1, H-1, H-2, H-3, M-1, M-2, M-3 from Kiro Audit
 * @dev Changes from V14:
 *   - C-1: emergencyWithdraw now excludes totalOwedRewards
 *   - H-1: updateUserTier restricted to external callers only (no address(this))
 *   - H-2: burnPoints adds per-call cap (MAX_BURN_PER_CALL)
 *   - H-3: _update blocks burn path (to == address(0) also blocked for non-admin)
 *   - M-1: withdrawalFee tracked in accumulatedFees, withdrawable separately
 *   - M-2: updateUserTier gets nonReentrant
 *   - M-3: syncOffchainXP signature includes block.chainid + address(this)
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IMasterX {
    function addPoints(address user, uint256 points, string calldata reason) external;
}

contract DailyAppV15 is ERC721, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // --- CUSTOM ERRORS ---
    error InvalidTier();
    error Blacklisted();
    error InvalidAddress();
    error Unauthorized();
    error InvalidParameters();
    error MaxLimitReached();
    error NotFound();
    error TransferFailed();
    error BurnExceedsLimit(); // V15: H-2

    IERC20 public usdcToken;
    IERC20 public creatorToken;

    // --- ROLES ---
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // --- CONSTANTS ---
    uint256 public constant MAX_USERS = 1000000;
    uint256 public constant MAX_MULTIPLIER_BP = 100000;
    uint256 public constant MAX_TASK_REWARD = 10000;
    uint256 public constant REFERRAL_ACTIVATION_TASK_COUNT = 3;
    uint256 public constant MAX_DISCOUNT_PERCENT = 50;
    uint256 public constant MAX_BURN_PER_CALL = 50000; // V15: H-2 — max 50k points per burn

    // V14: All thresholds denominated in USDC 6-decimal base
    uint256 public sponsorshipPlatformFee = 2 * 10**6;
    bool public autoApproveSponsorship = true;
    uint256 public minRewardPoolValue = 2 * 10**6;
    uint256 public rewardPerClaim = 2 * 10**5;
    uint256 public tasksForReward = 3;
    uint256 public dailyBonusAmount = 100;
    uint256 public sponsorDuration = 3 days;
    uint256 public baseReferralReward = 50;
    uint256 public withdrawalFeeBP = 500;

    // --- ENUMS & STRUCTS ---
    enum NFTTier { NONE, BRONZE, SILVER, GOLD, PLATINUM, DIAMOND }
    enum SponsorLevel { BRONZE, SILVER, GOLD }
    enum RequestStatus { PENDING, APPROVED, REJECTED }

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

    struct SponsorRequest {
        address sponsor;
        SponsorLevel level;
        string[] titles;
        string[] links;
        string contactEmail;
        uint256 rewardPool;
        RequestStatus status;
        uint256 timestamp;
        address rewardToken;
        uint8 rewardDecimals;
    }

    struct TokenConfig {
        bool allowed;
        uint8 decimals;
        string symbol;
    }

    // --- STATE VARIABLES ---
    mapping(NFTTier => NFTConfig) public nftConfigs;
    mapping(uint256 => Task) public tasks;
    mapping(address => UserStats) public userStats;
    mapping(address => mapping(uint256 => uint256)) public lastTaskTime;
    mapping(address => address) public referrerOf;
    mapping(uint256 => SponsorRequest) public sponsorRequests;
    mapping(address => mapping(uint256 => bool)) public hasCompletedTask;
    mapping(address => mapping(address => uint256)) public claimableRewards;
    mapping(address => bool) private _hasJoined;
    mapping(NFTTier => string) public tierURIs;
    mapping(address => bool) public isValidReferrer;
    mapping(address => mapping(uint256 => uint256)) public userSponsorshipProgress;
    mapping(address => mapping(uint256 => bool)) public taskVerified;

    uint256 public userCount;
    uint256 public totalSponsorRequests;
    uint256 public nextTaskId = 2;

    uint256[3] public packagePricesUSD = [10 ether, 50 ether, 100 ether];
    uint256 public tokenPriceUSD = 0.01 ether;
    uint256 public currentDiscountPercent = 0;

    IMasterX public masterXContract;
    mapping(address => uint256) public unsyncedPoints;

    address public verifierWallet;
    mapping(address => uint256) public maxSyncedDbXp;

    mapping(address => TokenConfig) public tokenConfigs;
    mapping(address => bool) public allowedPaymentTokens;
    mapping(address => uint256) public lastActivityTime;

    // V15: Track total owed rewards to protect from emergency drain (C-1)
    mapping(address => uint256) public totalOwedPerToken;
    // V15: Track accumulated fees separately (M-1)
    mapping(address => uint256) public accumulatedFees;

    // --- EVENTS ---
    event TaskCompleted(address indexed user, uint256 taskId, uint256 reward, uint256 timestamp);
    event NewMemberJoined(address indexed user, address indexed referrer, uint256 timestamp);
    event SponsorshipRequested(uint256 indexed reqId, address indexed sponsor, SponsorLevel level, uint256 amount);
    event NFTMinted(address indexed user, NFTTier tier, uint256 tokenId);
    event NFTUpgraded(address indexed user, NFTTier fromTier, NFTTier toTier);
    event TaskAdded(uint256 indexed taskId, string title, uint256 baseReward, bool requiresVerification);
    event TaskUpdated(uint256 indexed taskId, bool isActive);
    event UserBlacklisted(address indexed user, bool status);
    event EmergencyWithdraw(address indexed token, uint256 amount);
    event TaskVerified(address indexed user, uint256 indexed taskId, uint256 timestamp);
    event ConfigUpdated(NFTTier indexed tier, uint256 pointsRequired, uint256 mintPrice, uint256 multiplierBP);
    event PointsSynced(address indexed user, uint256 points);
    event RewardsClaimed(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event FeesWithdrawn(address indexed token, uint256 amount);
    event SponsorshipApproved(uint256 indexed reqId, uint256 newTaskId);
    event SponsorshipRejected(uint256 indexed reqId, uint256 refundAmount, string reason);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event DiscountUpdated(uint256 oldDiscount, uint256 newDiscount);
    event TierURIUpdated(NFTTier indexed tier, string uri);
    event PaymentTokenUpdated(address indexed token, bool status);

    // --- MODIFIERS ---
    modifier validTier(NFTTier _tier) {
        if (_tier > NFTTier.DIAMOND) revert InvalidTier();
        _;
    }

    modifier notBlacklisted() {
        if (userStats[msg.sender].isBlacklisted) revert Blacklisted();
        _;
    }

    modifier validAddress(address _addr) {
        if (_addr == address(0)) revert InvalidAddress();
        _;
    }

    // --- CONSTRUCTOR ---
    constructor(address _tokenAddress, address _usdcToken, address initialOwner)
        ERC721("DailyApp Membership", "MEMBER")
        validAddress(_tokenAddress)
        validAddress(_usdcToken)
        validAddress(initialOwner)
    {
        creatorToken = IERC20(_tokenAddress);
        usdcToken = IERC20(_usdcToken);

        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(ADMIN_ROLE, initialOwner);

        tokenConfigs[address(0)] = TokenConfig(true, 18, "ETH");
        tokenConfigs[_tokenAddress] = TokenConfig(true, 18, "DISCO");
        tokenConfigs[_usdcToken] = TokenConfig(true, 6, "USDC");
        allowedPaymentTokens[_tokenAddress] = true;
        allowedPaymentTokens[address(0)] = true;
        allowedPaymentTokens[_usdcToken] = true;
    }

    // ═══════════════════════════════════════════════════════
    // V15 FIX: H-2 — burnPoints with per-call cap
    // ═══════════════════════════════════════════════════════
    function burnPoints(address _user, uint256 _amount) external {
        if (msg.sender != address(masterXContract) && !hasRole(ADMIN_ROLE, msg.sender)) revert Unauthorized();
        if (_amount > MAX_BURN_PER_CALL) revert BurnExceedsLimit();
        if (userStats[_user].points < _amount) revert Unauthorized();
        userStats[_user].points -= _amount;
    }

    // ═══════════════════════════════════════════════════════
    // V15 FIX: H-1 + M-2 — updateUserTier restricted + nonReentrant
    // ═══════════════════════════════════════════════════════
    function updateUserTier(address _user, NFTTier _tier) external nonReentrant {
        if (msg.sender != address(masterXContract) && !hasRole(ADMIN_ROLE, msg.sender)) revert Unauthorized();
        userStats[_user].currentTier = _tier;
        if (balanceOf(_user) == 0) {
            uint256 tokenId = uint256(uint160(_user));
            _mint(_user, tokenId);
            emit NFTMinted(_user, _tier, tokenId);
        } else {
            emit NFTUpgraded(_user, NFTTier.NONE, _tier);
        }
    }

    // ═══════════════════════════════════════════════════════
    // V15 FIX: M-1 — claimRewards tracks fees separately
    // ═══════════════════════════════════════════════════════
    function claimRewards(address _token) external whenNotPaused nonReentrant notBlacklisted {
        uint256 amount = claimableRewards[msg.sender][_token];
        if (amount == 0) revert Unauthorized();

        claimableRewards[msg.sender][_token] = 0;
        totalOwedPerToken[_token] -= amount; // V15: Decrease owed tracking

        uint256 fee = (amount * withdrawalFeeBP) / 10000;
        uint256 userAmount = amount - fee;
        accumulatedFees[_token] += fee; // V15: Track fee separately

        if (_token == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: userAmount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(_token).safeTransfer(msg.sender, userAmount);
        }

        emit RewardsClaimed(msg.sender, _token, userAmount, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════
    // V15 FIX: C-1 — emergencyWithdraw excludes owed rewards
    // ═══════════════════════════════════════════════════════
    function emergencyWithdraw(address _token, uint256 _amount)
        external
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        if (_token == address(0)) {
            uint256 balance = address(this).balance;
            uint256 owed = totalOwedPerToken[address(0)];
            uint256 available = balance > owed ? balance - owed : 0;
            uint256 amount = (_amount == 0 || _amount > available) ? available : _amount;
            if (amount == 0) revert InvalidParameters();
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            if (!success) revert TransferFailed();
            emit EmergencyWithdraw(address(0), amount);
        } else {
            IERC20 token = IERC20(_token);
            uint256 balance = token.balanceOf(address(this));
            uint256 owed = totalOwedPerToken[_token];
            uint256 available = balance > owed ? balance - owed : 0;
            uint256 amount = (_amount == 0 || _amount > available) ? available : _amount;
            if (amount == 0) revert InvalidParameters();
            token.safeTransfer(msg.sender, amount);
            emit EmergencyWithdraw(_token, amount);
        }
    }

    // V15: Admin can withdraw accumulated fees
    function withdrawFees(address _token) external onlyRole(ADMIN_ROLE) nonReentrant {
        uint256 fees = accumulatedFees[_token];
        if (fees == 0) revert InvalidParameters();
        accumulatedFees[_token] = 0;

        if (_token == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: fees}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(_token).safeTransfer(msg.sender, fees);
        }
        emit FeesWithdrawn(_token, fees);
    }

    // ═══════════════════════════════════════════════════════
    // V15 FIX: M-3 — syncOffchainXP includes chainid + contract address
    // ═══════════════════════════════════════════════════════
    function syncOffchainXP(uint256 totalDbXp, uint256 deadline, bytes calldata signature) external whenNotPaused nonReentrant notBlacklisted {
        if (block.timestamp > deadline) revert Unauthorized();
        if (verifierWallet == address(0)) revert InvalidAddress();
        if (totalDbXp <= maxSyncedDbXp[msg.sender]) revert Unauthorized();

        // V15: Include chainid + contract address to prevent cross-chain replay
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, totalDbXp, deadline, block.chainid, address(this)));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));

        address signer = ethSignedMessageHash.recover(signature);
        if (signer != verifierWallet) revert Unauthorized();

        uint256 diff = totalDbXp - maxSyncedDbXp[msg.sender];
        maxSyncedDbXp[msg.sender] = totalDbXp;
        userStats[msg.sender].points += diff;
        unsyncedPoints[msg.sender] += diff;

        emit PointsSynced(msg.sender, diff);
    }

    // ═══════════════════════════════════════════════════════
    // V15 FIX: H-3 — _update blocks ALL transfers including burn (except mint)
    // ═══════════════════════════════════════════════════════
    function _update(address to, uint256 tokenId, address auth)
        internal
        virtual
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        // Only allow minting (from == address(0)). Block transfer AND burn.
        if (from != address(0)) revert Unauthorized();
        return super._update(to, tokenId, auth);
    }

    // ═══════════════════════════════════════════════════════
    // V15: Internal helper to track owed rewards when adding claimable
    // ═══════════════════════════════════════════════════════
    function _addClaimableReward(address _user, address _token, uint256 _amount) internal {
        claimableRewards[_user][_token] += _amount;
        totalOwedPerToken[_token] += _amount;
    }

    // ═══════════════════════════════════════════════════════
    // ADMIN: NFT & SYSTEM CONFIGURATION
    // ═══════════════════════════════════════════════════════

    function setNFTConfigsBatch(
        NFTTier[] calldata _tiers,
        uint256[] calldata _pointsRequired,
        uint256[] calldata _mintPrices,
        uint256[] calldata _dailyBonuses,
        uint256[] calldata _multiplierBPs,
        uint256[] calldata _maxSupplies,
        bool[] calldata _isOpen
    ) external onlyRole(ADMIN_ROLE) {
        uint256 len = _tiers.length;
        if (len == 0 || len != _pointsRequired.length || len != _mintPrices.length || 
            len != _dailyBonuses.length || len != _multiplierBPs.length || 
            len != _maxSupplies.length || len != _isOpen.length) 
            revert InvalidParameters();

        for (uint256 i = 0; i < len; i++) {
            nftConfigs[_tiers[i]] = NFTConfig({
                pointsRequired: _pointsRequired[i],
                mintPrice: _mintPrices[i],
                dailyBonus: _dailyBonuses[i],
                multiplierBP: _multiplierBPs[i],
                maxSupply: _maxSupplies[i],
                currentSupply: nftConfigs[_tiers[i]].currentSupply,
                isOpen: _isOpen[i]
            });
        }
    }

    function setMasterX(address _masterX) external onlyRole(ADMIN_ROLE) validAddress(_masterX) {
        masterXContract = IMasterX(_masterX);
    }

    function setVerifierWallet(address _verifier) external onlyRole(ADMIN_ROLE) validAddress(_verifier) {
        verifierWallet = _verifier;
    }

    function batchMigrateUsers(
        address[] calldata _users, 
        UserStats[] calldata _stats,
        uint256[] calldata _maxSyncedXp
    ) external onlyRole(ADMIN_ROLE) {
        uint256 len = _users.length;
        if (len != _stats.length || len != _maxSyncedXp.length) revert InvalidParameters();

        for(uint i = 0; i < len; i++) {
            address u = _users[i];
            if (!_hasJoined[u]) {
                _hasJoined[u] = true;
                userCount++;
            }
            userStats[u] = _stats[i];
            maxSyncedDbXp[u] = _maxSyncedXp[i];
            if (_stats[i].currentTier != NFTTier.NONE && balanceOf(u) == 0) {
                uint256 tokenId = uint256(uint160(u));
                _mint(u, tokenId);
            }
        }
    }

    function addTask(
        uint256 _baseReward,
        uint256 _cooldown,
        NFTTier _minTier,
        string calldata _title,
        string calldata _link,
        bool _requiresVerification
    ) public onlyRole(ADMIN_ROLE) validTier(_minTier) {
        if (_baseReward == 0 || _baseReward > MAX_TASK_REWARD) revert InvalidParameters();
        if (_cooldown < 1 hours) revert InvalidParameters();
        if (bytes(_title).length == 0 || bytes(_title).length > 100) revert InvalidParameters();
        if (bytes(_link).length > 200) revert InvalidParameters();
        
        uint256 taskId = nextTaskId++;
        tasks[taskId] = Task({
            baseReward: _baseReward,
            isActive: false,
            cooldown: _cooldown,
            minTier: _minTier,
            title: _title,
            link: _link,
            createdAt: block.timestamp,
            requiresVerification: _requiresVerification,
            sponsorshipId: 0
        });
        emit TaskAdded(taskId, _title, _baseReward, _requiresVerification);
    }

    function addTaskBatch(
        uint256[] calldata _baseRewards,
        uint256[] calldata _cooldowns,
        NFTTier[] calldata _minTiers,
        string[] calldata _titles,
        string[] calldata _links,
        bool[] calldata _requiresVerifications
    ) external onlyRole(ADMIN_ROLE) {
        uint256 length = _baseRewards.length;
        if (length == 0) revert InvalidParameters();
        if (
            length != _cooldowns.length || 
            length != _minTiers.length || 
            length != _titles.length || 
            length != _links.length || 
            length != _requiresVerifications.length
        ) revert InvalidParameters();

        for (uint256 i = 0; i < length; i++) {
            addTask(_baseRewards[i], _cooldowns[i], _minTiers[i], _titles[i], _links[i], _requiresVerifications[i]);
        }
    }

    function setTaskActive(uint256 _taskId, bool _isActive) external onlyRole(ADMIN_ROLE) {
        if (tasks[_taskId].baseReward == 0) revert NotFound();
        tasks[_taskId].isActive = _isActive;
        emit TaskUpdated(_taskId, _isActive);
    }

    function markTaskAsVerified(address _user, uint256 _taskId) 
        external 
        onlyRole(VERIFIER_ROLE) 
        validAddress(_user)
    {
        if (tasks[_taskId].baseReward == 0) revert InvalidParameters();
        if (!tasks[_taskId].requiresVerification) revert InvalidParameters();
        if (taskVerified[_user][_taskId]) revert InvalidParameters();
        taskVerified[_user][_taskId] = true;
        emit TaskVerified(_user, _taskId, block.timestamp);
    }

    function isTaskVerified(address _user, uint256 _taskId) 
        external 
        view 
        returns (bool) 
    {
        return taskVerified[_user][_taskId];
    }

    function setPackagePricesUSD(uint256 _bronze, uint256 _silver, uint256 _gold) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (_bronze == 0 || _bronze >= _silver || _silver >= _gold) revert InvalidParameters();
        if (_gold > 1000 ether) revert InvalidParameters();
        packagePricesUSD[0] = _bronze;
        packagePricesUSD[1] = _silver;
        packagePricesUSD[2] = _gold;
    }

    function setPackagePricesUSD(uint256[3] calldata _prices) external onlyRole(ADMIN_ROLE) {
        packagePricesUSD = _prices;
    }

    function setDiscount(uint256 _percent) external onlyRole(ADMIN_ROLE) {
        if (_percent > MAX_DISCOUNT_PERCENT) revert InvalidParameters();
        uint256 oldDiscount = currentDiscountPercent;
        currentDiscountPercent = _percent;
        emit DiscountUpdated(oldDiscount, _percent);
    }

    function setTierURI(NFTTier _tier, string calldata _uri) 
        external 
        onlyRole(ADMIN_ROLE) 
        validTier(_tier) 
    {
        if (bytes(_uri).length == 0) revert InvalidParameters();
        tierURIs[_tier] = _uri;
        emit TierURIUpdated(_tier, _uri);
    }

    function updateNFTConfig(
        NFTTier _tier,
        uint256 _pointsRequired,
        uint256 _mintPrice,
        uint256 _multiplierBP,
        uint256 _dailyBonus,
        uint256 _maxSupply,
        bool _isOpen
    ) external onlyRole(ADMIN_ROLE) validTier(_tier) {
        if (_pointsRequired == 0) revert InvalidParameters();
        if (_multiplierBP < 10000 || _multiplierBP > MAX_MULTIPLIER_BP) revert InvalidParameters();
        NFTConfig storage config = nftConfigs[_tier];
        config.pointsRequired = _pointsRequired;
        config.mintPrice = _mintPrice;
        config.multiplierBP = _multiplierBP;
        config.dailyBonus = _dailyBonus;
        config.maxSupply = _maxSupply;
        config.isOpen = _isOpen;
        emit ConfigUpdated(_tier, _pointsRequired, _mintPrice, _multiplierBP);
    }

    function setTierStatus(NFTTier _tier, bool _status) external onlyRole(ADMIN_ROLE) validTier(_tier) {
        nftConfigs[_tier].isOpen = _status;
    }

    function setUserBlacklist(address _user, bool _status) 
        external 
        onlyRole(ADMIN_ROLE) 
        validAddress(_user) 
    {
        userStats[_user].isBlacklisted = _status;
        emit UserBlacklisted(_user, _status);
    }

    function setValidReferrer(address _referrer, bool _status) 
        external 
        onlyRole(ADMIN_ROLE) 
        validAddress(_referrer) 
    {
        isValidReferrer[_referrer] = _status;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function setSponsorshipPlatformFee(uint256 _fee) external onlyRole(ADMIN_ROLE) {
        sponsorshipPlatformFee = _fee;
    }

    function setAutoApproveSponsorship(bool _status) external onlyRole(ADMIN_ROLE) {
        autoApproveSponsorship = _status;
    }

    function setAllowedToken(address _token, bool _status, uint8 _decimals, string calldata _symbol) external onlyRole(ADMIN_ROLE) {
        tokenConfigs[_token] = TokenConfig(_status, _decimals, _symbol);
        allowedPaymentTokens[_token] = _status;
        emit PaymentTokenUpdated(_token, _status);
    }

    function setGlobalRewards(uint256 _daily, uint256 _referral) external onlyRole(ADMIN_ROLE) {
        dailyBonusAmount = _daily;
        baseReferralReward = _referral;
    }

    function setSponsorshipParams(
        uint256 _rewardPerClaim, 
        uint256 _tasksRequired, 
        uint256 _minPool,
        uint256 _platformFee
    ) external onlyRole(ADMIN_ROLE) {
        rewardPerClaim = _rewardPerClaim;
        tasksForReward = _tasksRequired;
        minRewardPoolValue = _minPool;
        sponsorshipPlatformFee = _platformFee;
    }

    function setWithdrawalFee(uint256 _feeBP) external onlyRole(ADMIN_ROLE) {
        if (_feeBP > 2000) revert InvalidParameters();
        withdrawalFeeBP = _feeBP;
    }

    function setCreatorToken(address _token) external onlyRole(ADMIN_ROLE) validAddress(_token) {
        creatorToken = IERC20(_token);
        allowedPaymentTokens[_token] = true;
    }

    function setUSDCToken(address _token) external onlyRole(ADMIN_ROLE) validAddress(_token) {
        usdcToken = IERC20(_token);
    }

    function setSponsorDuration(uint256 _duration) external onlyRole(ADMIN_ROLE) {
        if (_duration < 1 days || _duration > 30 days) revert InvalidParameters();
        sponsorDuration = _duration;
    }

    function setTokenPriceUSD(uint256 _price) external onlyRole(ADMIN_ROLE) {
        if (_price == 0) revert InvalidParameters();
        tokenPriceUSD = _price;
    }

    // ═══════════════════════════════════════════════════════
    // CORE: PRICING CALCULATION
    // ═══════════════════════════════════════════════════════

    function getCostInTokens(SponsorLevel _level) public view returns (uint256) {
        uint256 usdPrice = packagePricesUSD[uint256(_level)];
        if (usdPrice > type(uint256).max / 1e18) revert InvalidParameters();
        uint256 tokenAmount = (usdPrice * 1e18) / tokenPriceUSD;
        if (currentDiscountPercent > 0) {
            uint256 discountAmount = (tokenAmount * currentDiscountPercent) / 100;
            tokenAmount = tokenAmount - discountAmount;
        }
        return tokenAmount;
    }

    // ═══════════════════════════════════════════════════════
    // CORE: SPONSORSHIP SYSTEM
    // ═══════════════════════════════════════════════════════

    function buySponsorshipWithToken(
        SponsorLevel _level,
        string[] calldata _titles,
        string[] calldata _links,
        string calldata _email,
        uint256 _rewardPoolAmount,
        address _paymentToken
    ) external payable whenNotPaused nonReentrant notBlacklisted {
        if (_titles.length == 0 || _titles.length > 3) revert InvalidParameters();
        if (_titles.length != _links.length) revert InvalidParameters();

        TokenConfig memory tokenCfg = tokenConfigs[_paymentToken];
        if (!tokenCfg.allowed) revert InvalidParameters();

        uint256 normalized = _normalizeDecimals(_rewardPoolAmount, tokenCfg.decimals, 6);
        if (normalized < minRewardPoolValue) revert InvalidParameters();

        if (sponsorshipPlatformFee > 0) {
            usdcToken.safeTransferFrom(msg.sender, address(this), sponsorshipPlatformFee);
        }

        if (_paymentToken == address(0)) {
            if (msg.value < _rewardPoolAmount) revert InvalidParameters();
        } else {
            IERC20(_paymentToken).safeTransferFrom(msg.sender, address(this), _rewardPoolAmount);
        }

        uint256 reqId = ++totalSponsorRequests;
        SponsorRequest storage req = sponsorRequests[reqId];
        req.sponsor = msg.sender;
        req.level = _level;
        req.titles = _titles;
        req.links = _links;
        req.contactEmail = _email;
        req.rewardPool = _rewardPoolAmount;
        req.status = RequestStatus.PENDING;
        req.timestamp = block.timestamp;
        req.rewardToken = _paymentToken;
        req.rewardDecimals = tokenCfg.decimals;

        emit SponsorshipRequested(reqId, msg.sender, _level, _rewardPoolAmount);

        if (autoApproveSponsorship) {
            _approveSponsorshipInternal(reqId);
        }
    }

    function _approveSponsorshipInternal(uint256 _reqId) internal {}

    // Stubs removed in V15 to stay under 24KB: rejectSponsorship, approveSponsorship, 
    // renewSponsorship, adminCreateSponsorship (all had empty bodies in V14)

    // ═══════════════════════════════════════════════════════
    // CORE: TASK COMPLETION
    // ═══════════════════════════════════════════════════════

    function doTask(uint256 _taskId, address _referrer) 
        public 
        whenNotPaused 
        nonReentrant 
        notBlacklisted 
    {
        Task memory task = tasks[_taskId];
        UserStats storage stats = userStats[msg.sender];
        
        if (task.baseReward == 0) revert NotFound();
        if (!task.isActive) revert Unauthorized();
        if (stats.currentTier < task.minTier) revert InvalidTier();
        
        if (task.sponsorshipId > 0) {
            if (hasCompletedTask[msg.sender][_taskId]) revert Unauthorized();
        } else {
            if (block.timestamp < lastTaskTime[msg.sender][_taskId] + task.cooldown) revert Unauthorized();
        }
        
        if (task.requiresVerification && !taskVerified[msg.sender][_taskId]) revert Unauthorized();

        if (!_hasJoined[msg.sender]) {
            if (userCount >= MAX_USERS) revert MaxLimitReached();
            _hasJoined[msg.sender] = true;
            userCount++;
        }
        
        if (referrerOf[msg.sender] == address(0) && 
            _referrer != address(0) && 
            _referrer != msg.sender &&
            _hasJoined[_referrer]) {
            referrerOf[msg.sender] = _referrer;
            emit NewMemberJoined(msg.sender, _referrer, block.timestamp);
        }

        uint256 multiplier = nftConfigs[stats.currentTier].multiplierBP;
        if (multiplier == 0) multiplier = 10000;
        
        if (stats.currentTier == NFTTier.BRONZE || stats.currentTier == NFTTier.SILVER) {
            if (lastActivityTime[msg.sender] > 0 && block.timestamp <= lastActivityTime[msg.sender] + 48 hours) {
                multiplier = (multiplier * 11000) / 10000;
            }
        }
        lastActivityTime[msg.sender] = block.timestamp;
        
        uint256 reward = (task.baseReward * multiplier) / 10000;
        
        stats.points += reward;
        unsyncedPoints[msg.sender] += reward;
        stats.totalTasksCompleted++;
        stats.tasksForReferralProgress++;
        lastTaskTime[msg.sender][_taskId] = block.timestamp;
        
        if (task.requiresVerification) {
            taskVerified[msg.sender][_taskId] = false;
        }

        if (stats.tasksForReferralProgress == REFERRAL_ACTIVATION_TASK_COUNT) {
            address referrer = referrerOf[msg.sender];
            if (referrer != address(0) && !userStats[referrer].isBlacklisted) {
                userStats[referrer].points += baseReferralReward;
                userStats[referrer].referralCount++;
            }
        }
        
        if (task.sponsorshipId > 0) {
            hasCompletedTask[msg.sender][_taskId] = true;
            userSponsorshipProgress[msg.sender][task.sponsorshipId]++;
            uint256 currentProgress = userSponsorshipProgress[msg.sender][task.sponsorshipId];
            
            if (currentProgress % tasksForReward == 0) {
                SponsorRequest storage req = sponsorRequests[task.sponsorshipId];
                uint256 rewardNative = _normalizeDecimals(rewardPerClaim, 6, req.rewardDecimals);
                if (req.rewardPool >= rewardNative) {
                    req.rewardPool -= rewardNative;
                    _addClaimableReward(msg.sender, req.rewardToken, rewardNative);
                }
            }
        }
        
        emit TaskCompleted(msg.sender, _taskId, reward, block.timestamp);
    }

    function claimDailyBonus() external whenNotPaused nonReentrant notBlacklisted {
        UserStats storage stats = userStats[msg.sender];
        if (block.timestamp < stats.lastDailyBonusClaim + 24 hours) revert Unauthorized();
        stats.lastDailyBonusClaim = block.timestamp;
        stats.points += dailyBonusAmount;
        unsyncedPoints[msg.sender] += dailyBonusAmount;
        emit TaskCompleted(msg.sender, 0, dailyBonusAmount, block.timestamp);
    }

    function syncMasterXPoints() external whenNotPaused nonReentrant notBlacklisted {
        if (address(masterXContract) == address(0)) revert InvalidAddress();
        uint256 pointsToSync = unsyncedPoints[msg.sender];
        if (pointsToSync == 0) revert Unauthorized();
        unsyncedPoints[msg.sender] = 0;
        masterXContract.addPoints(msg.sender, pointsToSync, "DailyApp Sync");
        emit PointsSynced(msg.sender, pointsToSync);
    }

    // ═══════════════════════════════════════════════════════
    // CORE: NFT MINTING/UPGRADING
    // ═══════════════════════════════════════════════════════

    function mintNFT(NFTTier _tier) 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
        notBlacklisted 
        validTier(_tier)
    {
        _mintOrUpgrade(_tier);
    }

    function upgradeNFT() 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
        notBlacklisted 
    {
        NFTTier currentTier = userStats[msg.sender].currentTier;
        if (currentTier >= NFTTier.DIAMOND) revert MaxLimitReached();
        NFTTier nextTier = NFTTier(uint256(currentTier) + 1);
        _mintOrUpgrade(nextTier);
    }

    function _mintOrUpgrade(NFTTier _tier) internal {
        NFTConfig storage config = nftConfigs[_tier];
        UserStats storage stats = userStats[msg.sender];
        NFTTier currentTier = stats.currentTier;

        if (balanceOf(msg.sender) != 0 && currentTier >= _tier) revert Unauthorized();
        if (currentTier == _tier) revert Unauthorized();
        if (uint256(_tier) != uint256(currentTier) + 1) revert InvalidParameters();
        if (stats.points < config.pointsRequired) revert Unauthorized();
        if (msg.value < config.mintPrice) revert Unauthorized();
        if (!config.isOpen) revert Unauthorized();
        if (config.currentSupply >= config.maxSupply) revert MaxLimitReached();

        stats.points -= config.pointsRequired;
        config.currentSupply++;
        
        NFTTier oldTier = stats.currentTier;
        stats.currentTier = _tier;

        if (balanceOf(msg.sender) == 0) {
            uint256 tokenId = uint256(uint160(msg.sender));
            _mint(msg.sender, tokenId);
            emit NFTMinted(msg.sender, _tier, tokenId);
        } else {
            emit NFTUpgraded(msg.sender, oldTier, _tier);
        }
        
        if (msg.value > config.mintPrice) {
            uint256 refund = msg.value - config.mintPrice;
            (bool success, ) = payable(msg.sender).call{value: refund}("");
            if (!success) revert TransferFailed();
        }
    }

    function addClaimableReward(address _user, uint256 _amount, address _token) 
        external 
        onlyRole(ADMIN_ROLE) 
        validAddress(_user) 
    {
        if (_amount == 0) revert InvalidParameters();
        _addClaimableReward(_user, _token, _amount);
        emit RewardsClaimed(_user, _token, _amount, block.timestamp);
    }

    // doBatchTasks removed in V15 (empty body in V14, saves ~200 bytes)

    // ═══════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════

    function tokenURI(uint256 tokenId) 
        public 
        view 
        override 
        returns (string memory) 
    {
        _requireOwned(tokenId);
        address owner = ownerOf(tokenId);
        NFTTier tier = userStats[owner].currentTier;
        string memory uri = tierURIs[tier];
        if (bytes(uri).length == 0) revert NotFound();
        return uri;
    }

    function getTask(uint256 _taskId) 
        external 
        view 
        returns (Task memory) 
    {
        if (tasks[_taskId].baseReward == 0) revert NotFound();
        return tasks[_taskId];
    }

    // canDoTask removed in V15 (saves ~400 bytes, logic replicated off-chain in frontend)

    // ═══════════════════════════════════════════════════════
    // REQUIRED OVERRIDES
    // ═══════════════════════════════════════════════════════

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _normalizeDecimals(uint256 amount, uint8 fromDecimals, uint8 toDecimals) internal pure returns (uint256) {
        if (fromDecimals == toDecimals) return amount;
        if (fromDecimals > toDecimals) return amount / (10 ** (fromDecimals - toDecimals));
        return amount * (10 ** (toDecimals - fromDecimals));
    }

    receive() external payable {}
}
