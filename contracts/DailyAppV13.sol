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

    uint256 public totalSponsorRequests;
    uint256 public nextTaskId = 1;

    IMasterX public masterXContract;
    mapping(address => uint256) public unsyncedPoints;
    mapping(address => bool) public allowedPaymentTokens;

    // --- EVENTS ---
    event TaskCompleted(address indexed user, uint256 taskId, uint256 reward, uint256 timestamp);
    event SponsorshipRequested(uint256 indexed reqId, address indexed sponsor, uint256 amount, address token);
    event SponsorshipApproved(uint256 indexed reqId);
    event TaskVerified(address indexed user, uint256 indexed taskId);
    event RewardClaimed(address indexed user, address indexed token, uint256 amount);
    event TaskAdded(uint256 indexed taskId, string title);

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

    function doTask(uint256 _taskId) external whenNotPaused nonReentrant notBlacklisted {
        Task memory task = tasks[_taskId];
        if (!task.isActive) revert NotFound();
        if (hasCompletedTask[msg.sender][_taskId]) revert AlreadyCompleted();
        if (task.requiresVerification && !taskVerified[msg.sender][_taskId]) revert Unauthorized();

        hasCompletedTask[msg.sender][_taskId] = true;
        userStats[msg.sender].totalTasksCompleted++;
        userStats[msg.sender].points += task.baseReward;
        unsyncedPoints[msg.sender] += task.baseReward;

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
        emit TaskCompleted(msg.sender, _taskId, task.baseReward, block.timestamp);
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
    
    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    receive() external payable {}
}
