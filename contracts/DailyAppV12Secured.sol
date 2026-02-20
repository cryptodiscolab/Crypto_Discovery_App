// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

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
    using Strings for uint256;
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
    mapping(address => bool) private _hasJoined;
    mapping(NFTTier => string) public tierURIs;
    mapping(address => bool) public isValidReferrer;
    
    // NEW: Sponsorship Tracking
    // user -> sponsorshipId -> count
    mapping(address => mapping(uint256 => uint256)) public userSponsorshipProgress; 
    
    // NEW: Verification tracking
    mapping(address => mapping(uint256 => bool)) public taskVerified;  // user => taskId => verified

    address[] private _userList;
    uint256 public userCount;
    uint256 public globalTxCount;
    uint256 public totalSponsorRequests;
    uint256 public nextTaskId = 2;

    uint256[3] public packagePricesUSD = [10 ether, 50 ether, 100 ether];
    uint256 public tokenPriceUSD = 0.01 ether;
    uint256 public currentDiscountPercent = 0;
    PendingPriceChange public pendingPriceChange;
    
    // NEW: MasterX Integration
    IMasterX public masterXContract;
    mapping(address => uint256) public unsyncedPoints;

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

    // --- MODIFIERS ---
    modifier validTier(NFTTier _tier) {
        if (_tier == NFTTier.NONE || _tier > NFTTier.DIAMOND) revert InvalidTier();
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
        
        nftConfigs[NFTTier.BRONZE] = NFTConfig({
            pointsRequired: 1000,
            mintPrice: 0.001 ether,
            dailyBonus: 50,
            multiplierBP: 11000,
            maxSupply: 10000,
            currentSupply: 0
        });
        
        nftConfigs[NFTTier.SILVER] = NFTConfig({
            pointsRequired: 5000,
            mintPrice: 0.005 ether,
            dailyBonus: 100,
            multiplierBP: 12000,
            maxSupply: 5000,
            currentSupply: 0
        });
        
        nftConfigs[NFTTier.GOLD] = NFTConfig({
            pointsRequired: 20000,
            mintPrice: 0.02 ether,
            dailyBonus: 200,
            multiplierBP: 15000,
            maxSupply: 2000,
            currentSupply: 0
        });
        
        nftConfigs[NFTTier.PLATINUM] = NFTConfig({
            pointsRequired: 100000,
            mintPrice: 0.1 ether,
            dailyBonus: 500,
            multiplierBP: 20000,
            maxSupply: 1000,
            currentSupply: 0
        });
        
        nftConfigs[NFTTier.DIAMOND] = NFTConfig({
            pointsRequired: 500000,
            mintPrice: 0.5 ether,
            dailyBonus: 1000,
            multiplierBP: 30000,
            maxSupply: 100,
            currentSupply: 0
        });

        tasks[1] = Task({
            baseReward: 100,
            isActive: true,
            cooldown: 86400,
            minTier: NFTTier.NONE,
            title: "Login Harian",
            link: "",
            createdAt: block.timestamp,
            requiresVerification: false,
            sponsorshipId: 0
        });
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
        if (_baseReward == 0 || _baseReward > MAX_TASK_REWARD) revert("1"); // Invalid reward
        if (_cooldown < 1 hours) revert("2"); // Cooldown too short
        if (bytes(_title).length == 0 || bytes(_title).length > 100) revert("3"); // Invalid title length
        if (bytes(_link).length > 200) revert("4"); // Link too long
        
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
        if (length == 0) revert("5"); // Empty batch
        if (
            length != _cooldowns.length || 
            length != _minTiers.length || 
            length != _titles.length || 
            length != _links.length || 
            length != _requiresVerifications.length
        ) revert("6"); // Mismatched lengths

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
        if (tasks[_taskId].baseReward == 0) revert("7"); // Task not exist
        if (!tasks[_taskId].requiresVerification) revert("8"); // Doesn't require verification
        if (taskVerified[_user][_taskId]) revert("9"); // Already verified
        
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

    // --- ADMIN: FINANCIAL CONTROLS ---

    function withdrawETH() external onlyRole(ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        if (balance == 0) revert InsufficientFunds();
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        if (!success) revert TransferFailed();
    }

    function withdrawERC20(address _token) external onlyRole(ADMIN_ROLE) {
        uint256 balance = IERC20(_token).balanceOf(address(this));
        if (balance == 0) revert InsufficientFunds();
        IERC20(_token).safeTransfer(msg.sender, balance);
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
     * @notice Sponsor requires:
     * 1. USDC Platform Fee (Dynamic)
     * 2. Creator Tokens for Reward Pool (Min Value ~$5)
     */
    function buySponsorshipWithToken(
        SponsorLevel _level, 
        string[] calldata _titles, 
        string[] calldata _links, 
        string calldata _email,
        uint256 _rewardPoolAmount
    ) external whenNotPaused nonReentrant notBlacklisted {
        if (_titles.length == 0 || _titles.length > 3) revert InvalidParameters();
        if (_titles.length != _links.length) revert InvalidParameters();
        if (bytes(_email).length == 0 || bytes(_email).length > 100) revert InvalidLength();
        
        // 1. Charge Platform Fee
        if (usdcToken.allowance(msg.sender, address(this)) < sponsorshipPlatformFee) revert Unauthorized();
        usdcToken.safeTransferFrom(msg.sender, address(this), sponsorshipPlatformFee);
        
        // 2. Charge Reward Pool (Creator Tokens)
        if (_rewardPoolAmount < MIN_REWARD_POOL_VALUE) revert InsufficientFunds();
        if (creatorToken.allowance(msg.sender, address(this)) < _rewardPoolAmount) revert Unauthorized();
        creatorToken.safeTransferFrom(msg.sender, address(this), _rewardPoolAmount);

        totalSponsorRequests++;
        uint256 requestId = totalSponsorRequests;
        
        sponsorRequests[requestId] = SponsorRequest({
            sponsor: msg.sender,
            level: _level,
            titles: _titles,
            links: _links,
            contactEmail: _email,
            rewardPool: _rewardPoolAmount,
            status: RequestStatus.PENDING,
            timestamp: block.timestamp
        });
        
        // Expiry logic is handled by DB using block.timestamp

        emit SponsorshipRequested(requestId, msg.sender, _level, _rewardPoolAmount);

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
        if (block.timestamp < lastTaskTime[msg.sender][_taskId] + task.cooldown) revert CooldownActive();
        
        // NEW: Check verification requirement
        if (task.requiresVerification && !taskVerified[msg.sender][_taskId]) revert Unauthorized();

        if (!_hasJoined[msg.sender]) {
            if (userCount >= MAX_USERS) revert MaxLimitReached();
            _userList.push(msg.sender);
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

        (,, uint256 reward) = calculateTaskReward(msg.sender, _taskId);
        
        stats.points += reward;
        unsyncedPoints[msg.sender] += reward; // Accumulate for MasterX sync!
        stats.totalTasksCompleted++;
        stats.tasksForReferralProgress++;
        lastTaskTime[msg.sender][_taskId] = block.timestamp;
        globalTxCount++;
        
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
        
        // NEW: Sponsored Task Logic
        if (task.sponsorshipId > 0) {
            // Increment progress
            userSponsorshipProgress[msg.sender][task.sponsorshipId]++;
            uint256 currentProgress = userSponsorshipProgress[msg.sender][task.sponsorshipId];
            
            // Check if multiple of 3
            if (currentProgress % TASKS_FOR_REWARD == 0) {
                SponsorRequest storage req = sponsorRequests[task.sponsorshipId];
                // Check if pool has funds
                if (req.rewardPool >= REWARD_PER_CLAIM) {
                    req.rewardPool -= REWARD_PER_CLAIM;
                    creatorToken.safeTransfer(msg.sender, REWARD_PER_CLAIM);
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
        
        globalTxCount++;
        emit TaskCompleted(msg.sender, 0, DAILY_BONUS_AMOUNT, block.timestamp); // TaskID 0 for daily bonus
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
            "10" // Soulbound transfer disabled
        );
        
        return super._update(to, tokenId, auth);
    }

    // --- VIEW FUNCTIONS ---
    
    function calculateTaskReward(address _user, uint256 _taskId) 
        public 
        view 
        returns (uint256 base, uint256 finalReward, uint256 multiplier) 
    {
        base = tasks[_taskId].baseReward;
        multiplier = nftConfigs[userStats[_user].currentTier].multiplierBP;
        
        if (multiplier == 0) {
            multiplier = 10000;
        }
        
        if (base > MAX_TASK_REWARD) revert InvalidParameters();
        if (multiplier > MAX_MULTIPLIER_BP) revert InvalidParameters();
        
        uint256 product = base * multiplier;
        if (product / multiplier != base) revert InvalidParameters();
        
        finalReward = product / 10000;
        
        return (base, finalReward, multiplier);
    }
    
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
    
    function getUsers(uint256 _offset, uint256 _limit) 
        external 
        view 
        returns (address[] memory users, uint256 total) 
    {
        total = userCount;
        
        if (_offset >= total) {
            return (new address[](0), total);
        }
        
        uint256 end = _offset + _limit;
        if (end > total) {
            end = total;
        }
        
        uint256 size = end - _offset;
        users = new address[](size);
        
        for (uint256 i = 0; i < size; i++) {
            users[i] = _userList[_offset + i];
        }
        
        return (users, total);
    }
    
    function getUserStats(address _user) 
        external 
        view 
        returns (UserStats memory) 
    {
        return userStats[_user];
    }

    function getTask(uint256 _taskId) 
        external 
        view 
        returns (Task memory) 
    {
        if (tasks[_taskId].baseReward == 0) revert NotFound();
        return tasks[_taskId];
    }

    function getSponsorRequest(uint256 _reqId) 
        external 
        view 
        returns (SponsorRequest memory) 
    {
        if (_reqId == 0 || _reqId > totalSponsorRequests) revert NotFound();
        return sponsorRequests[_reqId];
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

    function getContractStats() 
        external 
        view 
        returns (
            uint256 totalUsers,
            uint256 totalTransactions,
            uint256 totalSponsors,
            uint256 contractTokenBalance,
            uint256 contractETHBalance
        ) 
    {
        return (
            userCount,
            globalTxCount,
            totalSponsorRequests,
            creatorToken.balanceOf(address(this)),
            address(this).balance
        );
    }

    // --- WITHDRAWAL FUNCTIONS ---
    
    function withdrawTokens(uint256 _amount) 
        external 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
    {
        uint256 balance = creatorToken.balanceOf(address(this));
        if (balance == 0) revert InsufficientFunds();
        
        if (_amount == 0 || _amount > balance) {
            _amount = balance;
        }
        
        creatorToken.safeTransfer(msg.sender, _amount);
        emit EmergencyWithdraw(address(creatorToken), _amount);
    }
    
    function withdrawETH(uint256 _amount) 
        external 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
    {
        uint256 balance = address(this).balance;
        if (balance == 0) revert InsufficientFunds();
        
        if (_amount == 0 || _amount > balance) {
            _amount = balance;
        }
        
        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        if (!success) revert TransferFailed();
        
        emit EmergencyWithdraw(address(0), _amount);
    }

    function emergencyWithdrawToken(address _token, uint256 _amount) 
        external 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
        validAddress(_token)
    {
        IERC20 token = IERC20(_token);
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert InsufficientFunds();
        
        if (_amount == 0 || _amount > balance) {
            _amount = balance;
        }
        
        token.safeTransfer(msg.sender, _amount);
        emit EmergencyWithdraw(_token, _amount);
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
