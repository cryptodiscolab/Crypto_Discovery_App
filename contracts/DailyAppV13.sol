// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IMasterX {
    function addPoints(address user, uint256 points, string calldata reason) external;
}

/**
 * @title DailyAppV13
 * @notice Multi-token support for sponsorships and manual reward claims.
 */
contract DailyAppV13 is ERC721, AccessControl, Pausable, ReentrancyGuard {
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
    error AlreadyCompleted();

    IERC20 public usdcToken;
    IERC20 public creatorToken;

    // --- ROLES ---
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // --- STATE VARIABLES ---
    uint256 public sponsorshipPlatformFee = 1 * 10**6; // $1 USDC
    bool public autoApproveSponsorship = true; 
    uint256 public minRewardPoolValue = 5 * 10**18; // Default pool min (USD handled by UI)
    uint256 public rewardPerClaim = 1 * 10**16; // Default claim (USD handled by UI)
    uint256 public tasksForReward = 3;
    uint256 public dailyBonusAmount = 100;
    uint256 public sponsorDuration = 3 days;
    uint256 public withdrawalFeeBP = 500; // 5%

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
    }

    mapping(NFTTier => NFTConfig) public nftConfigs;
    mapping(uint256 => Task) public tasks;
    mapping(address => UserStats) public userStats;
    mapping(address => mapping(uint256 => uint256)) public lastTaskTime; 
    mapping(uint256 => SponsorRequest) public sponsorRequests;
    mapping(address => mapping(uint256 => bool)) public hasCompletedTask; 
    mapping(address => mapping(address => uint256)) public claimableRewards; 

    mapping(NFTTier => string) public tierURIs;
    mapping(address => mapping(uint256 => uint256)) public userSponsorshipProgress; 
    mapping(address => mapping(uint256 => bool)) public taskVerified;  
    mapping(address => uint256) public lastActivityTime;
    mapping(address => uint256) public referralCount;

    uint256 public totalSponsorRequests;
    uint256 public nextTaskId = 1;

    IMasterX public masterXContract;
    mapping(address => uint256) public unsyncedPoints;
    mapping(address => bool) public allowedPaymentTokens;

    // --- EVENTS ---
    event TaskCompleted(address indexed user, uint256 taskId, uint256 reward, uint256 timestamp, address referrer);
    event SponsorshipRequested(uint256 indexed reqId, address indexed sponsor, uint256 amount, address token);
    event SponsorshipApproved(uint256 indexed reqId);
    event TaskVerified(address indexed user, uint256 indexed taskId);
    event RewardClaimed(address indexed user, address indexed token, uint256 amount);
    event TaskAdded(uint256 indexed taskId, string title);
    event DailyBonusClaimed(address indexed user, uint256 amount, uint256 timestamp);

    // --- MODIFIERS ---
    modifier notBlacklisted() {
        if (userStats[msg.sender].isBlacklisted) revert Blacklisted();
        _;
    }

    constructor(address _creatorToken, address _usdcToken, address _initialOwner) 
        ERC721("DailyApp Membership", "MEMBER") 
    {
        creatorToken = IERC20(_creatorToken);
        usdcToken = IERC20(_usdcToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ADMIN_ROLE, _initialOwner);
        _grantRole(VERIFIER_ROLE, _initialOwner);

        allowedPaymentTokens[address(0)] = true;
        allowedPaymentTokens[_creatorToken] = true;
        allowedPaymentTokens[_usdcToken] = true;
    }

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
        if (!allowedPaymentTokens[_paymentToken]) revert Unauthorized();

        // Platform Fee in USDC
        usdcToken.safeTransferFrom(msg.sender, address(this), sponsorshipPlatformFee);

        // Reward Pool
        uint256 actualPool;
        if (_paymentToken == address(0)) {
            if (msg.value < minRewardPoolValue) revert Unauthorized();
            actualPool = msg.value;
        } else {
            if (_rewardPoolAmount < minRewardPoolValue) revert Unauthorized();
            IERC20(_paymentToken).safeTransferFrom(msg.sender, address(this), _rewardPoolAmount);
            actualPool = _rewardPoolAmount;
        }

        totalSponsorRequests++;
        sponsorRequests[totalSponsorRequests] = SponsorRequest({
            sponsor: msg.sender,
            level: _level,
            titles: _titles,
            links: _links,
            contactEmail: _email,
            rewardPool: actualPool,
            status: RequestStatus.PENDING,
            timestamp: block.timestamp,
            rewardToken: _paymentToken
        });
        
        // Grant XP to Sponsor (Synced via User Bundle)
        userStats[msg.sender].points += 100;
        unsyncedPoints[msg.sender] += 100;

        emit SponsorshipRequested(totalSponsorRequests, msg.sender, actualPool, _paymentToken);
        if (autoApproveSponsorship) _approveSponsorshipInternal(totalSponsorRequests);
    }

    function _approveSponsorshipInternal(uint256 _reqId) internal {
        SponsorRequest storage req = sponsorRequests[_reqId];
        req.status = RequestStatus.APPROVED;
        
        for (uint256 i = 0; i < req.titles.length; i++) {
            tasks[nextTaskId] = Task({
                baseReward: 10,
                isActive: true,
                cooldown: sponsorDuration,
                minTier: NFTTier.NONE,
                title: req.titles[i],
                link: req.links[i],
                createdAt: block.timestamp,
                requiresVerification: true,
                sponsorshipId: _reqId
            });
            emit TaskAdded(nextTaskId, req.titles[i]);
            nextTaskId++;
        }
        emit SponsorshipApproved(_reqId);
    }

    function verifyTask(address _user, uint256 _taskId) external onlyRole(VERIFIER_ROLE) {
        taskVerified[_user][_taskId] = true;
        emit TaskVerified(_user, _taskId);
    }

    function doTask(uint256 _taskId, address _referrer) external whenNotPaused nonReentrant notBlacklisted {
        Task memory task = tasks[_taskId];
        if (!task.isActive) revert NotFound();
        if (hasCompletedTask[msg.sender][_taskId]) revert AlreadyCompleted();
        if (task.requiresVerification && !taskVerified[msg.sender][_taskId]) revert Unauthorized();

        hasCompletedTask[msg.sender][_taskId] = true;
        userStats[msg.sender].totalTasksCompleted++;
        userStats[msg.sender].points += task.baseReward;
        unsyncedPoints[msg.sender] += task.baseReward;
        lastActivityTime[msg.sender] = block.timestamp;

        if (_referrer != address(0) && _referrer != msg.sender) {
            referralCount[_referrer]++;
            userStats[_referrer].points += 5; // Small bonus for referral activity
            unsyncedPoints[_referrer] += 5;
        }

        if (task.sponsorshipId != 0) {
            uint256 progress = ++userSponsorshipProgress[msg.sender][task.sponsorshipId];
            if (progress % tasksForReward == 0) {
                SponsorRequest storage req = sponsorRequests[task.sponsorshipId];
                if (req.rewardPool >= rewardPerClaim) {
                    req.rewardPool -= rewardPerClaim;
                    claimableRewards[msg.sender][req.rewardToken] += rewardPerClaim;
                }
            }
        }
        emit TaskCompleted(msg.sender, _taskId, task.baseReward, block.timestamp, _referrer);
    }

    function claimDailyBonus() external whenNotPaused nonReentrant notBlacklisted {
        if (block.timestamp < userStats[msg.sender].lastDailyBonusClaim + 1 days) revert Unauthorized();

        userStats[msg.sender].lastDailyBonusClaim = block.timestamp;
        userStats[msg.sender].points += dailyBonusAmount;
        unsyncedPoints[msg.sender] += dailyBonusAmount;
        lastActivityTime[msg.sender] = block.timestamp;

        emit DailyBonusClaimed(msg.sender, dailyBonusAmount, block.timestamp);
    }

    function claimRewards(address _token) external whenNotPaused nonReentrant notBlacklisted {
        uint256 amount = claimableRewards[msg.sender][_token];
        if (amount == 0) revert Unauthorized();

        claimableRewards[msg.sender][_token] = 0;
        uint256 fee = (amount * withdrawalFeeBP) / 10000;
        uint256 userAmount = amount - fee;

        if (_token == address(0)) {
            (bool s, ) = payable(msg.sender).call{value: userAmount}("");
            if (!s) revert TransferFailed();
        } else {
            IERC20(_token).safeTransfer(msg.sender, userAmount);
        }
        emit RewardClaimed(msg.sender, _token, userAmount);
    }

    function setSettings(uint256 _fee, uint256 _minPool, uint256 _rewardClaim, uint256 _tasksGoal) external onlyRole(ADMIN_ROLE) {
        sponsorshipPlatformFee = _fee;
        minRewardPoolValue = _minPool;
        rewardPerClaim = _rewardClaim;
        tasksForReward = _tasksGoal;
    }

    function setAllowedToken(address _token, bool _status) external onlyRole(ADMIN_ROLE) {
        allowedPaymentTokens[_token] = _status;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    function setMasterX(address _masterX) external onlyRole(ADMIN_ROLE) {
        if (_masterX == address(0)) revert InvalidAddress();
        masterXContract = IMasterX(_masterX);
    }

    function setCreatorToken(address _token) external onlyRole(ADMIN_ROLE) {
        if (_token == address(0)) revert InvalidAddress();
        creatorToken = IERC20(_token);
        allowedPaymentTokens[_token] = true;
    }

    function setUSDCToken(address _token) external onlyRole(ADMIN_ROLE) {
        if (_token == address(0)) revert InvalidAddress();
        usdcToken = IERC20(_token);
        allowedPaymentTokens[_token] = true;
    }
    
    function setSponsorDuration(uint256 _duration) external onlyRole(ADMIN_ROLE) {
        if (_duration < 1 days || _duration > 30 days) revert InvalidParameters();
        sponsorDuration = _duration;
    }

    function setNFTConfig(
        NFTTier _tier,
        uint256 _pointsRequired,
        uint256 _mintPrice,
        uint256 _dailyBonus,
        uint256 _multiplierBP,
        uint256 _maxSupply,
        bool _isOpen
    ) external onlyRole(ADMIN_ROLE) {
        NFTConfig storage config = nftConfigs[_tier];
        config.pointsRequired = _pointsRequired;
        config.mintPrice = _mintPrice;
        config.dailyBonus = _dailyBonus;
        config.multiplierBP = _multiplierBP;
        config.maxSupply = _maxSupply;
        config.isOpen = _isOpen;
    }

    function setNFTConfigsBatch(
        NFTTier[] calldata _tiers,
        uint256[] calldata _pointsRequired,
        uint256[] calldata _mintPrices,
        uint256[] calldata _dailyBonuses,
        uint256[] calldata _multipliersBP,
        uint256[] calldata _maxSupplies,
        bool[] calldata _isOpens
    ) external onlyRole(ADMIN_ROLE) {
        if (_tiers.length == 0 ||
            _tiers.length != _pointsRequired.length ||
            _tiers.length != _mintPrices.length ||
            _tiers.length != _dailyBonuses.length ||
            _tiers.length != _multipliersBP.length ||
            _tiers.length != _maxSupplies.length ||
            _tiers.length != _isOpens.length) {
            revert InvalidParameters();
        }

        for (uint256 i = 0; i < _tiers.length; i++) {
            NFTConfig storage config = nftConfigs[_tiers[i]];
            config.pointsRequired = _pointsRequired[i];
            config.mintPrice = _mintPrices[i];
            config.dailyBonus = _dailyBonuses[i];
            config.multiplierBP = _multipliersBP[i];
            config.maxSupply = _maxSupplies[i];
            config.isOpen = _isOpens[i];
        }
    }

    function setWithdrawalFeeBP(uint256 _feeBP) external onlyRole(ADMIN_ROLE) {
        if (_feeBP > 2000) revert InvalidParameters(); // Max 20%
        withdrawalFeeBP = _feeBP;
    }

    function setDailyBonusAmount(uint256 _amount) external onlyRole(ADMIN_ROLE) {
        dailyBonusAmount = _amount;
    }

    function setSettings(
        uint256 _feeUSDC,
        uint256 _minPool,
        uint256 _reward,
        uint256 _tasks
    ) external onlyRole(ADMIN_ROLE) {
        sponsorshipPlatformFee = _feeUSDC;
        minRewardPoolValue = _minPool;
        rewardPerClaim = _reward;
        tasksForReward = _tasks;
    }

    function setAllowedToken(address _token, bool _status) external onlyRole(ADMIN_ROLE) {
        allowedPaymentTokens[_token] = _status;
    }

    function setGlobalRewards(uint256 _daily, uint256 _referral) external onlyRole(ADMIN_ROLE) {
        dailyBonusAmount = _daily;
        // baseReferralReward = _referral; // If added in future
    }

    function setAutoApproveSponsorship(bool _status) external onlyRole(ADMIN_ROLE) {
        autoApproveSponsorship = _status;
    }

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    receive() external payable {}
}
