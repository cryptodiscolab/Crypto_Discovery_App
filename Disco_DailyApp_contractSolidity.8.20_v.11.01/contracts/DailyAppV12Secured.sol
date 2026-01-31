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
 * @title DailyAppV12Secured
 * @notice Task-based gamification platform with NFT tiers, sponsorships, and social media verification
 * @dev Production-ready version with comprehensive security measures and verification support
 * @author DailyApp Team
 */
contract DailyAppV12Secured is ERC721, AccessControl, Pausable, ReentrancyGuard {
    using Strings for uint256;
    using SafeERC20 for IERC20;
    
    IERC20 public immutable creatorToken;

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
        bool requiresVerification;  // NEW: Flag for tasks requiring external verification
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
        string title; 
        string link; 
        string contactEmail; 
        uint256 paidAmount; 
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

    // --- MODIFIERS ---
    modifier validTier(NFTTier _tier) {
        require(_tier > NFTTier.NONE && _tier <= NFTTier.DIAMOND, "Invalid tier");
        _;
    }

    modifier notBlacklisted() {
        require(!userStats[msg.sender].isBlacklisted, "User blacklisted");
        _;
    }

    modifier validAddress(address _addr) {
        require(_addr != address(0), "Zero address");
        _;
    }

    // --- CONSTRUCTOR ---
    constructor(address _tokenAddress, address initialOwner) 
        ERC721("DailyApp Membership", "MEMBER") 
        validAddress(_tokenAddress)
        validAddress(initialOwner)
    {
        creatorToken = IERC20(_tokenAddress);
        
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
            requiresVerification: false
        });
    }

    // --- ADMIN: TASK MANAGEMENT ---
    
    function addTask(
        uint256 _baseReward,
        uint256 _cooldown,
        NFTTier _minTier,
        string calldata _title,
        string calldata _link,
        bool _requiresVerification
    ) external onlyRole(ADMIN_ROLE) validTier(_minTier) {
        require(_baseReward > 0 && _baseReward <= MAX_TASK_REWARD, "Invalid reward");
        require(_cooldown >= 1 hours, "Cooldown too short");
        require(bytes(_title).length > 0 && bytes(_title).length <= 100, "Invalid title length");
        require(bytes(_link).length <= 200, "Link too long");
        
        uint256 taskId = nextTaskId++;
        
        tasks[taskId] = Task({
            baseReward: _baseReward,
            isActive: true,
            cooldown: _cooldown,
            minTier: _minTier,
            title: _title,
            link: _link,
            createdAt: block.timestamp,
            requiresVerification: _requiresVerification
        });
        
        emit TaskAdded(taskId, _title, _baseReward, _requiresVerification);
    }

    function setTaskActive(uint256 _taskId, bool _isActive) external onlyRole(ADMIN_ROLE) {
        require(tasks[_taskId].baseReward > 0, "Task not exist");
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
        require(tasks[_taskId].baseReward > 0, "Task not exist");
        require(tasks[_taskId].requiresVerification, "Task doesn't require verification");
        require(!taskVerified[_user][_taskId], "Already verified");
        
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
        require(_newPrice > 0 && _newPrice <= 1 ether, "Price out of range");
        
        pendingPriceChange = PendingPriceChange({
            newPrice: _newPrice,
            effectiveTime: block.timestamp + PRICE_CHANGE_DELAY,
            isPending: true
        });
        
        emit PriceChangeScheduled(_newPrice, pendingPriceChange.effectiveTime);
    }

    function executePriceChange() external {
        require(pendingPriceChange.isPending, "No pending change");
        require(block.timestamp >= pendingPriceChange.effectiveTime, "Too early");
        
        uint256 oldPrice = tokenPriceUSD;
        tokenPriceUSD = pendingPriceChange.newPrice;
        
        delete pendingPriceChange;
        
        emit PriceUpdated(oldPrice, tokenPriceUSD);
    }

    function cancelPriceChange() external onlyRole(ADMIN_ROLE) {
        require(pendingPriceChange.isPending, "No pending change");
        delete pendingPriceChange;
    }
    
    function setPackagePricesUSD(uint256 _bronze, uint256 _silver, uint256 _gold) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(_bronze > 0 && _bronze < _silver && _silver < _gold, "Invalid price order");
        require(_gold <= 1000 ether, "Price too high");
        
        packagePricesUSD[0] = _bronze;
        packagePricesUSD[1] = _silver;
        packagePricesUSD[2] = _gold;
    }
    
    function setDiscount(uint256 _percent) external onlyRole(ADMIN_ROLE) {
        require(_percent <= MAX_DISCOUNT_PERCENT, "Discount too high");
        
        uint256 oldDiscount = currentDiscountPercent;
        currentDiscountPercent = _percent;
        
        emit DiscountUpdated(oldDiscount, _percent);
    }
    
    function setTierURI(NFTTier _tier, string calldata _uri) 
        external 
        onlyRole(ADMIN_ROLE) 
        validTier(_tier) 
    {
        require(bytes(_uri).length > 0, "Empty URI");
        tierURIs[_tier] = _uri;
        emit TierURIUpdated(_tier, _uri);
    }

    function updateNFTConfig(
        NFTTier _tier,
        uint256 _pointsRequired,
        uint256 _mintPrice,
        uint256 _multiplierBP
    ) external onlyRole(ADMIN_ROLE) validTier(_tier) {
        require(_pointsRequired > 0, "Points required > 0");
        require(_multiplierBP >= 10000 && _multiplierBP <= MAX_MULTIPLIER_BP, "Invalid multiplier");
        
        NFTConfig storage config = nftConfigs[_tier];
        config.pointsRequired = _pointsRequired;
        config.mintPrice = _mintPrice;
        config.multiplierBP = _multiplierBP;
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

    // --- CORE: PRICING CALCULATION ---
    
    function getCostInTokens(SponsorLevel _level) public view returns (uint256) {
        uint256 usdPrice = packagePricesUSD[uint256(_level)];
        
        require(usdPrice <= type(uint256).max / 1e18, "Price too high");
        
        uint256 tokenAmount = (usdPrice * 1e18) / tokenPriceUSD;
        
        if (currentDiscountPercent > 0) {
            uint256 discountAmount = (tokenAmount * currentDiscountPercent) / 100;
            tokenAmount = tokenAmount - discountAmount;
        }
        
        return tokenAmount;
    }

    // --- CORE: SPONSORSHIP SYSTEM ---
    
    function buySponsorshipWithToken(
        SponsorLevel _level, 
        string calldata _title, 
        string calldata _link, 
        string calldata _email
    ) external whenNotPaused nonReentrant notBlacklisted {
        require(bytes(_title).length > 0 && bytes(_title).length <= 100, "Invalid title");
        require(bytes(_link).length > 0 && bytes(_link).length <= 200, "Invalid link");
        require(bytes(_email).length > 0 && bytes(_email).length <= 100, "Invalid email");
        
        uint256 priceToPay = getCostInTokens(_level);
        require(priceToPay > 0, "Invalid price");
        
        require(creatorToken.balanceOf(msg.sender) >= priceToPay, "Insufficient balance");
        require(creatorToken.allowance(msg.sender, address(this)) >= priceToPay, "Insufficient allowance");

        totalSponsorRequests++;
        uint256 requestId = totalSponsorRequests;
        
        sponsorRequests[requestId] = SponsorRequest({
            sponsor: msg.sender,
            level: _level,
            title: _title,
            link: _link,
            contactEmail: _email,
            paidAmount: priceToPay,
            status: RequestStatus.PENDING,
            timestamp: block.timestamp
        });

        creatorToken.safeTransferFrom(msg.sender, address(this), priceToPay);

        emit SponsorshipRequested(requestId, msg.sender, _level, priceToPay);
    }

    function approveSponsorship(uint256 _reqId) external onlyRole(ADMIN_ROLE) {
        SponsorRequest storage req = sponsorRequests[_reqId];
        require(req.status == RequestStatus.PENDING, "Not pending");
        require(req.sponsor != address(0), "Invalid request");
        
        req.status = RequestStatus.APPROVED;
        
        uint256 reward;
        if (req.level == SponsorLevel.BRONZE) reward = 50;
        else if (req.level == SponsorLevel.SILVER) reward = 100;
        else reward = 200;
        
        uint256 newTaskId = nextTaskId++;
        
        tasks[newTaskId] = Task({
            baseReward: reward,
            isActive: true,
            cooldown: 86400,
            minTier: NFTTier.NONE,
            title: req.title,
            link: req.link,
            createdAt: block.timestamp,
            requiresVerification: false
        });
        
        emit SponsorshipApproved(_reqId, newTaskId);
        emit TaskAdded(newTaskId, req.title, reward, false);
    }

    function rejectSponsorship(uint256 _reqId, string calldata _reason) 
        external 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
    {
        SponsorRequest storage req = sponsorRequests[_reqId];
        require(req.status == RequestStatus.PENDING, "Not pending");
        require(req.sponsor != address(0), "Invalid request");
        require(bytes(_reason).length > 0, "Reason required");

        req.status = RequestStatus.REJECTED;

        uint256 penalty = (req.paidAmount * REFUND_PENALTY_PERCENT) / 100;
        uint256 refundAmount = req.paidAmount - penalty;

        creatorToken.safeTransfer(req.sponsor, refundAmount);
        
        emit SponsorshipRejected(_reqId, refundAmount, _reason);
    }

    // --- CORE: TASK COMPLETION ---
    
    function doTask(uint256 _taskId, address _referrer) 
        external 
        whenNotPaused 
        nonReentrant 
        notBlacklisted 
    {
        Task memory task = tasks[_taskId];
        UserStats storage stats = userStats[msg.sender];
        
        require(task.baseReward > 0, "Task not exist");
        require(task.isActive, "Task inactive");
        require(stats.currentTier >= task.minTier, "Tier too low");
        require(
            block.timestamp >= lastTaskTime[msg.sender][_taskId] + task.cooldown, 
            "Cooldown active"
        );
        
        // NEW: Check verification requirement
        if (task.requiresVerification) {
            require(taskVerified[msg.sender][_taskId], "Task not verified");
        }

        if (!_hasJoined[msg.sender]) {
            require(userCount < MAX_USERS, "Max users reached");
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
        
        emit TaskCompleted(msg.sender, _taskId, reward, block.timestamp);
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

        require(balanceOf(msg.sender) == 0 || currentTier < _tier, "Already own NFT");
        require(currentTier != _tier, "Already this tier");
        require(uint256(_tier) == uint256(currentTier) + 1, "Must upgrade sequentially");
        require(stats.points >= config.pointsRequired, "Insufficient points");
        require(msg.value >= config.mintPrice, "Insufficient ETH");
        
        require(config.currentSupply < config.maxSupply, "Tier sold out");

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
            require(success, "Refund failed");
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
            "Soulbound: transfers disabled"
        );
        
        return super._update(to, tokenId, auth);
    }

    // --- VIEW FUNCTIONS ---
    
    function calculateTaskReward(address _user, uint256 _taskId) 
        public 
        view 
        returns (uint256 base, uint256 final, uint256 multiplier) 
    {
        base = tasks[_taskId].baseReward;
        multiplier = nftConfigs[userStats[_user].currentTier].multiplierBP;
        
        if (multiplier == 0) {
            multiplier = 10000;
        }
        
        require(base <= MAX_TASK_REWARD, "Base reward too high");
        require(multiplier <= MAX_MULTIPLIER_BP, "Multiplier too high");
        
        uint256 product = base * multiplier;
        require(product / multiplier == base, "Overflow in calculation");
        
        final = product / 10000;
        
        return (base, final, multiplier);
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
        require(bytes(uri).length > 0, "URI not set");
        
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
        require(tasks[_taskId].baseReward > 0, "Task not exist");
        return tasks[_taskId];
    }

    function getSponsorRequest(uint256 _reqId) 
        external 
        view 
        returns (SponsorRequest memory) 
    {
        require(_reqId > 0 && _reqId <= totalSponsorRequests, "Invalid request ID");
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
        require(balance > 0, "No tokens");
        
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
        require(balance > 0, "No ETH");
        
        if (_amount == 0 || _amount > balance) {
            _amount = balance;
        }
        
        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        require(success, "ETH transfer failed");
        
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
        require(balance > 0, "No balance");
        
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
