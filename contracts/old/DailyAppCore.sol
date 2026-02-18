// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./DailyAppTypes.sol";
import "./DailyAppSponsorship.sol";

/**
 * @title DailyAppCore
 * @notice Slimmed-down core contract: Task management, NFT minting/upgrading,
 *         user stats, pricing, and admin controls.
 *         Sponsorship logic is delegated to DailyAppSponsorship.sol.
 * @dev Designed to stay under 24KB compiled bytecode (viaIR: true, runs: 200).
 */
contract DailyAppCore is ERC721, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── ROLES ───────────────────────────────────────────────────────────────

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // ─── CONSTANTS ───────────────────────────────────────────────────────────

    uint256 public constant MAX_USERS = 1_000_000;
    uint256 public constant MAX_MULTIPLIER_BP = 100_000;
    uint256 public constant MAX_TASK_REWARD = 10_000;
    uint256 public constant REFERRAL_ACTIVATION_TASK_COUNT = 3;
    uint256 public constant BASE_REFERRAL_REWARD = 50;
    uint256 public constant PRICE_CHANGE_DELAY = 1 days;
    // FIX #5: Chainlink staleness threshold
    uint256 public constant PRICE_STALENESS_THRESHOLD = 1 hours;

    // ─── EXTERNAL CONTRACTS ──────────────────────────────────────────────────

    IERC20 public immutable creatorToken;
    IERC20 public paymentToken;
    AggregatorV3Interface public priceFeed;
    DailyAppSponsorship public sponsorshipContract;
    address public masterX;

    // ─── STATE ───────────────────────────────────────────────────────────────

    mapping(NFTTier => NFTConfig) public nftConfigs;
    mapping(uint256 => Task) public tasks;
    mapping(address => UserStats) public userStats;
    mapping(address => mapping(uint256 => uint256)) public lastTaskTime;
    mapping(address => address) public referrerOf;
    mapping(address => bool) private _hasJoined;
    mapping(NFTTier => string) public tierURIs;
    mapping(address => bool) public isValidReferrer;
    mapping(address => mapping(uint256 => bool)) public taskVerified;

    address[] private _userList;
    uint256 public userCount;
    uint256 public globalTxCount;
    uint256 public nextTaskId = 2;

    uint256[3] public packagePricesUSD = [10 ether, 50 ether, 100 ether];
    uint256 public tokenPriceUSD = 0.01 ether;
    uint256 public currentDiscountPercent = 0;
    PendingPriceChange public pendingPriceChange;

    // ─── EVENTS ──────────────────────────────────────────────────────────────

    event TaskCompleted(address indexed user, uint256 taskId, uint256 reward, uint256 timestamp);
    event NewMemberJoined(address indexed user, address indexed referrer, uint256 timestamp);
    event NFTMinted(address indexed user, NFTTier tier, uint256 tokenId);
    event NFTUpgraded(address indexed user, NFTTier fromTier, NFTTier toTier);
    event TaskAdded(uint256 indexed taskId, string title, uint256 baseReward, bool requiresVerification);
    event TaskUpdated(uint256 indexed taskId, bool isActive);
    event UserBlacklisted(address indexed user, bool status);
    event EmergencyWithdraw(address indexed token, uint256 amount);
    event TierURIUpdated(NFTTier indexed tier, string uri);
    event TaskVerified(address indexed user, uint256 indexed taskId, uint256 timestamp);
    event PriceChangeScheduled(uint256 newPrice, uint256 effectiveTime);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event DiscountUpdated(uint256 oldDiscount, uint256 newDiscount);
    event SponsorshipApprovedOnCore(uint256 indexed reqId, uint256 newTaskId);
    event SponsorshipContractUpdated(address indexed oldAddr, address indexed newAddr);

    // ─── MODIFIERS ───────────────────────────────────────────────────────────

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

    // ─── CONSTRUCTOR ─────────────────────────────────────────────────────────

    constructor(
        address _tokenAddress,
        address _paymentToken,
        address _priceFeed,
        address _sponsorshipContract,
        address initialOwner
    )
        ERC721("DailyApp Membership", "MEMBER")
        validAddress(_tokenAddress)
        validAddress(_paymentToken)
        validAddress(_priceFeed)
        validAddress(_sponsorshipContract)
        validAddress(initialOwner)
    {
        creatorToken = IERC20(_tokenAddress);
        paymentToken = IERC20(_paymentToken);
        priceFeed = AggregatorV3Interface(_priceFeed);
        sponsorshipContract = DailyAppSponsorship(payable(_sponsorshipContract));

        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(ADMIN_ROLE, initialOwner);

        _initNFTConfigs();
        _initDefaultTask();
    }

    function _initNFTConfigs() internal {
        nftConfigs[NFTTier.BRONZE]   = NFTConfig(1000,   0.001 ether, 50,   11000, 10000, 0);
        nftConfigs[NFTTier.SILVER]   = NFTConfig(5000,   0.005 ether, 100,  12000, 5000,  0);
        nftConfigs[NFTTier.GOLD]     = NFTConfig(20000,  0.02 ether,  200,  15000, 2000,  0);
        nftConfigs[NFTTier.PLATINUM] = NFTConfig(100000, 0.1 ether,   500,  20000, 1000,  0);
        nftConfigs[NFTTier.DIAMOND]  = NFTConfig(500000, 0.5 ether,   1000, 30000, 100,   0);
    }

    function _initDefaultTask() internal {
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

    // ─── ADMIN: TASK MANAGEMENT ───────────────────────────────────────────────

    function addTask(
        uint256 _baseReward,
        uint256 _cooldown,
        NFTTier _minTier,
        string calldata _title,
        string calldata _link,
        bool _requiresVerification
    ) external onlyRole(ADMIN_ROLE) validTier(_minTier) {
        if (_baseReward == 0 || _baseReward > MAX_TASK_REWARD) revert InvalidReward();
        if (_cooldown < 1 hours) revert InvalidCooldown();
        if (bytes(_title).length == 0 || bytes(_title).length > 100) revert InvalidTitle();
        if (bytes(_link).length > 200) revert InvalidLink();

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
        if (tasks[_taskId].baseReward == 0 && tasks[_taskId].sponsorshipId == 0)
            revert TaskDoesNotExist();
        tasks[_taskId].isActive = _isActive;
        emit TaskUpdated(_taskId, _isActive);
    }

    /**
     * @notice Admin approves a sponsorship and creates the task on-chain.
     *         Delegates approval to DailyAppSponsorship, then creates the task here.
     */
    function approveAndCreateSponsoredTask(uint256 _reqId) external onlyRole(ADMIN_ROLE) {
        // Delegate approval to sponsorship contract
        sponsorshipContract.approveSponsorship(_reqId);

        SponsorRequest memory req = sponsorshipContract.getSponsorRequest(_reqId);

        uint256 newTaskId = nextTaskId++;
        tasks[newTaskId] = Task({
            baseReward: 0,
            isActive: true,
            cooldown: 86400,
            minTier: NFTTier.NONE,
            title: req.title,
            link: req.link,
            createdAt: block.timestamp,
            requiresVerification: false,
            sponsorshipId: _reqId
        });

        emit SponsorshipApprovedOnCore(_reqId, newTaskId);
        emit TaskAdded(newTaskId, req.title, 0, false);
    }

    // ─── VERIFICATION ────────────────────────────────────────────────────────

    function markTaskAsVerified(address _user, uint256 _taskId)
        external onlyRole(VERIFIER_ROLE) validAddress(_user)
    {
        if (tasks[_taskId].baseReward == 0 && tasks[_taskId].sponsorshipId == 0)
            revert TaskDoesNotExist();
        if (!tasks[_taskId].requiresVerification) revert NotApproved();
        if (taskVerified[_user][_taskId]) revert AlreadyCompleted();

        taskVerified[_user][_taskId] = true;
        emit TaskVerified(_user, _taskId, block.timestamp);
    }

    function isTaskVerified(address _user, uint256 _taskId) external view returns (bool) {
        return taskVerified[_user][_taskId];
    }

    // ─── PRICING WITH TIMELOCK ────────────────────────────────────────────────

    function scheduleTokenPriceUpdate(uint256 _newPrice) external onlyRole(ADMIN_ROLE) {
        if (_newPrice == 0 || _newPrice > 1 ether) revert InvalidReward();
        pendingPriceChange = PendingPriceChange({
            newPrice: _newPrice,
            effectiveTime: block.timestamp + PRICE_CHANGE_DELAY,
            isPending: true
        });
        emit PriceChangeScheduled(_newPrice, pendingPriceChange.effectiveTime);
    }

    function executePriceChange() external {
        if (!pendingPriceChange.isPending) revert NotPending();
        if (block.timestamp < pendingPriceChange.effectiveTime) revert RewardsLocked();
        uint256 oldPrice = tokenPriceUSD;
        tokenPriceUSD = pendingPriceChange.newPrice;
        delete pendingPriceChange;
        emit PriceUpdated(oldPrice, tokenPriceUSD);
    }

    function cancelPriceChange() external onlyRole(ADMIN_ROLE) {
        if (!pendingPriceChange.isPending) revert NotPending();
        delete pendingPriceChange;
    }

    function setDiscount(uint256 _percent) external onlyRole(ADMIN_ROLE) {
        if (_percent > 50) revert InvalidReward();
        uint256 old = currentDiscountPercent;
        currentDiscountPercent = _percent;
        emit DiscountUpdated(old, _percent);
    }

    // ─── CHAINLINK PRICE FEED — FIX #5 ───────────────────────────────────────

    /**
     * @notice Returns latest ETH/USD price with staleness validation.
     * @dev FIX #5: Validates updatedAt and answeredInRound to prevent stale price usage.
     */
    function getLatestETHPrice() public view returns (uint256) {
        (
            uint80 roundId,
            int256 price,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        if (price <= 0) revert InvalidReward();
        if (answeredInRound < roundId) revert StalePrice();
        if (block.timestamp - updatedAt > PRICE_STALENESS_THRESHOLD) revert StalePrice();

        return uint256(price);
    }

    function convertUSDtoETH(uint256 usdAmount) public view returns (uint256) {
        uint256 ethPrice = getLatestETHPrice();
        return (usdAmount * 10**8) / ethPrice;
    }

    function convertETHtoUSD(uint256 ethAmount) public view returns (uint256) {
        uint256 ethPrice = getLatestETHPrice();
        return (ethAmount * ethPrice) / 10**8;
    }

    // ─── CORE: TASK COMPLETION ────────────────────────────────────────────────

    function doTask(uint256 _taskId, address _referrer)
        external whenNotPaused nonReentrant notBlacklisted
    {
        Task storage task = tasks[_taskId];
        UserStats storage stats = userStats[msg.sender];

        // FIX #6: Check both baseReward AND sponsorshipId for task existence
        if (task.baseReward == 0 && task.sponsorshipId == 0) revert TaskDoesNotExist();
        if (!task.isActive) revert TaskInactive();
        if (stats.currentTier < task.minTier) revert TierTooLow();

        // For sponsored tasks, check completion via sponsorship contract
        if (task.sponsorshipId > 0) {
            if (sponsorshipContract.taskCompletedByUser(_taskId, msg.sender)) revert AlreadyCompleted();
            SponsorRequest memory req = sponsorshipContract.getSponsorRequest(task.sponsorshipId);
            if (sponsorshipContract.taskParticipantsCount(_taskId) >= req.maxParticipants) revert TaskFull();
        }

        if (block.timestamp < lastTaskTime[msg.sender][_taskId] + task.cooldown) revert CooldownActive();
        if (task.requiresVerification && !taskVerified[msg.sender][_taskId]) revert TaskNotVerified();

        // Register new user
        if (!_hasJoined[msg.sender]) {
            if (userCount >= MAX_USERS) revert MaxUsersReached();
            _userList.push(msg.sender);
            _hasJoined[msg.sender] = true;
            userCount++;
        }

        // Register referrer
        if (referrerOf[msg.sender] == address(0) &&
            _referrer != address(0) &&
            _referrer != msg.sender &&
            _hasJoined[_referrer])
        {
            referrerOf[msg.sender] = _referrer;
            emit NewMemberJoined(msg.sender, _referrer, block.timestamp);
        }

        (, uint256 reward, ) = calculateTaskReward(msg.sender, _taskId);

        stats.points += reward;
        stats.totalTasksCompleted++;
        stats.tasksForReferralProgress++;
        lastTaskTime[msg.sender][_taskId] = block.timestamp;
        globalTxCount++;

        // Delegate completion recording to sponsorship contract (FIX #4: no array push)
        if (task.sponsorshipId > 0) {
            sponsorshipContract.recordTaskCompletion(_taskId, msg.sender);
        }

        // Reset verification flag
        if (task.requiresVerification) {
            taskVerified[msg.sender][_taskId] = false;
        }

        // Referral reward
        if (stats.tasksForReferralProgress == REFERRAL_ACTIVATION_TASK_COUNT) {
            address referrer = referrerOf[msg.sender];
            if (referrer != address(0) && !userStats[referrer].isBlacklisted) {
                userStats[referrer].points += BASE_REFERRAL_REWARD;
                userStats[referrer].referralCount++;
            }
        }

        emit TaskCompleted(msg.sender, _taskId, reward, block.timestamp);
    }

    // ─── NFT MINTING / UPGRADING ──────────────────────────────────────────────

    function mintNFT(NFTTier _tier)
        external payable whenNotPaused nonReentrant notBlacklisted validTier(_tier)
    {
        _mintOrUpgrade(_tier);
    }

    function upgradeNFT()
        external payable whenNotPaused nonReentrant notBlacklisted
    {
        NFTTier currentTier = userStats[msg.sender].currentTier;
        require(currentTier < NFTTier.DIAMOND, "Max tier reached");
        _mintOrUpgrade(NFTTier(uint256(currentTier) + 1));
    }

    function _mintOrUpgrade(NFTTier _tier) internal {
        NFTConfig storage config = nftConfigs[_tier];
        UserStats storage stats = userStats[msg.sender];
        NFTTier currentTier = stats.currentTier;

        if (balanceOf(msg.sender) != 0 && currentTier >= _tier) revert AlreadyOwnNFT();
        if (currentTier == _tier) revert AlreadyOwnNFT();
        if (uint256(_tier) != uint256(currentTier) + 1) revert SequentialUpgradeRequired();
        if (stats.points < config.pointsRequired) revert InsufficientPoints();

        uint256 requiredPayment = (config.mintPrice * 105) / 100;
        if (msg.value < requiredPayment) revert InsufficientPayment();
        if (config.currentSupply >= config.maxSupply) revert SoldOut();

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

        // Forward to MasterX — FIX #2: .call instead of .transfer
        if (masterX != address(0)) {
            (bool s, ) = payable(masterX).call{value: requiredPayment}("");
            if (!s) revert TransferFailed();
        }

        // Refund excess — FIX #2: .call instead of .transfer
        if (msg.value > requiredPayment) {
            (bool ok, ) = payable(msg.sender).call{value: msg.value - requiredPayment}("");
            if (!ok) revert TransferFailed();
        }
    }

    function mintNFTWithToken(NFTTier _tier)
        external whenNotPaused nonReentrant notBlacklisted validTier(_tier)
    {
        NFTConfig storage config = nftConfigs[_tier];
        UserStats storage stats = userStats[msg.sender];
        NFTTier currentTier = stats.currentTier;

        uint256 usdAmount = (convertETHtoUSD(config.mintPrice) * 105) / 100;
        if (paymentToken.balanceOf(msg.sender) < usdAmount) revert InsufficientPayment();
        if (paymentToken.allowance(msg.sender, address(this)) < usdAmount) revert InsufficientPayment();
        if (balanceOf(msg.sender) != 0 && currentTier >= _tier) revert AlreadyOwnNFT();
        if (currentTier == _tier) revert AlreadyOwnNFT();
        if (uint256(_tier) != uint256(currentTier) + 1) revert SequentialUpgradeRequired();
        if (stats.points < config.pointsRequired) revert InsufficientPoints();
        if (config.currentSupply >= config.maxSupply) revert SoldOut();

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

        paymentToken.safeTransferFrom(msg.sender, address(this), usdAmount);
    }

    // ─── SOULBOUND ────────────────────────────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth)
        internal virtual override returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Unauthorized();
        return super._update(to, tokenId, auth);
    }

    // ─── VIEW FUNCTIONS ───────────────────────────────────────────────────────

    function calculateTaskReward(address _user, uint256 _taskId)
        public view returns (uint256 base, uint256 finalReward, uint256 multiplier)
    {
        base = tasks[_taskId].baseReward;
        multiplier = nftConfigs[userStats[_user].currentTier].multiplierBP;
        if (multiplier == 0) multiplier = 10000;
        if (base > MAX_TASK_REWARD) revert InvalidReward();
        if (multiplier > MAX_MULTIPLIER_BP) revert InvalidReward();
        finalReward = (base * multiplier) / 10000;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        address owner = ownerOf(tokenId);
        NFTTier tier = userStats[owner].currentTier;
        string memory uri = tierURIs[tier];
        require(bytes(uri).length > 0, "URI not set");
        return uri;
    }

    /**
     * @notice FIX #6: Returns task data without reverting for sponsored tasks (baseReward == 0).
     */
    function getTask(uint256 _taskId) external view returns (Task memory) {
        Task memory task = tasks[_taskId];
        if (task.baseReward == 0 && task.sponsorshipId == 0) revert TaskDoesNotExist();
        return task;
    }

    function canDoTask(address _user, uint256 _taskId)
        external view returns (bool, string memory reason)
    {
        Task memory task = tasks[_taskId];
        UserStats memory stats = userStats[_user];
        if (task.baseReward == 0 && task.sponsorshipId == 0) return (false, "Task not exist");
        if (!task.isActive) return (false, "Task inactive");
        if (stats.isBlacklisted) return (false, "User blacklisted");
        if (stats.currentTier < task.minTier) return (false, "Tier too low");
        if (block.timestamp < lastTaskTime[_user][_taskId] + task.cooldown) return (false, "Cooldown active");
        if (task.requiresVerification && !taskVerified[_user][_taskId]) return (false, "Not verified");
        return (true, "");
    }

    function getUsers(uint256 _offset, uint256 _limit)
        external view returns (address[] memory users, uint256 total)
    {
        total = userCount;
        if (_offset >= total) return (new address[](0), total);
        uint256 end = _offset + _limit > total ? total : _offset + _limit;
        uint256 size = end - _offset;
        users = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            users[i] = _userList[_offset + i];
        }
    }

    function getUserStats(address _user) external view returns (UserStats memory) {
        return userStats[_user];
    }

    function getContractStats() external view returns (
        uint256 totalUsers, uint256 totalTransactions, uint256 contractETHBalance
    ) {
        return (userCount, globalTxCount, address(this).balance);
    }

    // ─── ADMIN: USER MANAGEMENT ───────────────────────────────────────────────

    function setUserBlacklist(address _user, bool _status)
        external onlyRole(ADMIN_ROLE) validAddress(_user)
    {
        userStats[_user].isBlacklisted = _status;
        emit UserBlacklisted(_user, _status);
    }

    function setValidReferrer(address _referrer, bool _status)
        external onlyRole(ADMIN_ROLE) validAddress(_referrer)
    {
        isValidReferrer[_referrer] = _status;
    }

    function setMasterX(address _m) external onlyRole(ADMIN_ROLE) { masterX = _m; }

    /**
     * @notice Update the DailyAppSponsorship contract address post-deploy.
     * @dev Required if Sponsorship contract is redeployed without redeploying Core.
     *      Also call sponsorshipContract.setCoreContract(address(this)) after updating.
     */
    function setSponsorshipContract(address _newSponsorship)
        external onlyRole(ADMIN_ROLE) validAddress(_newSponsorship)
    {
        address old = address(sponsorshipContract);
        sponsorshipContract = DailyAppSponsorship(payable(_newSponsorship));
        emit SponsorshipContractUpdated(old, _newSponsorship);
    }

    function setTierURI(NFTTier _tier, string calldata _uri)
        external onlyRole(ADMIN_ROLE) validTier(_tier)
    {
        if (bytes(_uri).length == 0) revert InvalidLink();
        tierURIs[_tier] = _uri;
        emit TierURIUpdated(_tier, _uri);
    }

    function updateNFTConfig(
        NFTTier _tier, uint256 _pointsRequired, uint256 _mintPrice, uint256 _multiplierBP
    ) external onlyRole(ADMIN_ROLE) validTier(_tier) {
        if (_pointsRequired == 0) revert InvalidReward();
        if (_multiplierBP < 10000 || _multiplierBP > MAX_MULTIPLIER_BP) revert InvalidReward();
        NFTConfig storage config = nftConfigs[_tier];
        config.pointsRequired = _pointsRequired;
        config.mintPrice = _mintPrice;
        config.multiplierBP = _multiplierBP;
    }

    // ─── ADMIN: EMERGENCY ────────────────────────────────────────────────────

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    function withdrawETH(uint256 _amount) external onlyRole(ADMIN_ROLE) nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert PoolEmpty();
        if (_amount == 0 || _amount > balance) _amount = balance;
        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        if (!success) revert TransferFailed();
        emit EmergencyWithdraw(address(0), _amount);
    }

    function withdrawTokens(uint256 _amount) external onlyRole(ADMIN_ROLE) nonReentrant {
        uint256 balance = creatorToken.balanceOf(address(this));
        require(balance > 0, "No tokens");
        if (_amount == 0 || _amount > balance) _amount = balance;
        creatorToken.safeTransfer(msg.sender, _amount);
        emit EmergencyWithdraw(address(creatorToken), _amount);
    }

    function emergencyWithdrawToken(address _token, uint256 _amount)
        external onlyRole(ADMIN_ROLE) nonReentrant validAddress(_token)
    {
        IERC20 token = IERC20(_token);
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert PoolEmpty();
        if (_amount == 0 || _amount > balance) _amount = balance;
        token.safeTransfer(msg.sender, _amount);
        emit EmergencyWithdraw(_token, _amount);
    }

    // ─── OVERRIDES ────────────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    receive() external payable {}
}
