// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
    error NotPending();
    error InvalidRequest();
    error CooldownActive();
    error InsufficientFunds();
    error AlreadyExists();
    error InvalidLength();
    error InvalidOrder();
    error InvalidParameters();
    error MaxLimitReached();
    error NotFound();
    error TransferFailed();
    error NotAllowed();

    
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
    uint256 public constant BASE_REFERRAL_REWARD = 50;
    uint256 public constant PRICE_CHANGE_DELAY = 1 days;
    uint256 public constant MAX_DISCOUNT_PERCENT = 50;
    uint256 public constant REFUND_PENALTY_PERCENT = 10;
    
    // NEW: Sponsorship State
    uint256 public sponsorshipPlatformFee = 2 * 10**6; // Default $2 USDC
    bool public autoApproveSponsorship = true; 
    uint256 public constant MIN_REWARD_POOL_VALUE = 5 * 10**18; 
    uint256 public constant REWARD_PER_CLAIM = 5 * 10**16; 
    uint256 public constant TASKS_FOR_REWARD = 3;
    uint256 public constant DAILY_BONUS_AMOUNT = 100;
    uint256 public constant SPONSOR_DURATION = 3 days;

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

    struct PendingPriceChange {
        uint256 newPrice;
        uint256 effectiveTime;
        bool isPending;
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
    PendingPriceChange public pendingPriceChange;
    
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
    event PriceChangeScheduled(uint256 newPrice, uint256 effectiveTime);
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
        uint256[] calldata _maxSupplies
    ) external onlyRole(ADMIN_ROLE) {
        uint256 len = _tiers.length;
        if (len == 0 || len != _pointsRequired.length || len != _mintPrices.length || 
            len != _dailyBonuses.length || len != _multiplierBPs.length || len != _maxSupplies.length) 
            revert InvalidParameters();

        for (uint256 i = 0; i < len; i++) {
            nftConfigs[_tiers[i]] = NFTConfig({
                pointsRequired: _pointsRequired[i],
                mintPrice: _mintPrices[i],
                dailyBonus: _dailyBonuses[i],
                multiplierBP: _multiplierBPs[i],
                maxSupply: _maxSupplies[i],
                currentSupply: nftConfigs[_tiers[i]].currentSupply
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
            isActive: true,
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
    
    function scheduleTokenPriceUpdate(uint256 _newPrice) external onlyRole(ADMIN_ROLE) {
        if (_newPrice == 0 || _newPrice > 1 ether) revert InvalidParameters();
        
        pendingPriceChange = PendingPriceChange({
            newPrice: _newPrice,
            effectiveTime: block.timestamp + PRICE_CHANGE_DELAY,
            isPending: true
        });
        
        emit PriceChangeScheduled(_newPrice, pendingPriceChange.effectiveTime);
    }

    function executePriceChange() external {
        if (!pendingPriceChange.isPending) revert NotPending();
        if (block.timestamp < pendingPriceChange.effectiveTime) revert NotAllowed();
        
        uint256 oldPrice = tokenPriceUSD;
        tokenPriceUSD = pendingPriceChange.newPrice;
        
        delete pendingPriceChange;
        
        emit PriceUpdated(oldPrice, tokenPriceUSD);
    }

    function cancelPriceChange() external onlyRole(ADMIN_ROLE) {
        if (!pendingPriceChange.isPending) revert NotPending();
        delete pendingPriceChange;
    }
    
    function setPackagePricesUSD(uint256 _bronze, uint256 _silver, uint256 _gold) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (_bronze == 0 || _bronze >= _silver || _silver >= _gold) revert InvalidOrder();
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
        if (bytes(_uri).length == 0) revert InvalidLength();
        tierURIs[_tier] = _uri;
        emit TierURIUpdated(_tier, _uri);
    }

    function updateNFTConfig(
        NFTTier _tier,
        uint256 _pointsRequired,
        uint256 _mintPrice,
        uint256 _multiplierBP
    ) external onlyRole(ADMIN_ROLE) validTier(_tier) {
        if (_pointsRequired == 0) revert InvalidParameters();
        if (_multiplierBP < 10000 || _multiplierBP > MAX_MULTIPLIER_BP) revert InvalidParameters();
        
        NFTConfig storage config = nftConfigs[_tier];
        config.pointsRequired = _pointsRequired;
        config.mintPrice = _mintPrice;
        config.multiplierBP = _multiplierBP;
        
        emit ConfigUpdated(_tier, _pointsRequired, _mintPrice, _multiplierBP);
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
     * @notice Admin creates a sponsorship for free (bypasses USDC fee + token pool).
     * Same storage & flow as buySponsorshipWithToken but no payment required.
     * Auto-approved immediately.
     */
    function adminCreateSponsorship(
        SponsorLevel _level,
        string[] calldata _titles,
        string[] calldata _links,
        string calldata _email
    ) external onlyRole(ADMIN_ROLE) {
        if (_titles.length == 0 || _titles.length > 3) revert InvalidParameters();
        if (_titles.length != _links.length) revert InvalidParameters();

        totalSponsorRequests++;
        uint256 requestId = totalSponsorRequests;

        sponsorRequests[requestId] = SponsorRequest({
            sponsor: msg.sender,
            level: _level,
            titles: _titles,
            links: _links,
            contactEmail: _email,
            rewardPool: 0,
            status: RequestStatus.PENDING,
            timestamp: block.timestamp
        });

        emit SponsorshipRequested(requestId, msg.sender, _level, 0);
        _approveSponsorshipInternal(requestId);
    }

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
    ) external payable whenNotPaused nonReentrant notBlacklisted {
        if (_titles.length == 0 || _titles.length > 3) revert InvalidParameters();
        if (_titles.length != _links.length) revert InvalidParameters();
        if (bytes(_email).length == 0 || bytes(_email).length > 100) revert InvalidLength();
        if (!allowedPaymentTokens[_paymentToken]) revert Unauthorized(); // Token must be whitelisted

        // 1. Charge Platform Fee (always USDC)
        if (usdcToken.allowance(msg.sender, address(this)) < sponsorshipPlatformFee) revert Unauthorized();
        usdcToken.safeTransferFrom(msg.sender, address(this), sponsorshipPlatformFee);

        // 2. Charge Reward Pool — ETH or ERC20
        if (_paymentToken == address(0)) {
            // Native ETH payment
            if (msg.value < MIN_REWARD_POOL_VALUE) revert InsufficientFunds();
            // msg.value is automatically held by contract; _rewardPoolAmount ignored for ETH
        } else {
            // ERC20 payment
            if (_rewardPoolAmount < MIN_REWARD_POOL_VALUE) revert InsufficientFunds();
            if (IERC20(_paymentToken).allowance(msg.sender, address(this)) < _rewardPoolAmount) revert Unauthorized();
            IERC20(_paymentToken).safeTransferFrom(msg.sender, address(this), _rewardPoolAmount);
        }

        uint256 actualPool = _paymentToken == address(0) ? msg.value : _rewardPoolAmount;

        totalSponsorRequests++;
        uint256 requestId = totalSponsorRequests;

        sponsorRequests[requestId] = SponsorRequest({
            sponsor: msg.sender,
            level: _level,
            titles: _titles,
            links: _links,
            contactEmail: _email,
            rewardPool: actualPool,
            status: RequestStatus.PENDING,
            timestamp: block.timestamp
        });

        emit SponsorshipRequested(requestId, msg.sender, _level, actualPool);

        // EXTRA POINTS for Create Task activity
        userStats[msg.sender].points += 200;
        unsyncedPoints[msg.sender] += 200;

        // 3. Auto-Approve logic
        if (autoApproveSponsorship) {
            _approveSponsorshipInternal(requestId);
        }
    }

    function approveSponsorship(uint256 _reqId) external onlyRole(ADMIN_ROLE) {
        _approveSponsorshipInternal(_reqId);
    }

    function _approveSponsorshipInternal(uint256 _reqId) internal {
        SponsorRequest storage req = sponsorRequests[_reqId];
        if (req.status != RequestStatus.PENDING) revert NotPending();
        if (req.sponsor == address(0)) revert InvalidRequest();
        
        req.status = RequestStatus.APPROVED;
        
        uint256 reward;
        if (req.level == SponsorLevel.BRONZE) reward = 50;
        else if (req.level == SponsorLevel.SILVER) reward = 100;
        else reward = 200;
        
        for (uint256 i = 0; i < req.titles.length; i++) {
            uint256 newTaskId = nextTaskId++;
            
            tasks[newTaskId] = Task({
                baseReward: reward,
                isActive: true,
                cooldown: 86400,
                minTier: NFTTier.NONE,
                title: req.titles[i],
                link: req.links[i],
                createdAt: block.timestamp,
                requiresVerification: false,
                sponsorshipId: _reqId
            });
            
            emit TaskAdded(newTaskId, req.titles[i], reward, false);
        }
        
        emit SponsorshipApproved(_reqId, 0); // 0 taskId because it's multiple now
    }

    function rejectSponsorship(uint256 _reqId, string calldata _reason) 
        external 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
    {
        SponsorRequest storage req = sponsorRequests[_reqId];
        if (req.status != RequestStatus.PENDING) revert NotPending();
        if (req.sponsor == address(0)) revert InvalidRequest();
        if (bytes(_reason).length == 0) revert InvalidLength();

        req.status = RequestStatus.REJECTED;

        // Refund the Reward Pool (Creator Tokens)
        // Note: Platform Fee (USDC) is NOT refunded (Admin decision: strictly for listing effort)
        // Or if we want to be nice, we can refund fee too. The user didn't specify.
        // Usually listing fees are non-refundable if rejected for cause, but safer to refund pool.
        
        if (req.rewardPool > 0) {
            creatorToken.safeTransfer(req.sponsor, req.rewardPool);
        }
        
        emit SponsorshipRejected(_reqId, req.rewardPool, _reason);
    }

    /**
     * @notice Renew an existing Approved sponsorship for 3 more days
     * @param _reqId The sponsorship ID to renew
     */
    function renewSponsorship(uint256 _reqId) external whenNotPaused nonReentrant notBlacklisted {
        SponsorRequest storage req = sponsorRequests[_reqId];
        if (req.status != RequestStatus.APPROVED) revert NotAllowed();
        if (req.sponsor != msg.sender) revert Unauthorized();
        if (req.rewardPool < REWARD_PER_CLAIM) revert InsufficientFunds();

        // Must pay Platform Fee again ($2 USDC)
        if (usdcToken.allowance(msg.sender, address(this)) < sponsorshipPlatformFee) revert Unauthorized();
        usdcToken.safeTransferFrom(msg.sender, address(this), sponsorshipPlatformFee);

        // We just emit an event, the DB will pick it up and update expires_at
        emit SponsorshipRequested(_reqId, msg.sender, req.level, 0); // Amount 0 means renewal/extension
    }

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
        if (!task.isActive) revert NotAllowed();
        if (stats.currentTier < task.minTier) revert InvalidTier();
        
        // Revised Logic: Sponsored tasks are one-time, others follow cooldown
        if (task.sponsorshipId > 0) {
            if (hasCompletedTask[msg.sender][_taskId]) revert NotAllowed();
        } else {
            if (block.timestamp < lastTaskTime[msg.sender][_taskId] + task.cooldown) revert CooldownActive();
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
                userStats[referrer].points += BASE_REFERRAL_REWARD;
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
            if (currentProgress % TASKS_FOR_REWARD == 0) {
                SponsorRequest storage req = sponsorRequests[task.sponsorshipId];
                if (req.rewardPool >= REWARD_PER_CLAIM) {
                    req.rewardPool -= REWARD_PER_CLAIM;
                    claimableRewards[msg.sender] += REWARD_PER_CLAIM; // Model PULL: Tambah simpanan, jangan kirim langsung
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
        if (block.timestamp < stats.lastDailyBonusClaim + 24 hours) revert CooldownActive();

        stats.lastDailyBonusClaim = block.timestamp;
        stats.points += DAILY_BONUS_AMOUNT;
        unsyncedPoints[msg.sender] += DAILY_BONUS_AMOUNT;
        
        emit TaskCompleted(msg.sender, 0, DAILY_BONUS_AMOUNT, block.timestamp); // TaskID 0 for daily bonus
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
        if (amount == 0) revert InsufficientFunds();

        claimableRewards[msg.sender] = 0;
        
        uint256 fee = (amount * 5) / 100; // 5% Platform Fee
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
    function doBatchTasks(uint256[] calldata _taskIds) external nonReentrant {
        for (uint256 i = 0; i < _taskIds.length; i++) {
            // Note: msg.sender is preserved during internal call
            doTask(_taskIds[i], address(0));
        }
    }

    /**
     * @notice Lazy sync accumulated points to MasterX
     */
    function syncMasterXPoints() external whenNotPaused nonReentrant notBlacklisted {
        require(address(masterXContract) != address(0), "MasterX not set");
        uint256 pointsToSync = unsyncedPoints[msg.sender];
        require(pointsToSync > 0, "No points to sync");
        
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
        require(currentTier < NFTTier.DIAMOND, "Max tier reached");
        
        NFTTier nextTier = NFTTier(uint256(currentTier) + 1);
        _mintOrUpgrade(nextTier);
    }

    function _mintOrUpgrade(NFTTier _tier) internal {
        NFTConfig storage config = nftConfigs[_tier];
        UserStats storage stats = userStats[msg.sender];
        NFTTier currentTier = stats.currentTier;

        if (balanceOf(msg.sender) != 0 && currentTier >= _tier) revert AlreadyExists();
        if (currentTier == _tier) revert AlreadyExists();
        if (uint256(_tier) != uint256(currentTier) + 1) revert InvalidOrder();
        if (stats.points < config.pointsRequired) revert InsufficientFunds();
        if (msg.value < config.mintPrice) revert InsufficientFunds();
        
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
        
        require(
            from == address(0) || to == address(0), 
            "SB" // Soulbound transfer disabled
        );
        
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
        
        if (task.baseReward == 0) return (false, "Task not exist");
        if (!task.isActive) return (false, "Task inactive");
        if (stats.isBlacklisted) return (false, "User blacklisted");
        if (stats.currentTier < task.minTier) return (false, "Tier too low");
        if (block.timestamp < lastTaskTime[_user][_taskId] + task.cooldown) {
            return (false, "Cooldown active");
        }
        if (task.requiresVerification && !taskVerified[_user][_taskId]) {
            return (false, "Task not verified");
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
            if (amount == 0) revert InsufficientFunds();
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            if (!success) revert TransferFailed();
            emit EmergencyWithdraw(address(0), amount);
        } else {
            IERC20 token = IERC20(_token);
            uint256 balance = token.balanceOf(address(this));
            uint256 amount = (_amount == 0 || _amount > balance) ? balance : _amount;
            if (amount == 0) revert InsufficientFunds();
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
