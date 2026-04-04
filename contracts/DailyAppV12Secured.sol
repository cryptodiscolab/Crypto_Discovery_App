// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title IMasterX
 * @notice Interaksi dengan Poin Global MasterX
 */
interface IMasterX {
    function addPoints(address user, uint256 points, string calldata reason) external;
}

/**
 * @title DailyAppV12Secured
 * @notice Task-based gamification platform with NFT tiers, sponsorships, and social media verification
 * @dev Production-ready version with comprehensive security measures and verification support
 * @author DailyApp Team
 */
contract DailyAppV12Secured is ERC721, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- CUSTOM ERRORS ---
    error InvalidTier();
    error Blacklisted();
    error InvalidAddress();
    error Unauthorized();
    error InvalidParameters();
    error MaxLimitReached();
    error NotFound();
    error TransferFailed();

    
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
    
    // NEW: Sponsorship State (Moved from constant to variable for flexibility)
    uint256 public sponsorshipPlatformFee = 2 * 10**6; // Default $2 USDC
    bool public autoApproveSponsorship = true; 
    uint256 public minRewardPoolValue = 5 * 10**18; 
    uint256 public rewardPerClaim = 5 * 10**16; 
    uint256 public tasksForReward = 3;
    uint256 public dailyBonusAmount = 100;
    uint256 public sponsorDuration = 3 days;
    uint256 public baseReferralReward = 50;
    uint256 public withdrawalFeeBP = 500; // 5% default

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
        bool isOpen; // NEW: Single switch for Tier Availability
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
        uint256 sponsorshipId; // NEW: Link to sponsorship
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
        string[] titles;   // Batched titles
        string[] links;    // Batched links
        string contactEmail; 
        uint256 rewardPool;    
        RequestStatus status; 
        uint256 timestamp; 
    }


    // --- STATE VARIABLES ---
    mapping(NFTTier => NFTConfig) public nftConfigs;
    mapping(uint256 => Task) public tasks;
    mapping(address => UserStats) public userStats;
    mapping(address => mapping(uint256 => uint256)) public lastTaskTime; 
    mapping(address => address) public referrerOf;
    mapping(uint256 => SponsorRequest) public sponsorRequests;
    mapping(address => mapping(uint256 => bool)) public hasCompletedTask; // New: One-time completion tracking
    mapping(address => uint256) public claimableRewards; // New: Accumulated pending rewards
    mapping(address => bool) private _hasJoined;
    mapping(NFTTier => string) public tierURIs;
    mapping(address => bool) public isValidReferrer;
    
    // NEW: Sponsorship Tracking
    // user -> sponsorshipId -> count
    mapping(address => mapping(uint256 => uint256)) public userSponsorshipProgress; 
    
    // NEW: Verification tracking
    mapping(address => mapping(uint256 => bool)) public taskVerified;  // user => taskId => verified

    uint256 public userCount;
    uint256 public totalSponsorRequests;
    uint256 public nextTaskId = 2;

    uint256[3] public packagePricesUSD = [10 ether, 50 ether, 100 ether];
    uint256 public tokenPriceUSD = 0.01 ether;
    uint256 public currentDiscountPercent = 0;
    
    // NEW: MasterX Integration
    IMasterX public masterXContract;
    mapping(address => uint256) public unsyncedPoints;

    // MULTI-TOKEN: Whitelist of allowed payment tokens for sponsorship
    // address(0) = native ETH, any ERC20 address = that token
    mapping(address => bool) public allowedPaymentTokens;

    // --- EVENTS ---
    event TaskCompleted(address indexed user, uint256 taskId, uint256 reward, uint256 timestamp);
    event NewMemberJoined(address indexed user, address indexed referrer, uint256 timestamp);
    event SponsorshipRequested(uint256 indexed reqId, address indexed sponsor, SponsorLevel level, uint256 amount);
    event SponsorshipApproved(uint256 indexed reqId, uint256 newTaskId);
    event SponsorshipRejected(uint256 indexed reqId, uint256 refundAmount, string reason);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event DiscountUpdated(uint256 oldDiscount, uint256 newDiscount);
    event NFTMinted(address indexed user, NFTTier tier, uint256 tokenId);
    event NFTUpgraded(address indexed user, NFTTier fromTier, NFTTier toTier);
    event TaskAdded(uint256 indexed taskId, string title, uint256 baseReward, bool requiresVerification);
    event TaskUpdated(uint256 indexed taskId, bool isActive);
    event UserBlacklisted(address indexed user, bool status);
    event EmergencyWithdraw(address indexed token, uint256 amount);
    event TierURIUpdated(NFTTier indexed tier, string uri);
    event TaskVerified(address indexed user, uint256 indexed taskId, uint256 timestamp);  // NEW
    mapping(address => uint256) public lastActivityTime; // NEW: Track last activity for Underdog Bonus
    event ConfigUpdated(NFTTier indexed tier, uint256 pointsRequired, uint256 mintPrice, uint256 multiplierBP); // NEW
    event PointsSynced(address indexed user, uint256 points); // NEW
    event PaymentTokenUpdated(address indexed token, bool status); // MULTI-TOKEN

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
        
        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(ADMIN_ROLE, initialOwner);

        // Auto-whitelist creator token and ETH as default payment options
        allowedPaymentTokens[_tokenAddress] = true;
        allowedPaymentTokens[address(0)] = true; // ETH native
    }

    /**
     * @notice Batch set NFT configurations to reduce constructor bloat
     */
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

    // --- ADMIN: TASK & SYSTEM MANAGEMENT ---
    
    function setMasterX(address _masterX) external onlyRole(ADMIN_ROLE) validAddress(_masterX) {
        masterXContract = IMasterX(_masterX);
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
            isActive: false, // Default inactive for 07:15 WIB cycle
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

    /**
     * @notice Add multiple tasks in a single transaction
     */
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
            addTask(
                _baseRewards[i],
                _cooldowns[i],
                _minTiers[i],
                _titles[i],
                _links[i],
                _requiresVerifications[i]
            );
        }
    }


    function setTaskActive(uint256 _taskId, bool _isActive) external onlyRole(ADMIN_ROLE) {
        if (tasks[_taskId].baseReward == 0) revert NotFound();
        tasks[_taskId].isActive = _isActive;
        emit TaskUpdated(_taskId, _isActive);
    }

    // --- NEW: VERIFICATION FUNCTIONS ---
    
    /**
     * @notice Mark a task as verified for a user (called by backend verifier)
     * @param _user User address
     * @param _taskId Task ID
     */
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

    /**
     * @notice Check if a task is verified for a user
     * @param _user User address
     * @param _taskId Task ID
     */
    function isTaskVerified(address _user, uint256 _taskId) 
        external 
        view 
        returns (bool) 
    {
        return taskVerified[_user][_taskId];
    }

    // --- ADMIN: PRICING WITH TIMELOCK ---
    
    
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

    // --- ADMIN: USER MANAGEMENT ---
    
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

    // --- ADMIN: EMERGENCY CONTROLS ---
    
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // --- ADMIN: SPONSORSHIP CONFIG ---

    function setSponsorshipPlatformFee(uint256 _fee) external onlyRole(ADMIN_ROLE) {
        sponsorshipPlatformFee = _fee;
    }

    function setAutoApproveSponsorship(bool _status) external onlyRole(ADMIN_ROLE) {
        autoApproveSponsorship = _status;
    }

    /**
     * @notice Admin whitelist/delist a payment token for sponsorships.
     * Use address(0) for native ETH.
     * @param _token Token address (address(0) = ETH)
     * @param _status true = allowed, false = removed
     */
    function setAllowedToken(address _token, bool _status) external onlyRole(ADMIN_ROLE) {
        allowedPaymentTokens[_token] = _status;
        emit PaymentTokenUpdated(_token, _status);
    }

    /**
     * @notice Set global reward amounts (Daily & Referral)
     */
    function setGlobalRewards(uint256 _daily, uint256 _referral) external onlyRole(ADMIN_ROLE) {
        dailyBonusAmount = _daily;
        baseReferralReward = _referral;
    }

    /**
     * @notice Set sponsorship economic parameters
     */
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

    /**
     * @notice Set withdrawal fee in basis points (e.g., 500 = 5%)
     */
    function setWithdrawalFee(uint256 _feeBP) external onlyRole(ADMIN_ROLE) {
        if (_feeBP > 2000) revert InvalidParameters(); // Max 20%
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

    function setPackagePricesUSD(uint256[3] calldata _prices) external onlyRole(ADMIN_ROLE) {
        packagePricesUSD = _prices;
    }

    /**
     * @notice Admin creates a sponsorship for free (bypasses USDC fee + token pool).
     * Same storage & flow as buySponsorshipWithToken but no payment required.
     * Auto-approved immediately.
     */
    function adminCreateSponsorship(
        SponsorLevel _level,
        string[] calldata _titles,
        string[] calldata _links,
        string calldata _email
    ) external onlyRole(ADMIN_ROLE) payable {} 

    /**
     * @notice Admin toggles a task active/inactive without payment.
     */
    function adminSetTaskActive(uint256 _taskId, bool _active)
        external
        onlyRole(ADMIN_ROLE)
    {
        if (tasks[_taskId].baseReward == 0) revert NotFound();
        tasks[_taskId].isActive = _active;
    }


    // --- CORE: PRICING CALCULATION ---
    
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

    // --- CORE: SPONSORSHIP SYSTEM ---
    
    /**
     * @notice Create a sponsorship with any whitelisted payment token or ETH.
     * @param _level Sponsorship tier (BRONZE/SILVER/GOLD)
     * @param _titles Array of task titles (max 3)
     * @param _links Array of task links (same length as _titles)
     * @param _email Contact email
     * @param _rewardPoolAmount Amount of _paymentToken to deposit as reward pool
     * @param _paymentToken Token to pay reward pool with. Use address(0) for native ETH.
     *
     * Payment flow:
     *   - Platform Fee → always USDC (sponsorshipPlatformFee)
     *   - Reward Pool  → any token in allowedPaymentTokens whitelist, or ETH
     */
    function buySponsorshipWithToken(
        SponsorLevel _level,
        string[] calldata _titles,
        string[] calldata _links,
        string calldata _email,
        uint256 _rewardPoolAmount,
        address _paymentToken
    ) external payable {} 

    function approveSponsorship(uint256 _reqId) external onlyRole(ADMIN_ROLE) payable {} 

    function _approveSponsorshipInternal(uint256 _reqId) internal {} 

    function rejectSponsorship(uint256 _reqId, string calldata _reason) 
        external 
        onlyRole(ADMIN_ROLE) payable {} 

    /**
     * @notice Renew an existing Approved sponsorship for 3 more days
     * @param _reqId The sponsorship ID to renew
     */
    function renewSponsorship(uint256 _reqId) external payable {} 

    // --- CORE: TASK COMPLETION ---
    
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
        
        // Revised Logic: Sponsored tasks are one-time, others follow cooldown
        if (task.sponsorshipId > 0) {
            if (hasCompletedTask[msg.sender][_taskId]) revert Unauthorized();
        } else {
            if (block.timestamp < lastTaskTime[msg.sender][_taskId] + task.cooldown) revert Unauthorized();
        }
        
        // NEW: Check verification requirement
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
        
        // --- NEW: UNDERDOG CATCH-UP BONUS (+10% for Bronze & Silver) ---
        if (stats.currentTier == NFTTier.BRONZE || stats.currentTier == NFTTier.SILVER) {
            // Check if last activity was within the last 48 hours to reward consistency
            if (lastActivityTime[msg.sender] > 0 && block.timestamp <= lastActivityTime[msg.sender] + 48 hours) {
                multiplier = (multiplier * 11000) / 10000; // Boost multiplier by 1.1x
            }
        }
        lastActivityTime[msg.sender] = block.timestamp;
        
        uint256 reward = (task.baseReward * multiplier) / 10000;
        
        stats.points += reward;
        unsyncedPoints[msg.sender] += reward; // Accumulate for MasterX sync!
        stats.totalTasksCompleted++;
        stats.tasksForReferralProgress++;
        lastTaskTime[msg.sender][_taskId] = block.timestamp;
        
        // NEW: Reset verification flag after task completion
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
        
        // NEW: Sponsored Task Logic (One-Time & Pull Reward)
        if (task.sponsorshipId > 0) {
            hasCompletedTask[msg.sender][_taskId] = true;
            
            // Increment progress for sponsorship goal
            userSponsorshipProgress[msg.sender][task.sponsorshipId]++;
            uint256 currentProgress = userSponsorshipProgress[msg.sender][task.sponsorshipId];
            
            // Check if multiple of 3 (or whatever goal set)
            if (currentProgress % tasksForReward == 0) {
                SponsorRequest storage req = sponsorRequests[task.sponsorshipId];
                if (req.rewardPool >= rewardPerClaim) {
                    req.rewardPool -= rewardPerClaim;
                    claimableRewards[msg.sender] += rewardPerClaim; // Model PULL: Tambah simpanan, jangan kirim langsung
                }
            }
        }
        
        emit TaskCompleted(msg.sender, _taskId, reward, block.timestamp);
    }

    /**
     * @notice Claim 100 XP once every 24 hours
     */
    function claimDailyBonus() external whenNotPaused nonReentrant notBlacklisted {
        UserStats storage stats = userStats[msg.sender];
        if (block.timestamp < stats.lastDailyBonusClaim + 24 hours) revert Unauthorized();

        stats.lastDailyBonusClaim = block.timestamp;
        stats.points += dailyBonusAmount;
        unsyncedPoints[msg.sender] += dailyBonusAmount;
        
        emit TaskCompleted(msg.sender, 0, dailyBonusAmount, block.timestamp); // TaskID 0 for daily bonus
    }

    /**
     * @notice Burn points from a user (used by MasterX for tier upgrades)
     * @param _user The user to burn points from
     * @param _amount Number of points to deduct
     */
    function burnPoints(address _user, uint256 _amount) external {
        if (msg.sender != address(masterXContract) && !hasRole(ADMIN_ROLE, msg.sender)) revert Unauthorized();
        if (userStats[_user].points < _amount) revert Unauthorized();
        
        userStats[_user].points -= _amount;
    }

    /**
     * @notice Update user tier in DailyApp (used by MasterX to keep in sync)
     */
    function updateUserTier(address _user, NFTTier _tier) external {
        if (msg.sender != address(masterXContract) && !hasRole(ADMIN_ROLE, msg.sender)) revert Unauthorized();
        userStats[_user].currentTier = _tier;
        // Also mint the soulbound NFT if they don't have one yet
        if (balanceOf(_user) == 0) {
            uint256 tokenId = uint256(uint160(_user));
            _mint(_user, tokenId);
            emit NFTMinted(_user, _tier, tokenId);
        } else {
            emit NFTUpgraded(_user, NFTTier.NONE, _tier);
        }
    }

    /**
     * @notice Admin can add rewards for raffle winners or other incentives
     * @param _user The winner address
     * @param _amount The amount of creator tokens to award
     */
    function addClaimableReward(address _user, uint256 _amount) 
        external 
        onlyRole(ADMIN_ROLE) 
        validAddress(_user) 
    {
        if (_amount == 0) revert InvalidParameters();
        claimableRewards[_user] += _amount;
        emit TaskCompleted(_user, 888, _amount, block.timestamp); // TaskID 888 for external prize
    }

    /**
     * @notice Claim accumulated rewards. User pays gas + 5% platform fee deducted from reward.
     */
    function claimRewards() external whenNotPaused nonReentrant notBlacklisted {
        uint256 amount = claimableRewards[msg.sender];
        if (amount == 0) revert Unauthorized();

        claimableRewards[msg.sender] = 0;
        
        uint256 fee = (amount * withdrawalFeeBP) / 10000; // Dynamic Platform Fee
        uint256 userAmount = amount - fee;

        // Send fee to contract (can be withdrawn by admin later)
        creatorToken.safeTransfer(address(this), fee); // Already in contract, but accounting-wise held
        // Send reward to user
        creatorToken.safeTransfer(msg.sender, userAmount);

        emit TaskCompleted(msg.sender, 999, userAmount, block.timestamp); // TaskID 999 for reward withdrawal
    }

    /**
     * @notice Execute multiple tasks in a single transaction
     * @param _taskIds Array of task IDs
     */
    function doBatchTasks(uint256[] calldata _taskIds) external payable {} 

    /**
     * @notice Lazy sync accumulated points to MasterX
     */
    function syncMasterXPoints() external whenNotPaused nonReentrant notBlacklisted {
        if (address(masterXContract) == address(0)) revert InvalidAddress();
        uint256 pointsToSync = unsyncedPoints[msg.sender];
        if (pointsToSync == 0) revert Unauthorized();
        
        unsyncedPoints[msg.sender] = 0;
        masterXContract.addPoints(msg.sender, pointsToSync, "DailyApp Sync");
        
        emit PointsSynced(msg.sender, pointsToSync);
    }

    // --- CORE: NFT MINTING/UPGRADING ---
    
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
        
        if (!config.isOpen) revert Unauthorized(); // NEW: Check if tier is logically open
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

    // --- SOULBOUND: PREVENT TRANSFERS ---
    
    function _update(address to, uint256 tokenId, address auth) 
        internal 
        virtual 
        override 
        returns (address) 
    {
        address from = _ownerOf(tokenId);
        
        if (from != address(0) && to != address(0)) revert Unauthorized();
        
        return super._update(to, tokenId, auth);
    }

    // --- VIEW FUNCTIONS ---
    
    
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



    function canDoTask(address _user, uint256 _taskId) 
        external 
        view 
        returns (bool, string memory reason) 
    {
        Task memory task = tasks[_taskId];
        UserStats memory stats = userStats[_user];
        
        if (task.baseReward == 0) return (false, "NotFound");
        if (!task.isActive) return (false, "Inactive");
        if (stats.isBlacklisted) return (false, "Blacklisted");
        if (stats.currentTier < task.minTier) return (false, "TierLow");
        if (block.timestamp < lastTaskTime[_user][_taskId] + task.cooldown) {
            return (false, "Cooldown");
        }
        if (task.requiresVerification && !taskVerified[_user][_taskId]) {
            return (false, "NoVerify");
        }
        
        return (true, "");
    }


    // --- WITHDRAWAL FUNCTIONS ---
    
    function emergencyWithdraw(address _token, uint256 _amount) 
        external 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
    {
        if (_token == address(0)) {
            uint256 balance = address(this).balance;
            uint256 amount = (_amount == 0 || _amount > balance) ? balance : _amount;
            if (amount == 0) revert InvalidParameters();
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            if (!success) revert TransferFailed();
            emit EmergencyWithdraw(address(0), amount);
        } else {
            IERC20 token = IERC20(_token);
            uint256 balance = token.balanceOf(address(this));
            uint256 amount = (_amount == 0 || _amount > balance) ? balance : _amount;
            if (amount == 0) revert InvalidParameters();
            token.safeTransfer(msg.sender, amount);
            emit EmergencyWithdraw(_token, amount);
        }
    }

    // --- REQUIRED OVERRIDES ---
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    receive() external payable {}
}
