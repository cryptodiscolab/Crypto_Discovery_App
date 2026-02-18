// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./DailyAppTypes.sol";

/**
 * @title DailyAppSponsorship
 * @notice Handles all sponsorship logic: buy, approve, reject, claim, recover.
 *         Separated from core contract to reduce bytecode size below 24KB.
 * @dev Deployed independently. Core contract calls this via interface.
 */
contract DailyAppSponsorship is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 public constant REFUND_PENALTY_PERCENT = 10;
    uint256 public constant MAX_DISCOUNT_PERCENT = 50;

    IERC20 public immutable creatorToken;
    IERC20 public paymentToken;

    // Pricing
    uint256[3] public packagePricesUSD = [10 ether, 50 ether, 100 ether];
    uint256 public tokenPriceUSD = 0.01 ether;
    uint256 public currentDiscountPercent = 0;

    // Sponsorship state
    mapping(uint256 => SponsorRequest) public sponsorRequests;
    uint256 public totalSponsorRequests;

    // Task participant tracking (count only — no unbounded array)
    mapping(uint256 => uint256) public taskParticipantsCount;
    mapping(uint256 => mapping(address => bool)) public taskCompletedByUser;
    mapping(uint256 => mapping(address => bool)) public taskPaidOutByUser;

    // Reference to core contract for task creation
    address public coreContract;

    // ─── EVENTS ──────────────────────────────────────────────────────────────

    event SponsorshipRequested(uint256 indexed reqId, address indexed sponsor, SponsorLevel level, uint256 amount);
    event SponsorshipApproved(uint256 indexed reqId, uint256 newTaskId);
    event SponsorshipRejected(uint256 indexed reqId, uint256 refundAmount, string reason);
    event RewardClaimed(address indexed user, uint256 indexed taskId, uint256 amount);
    event DustRecovered(uint256 indexed taskId, uint256 amount);

    // ─── CONSTRUCTOR ─────────────────────────────────────────────────────────

    constructor(address _creatorToken, address _paymentToken, address _admin) {
        if (_creatorToken == address(0) || _paymentToken == address(0) || _admin == address(0))
            revert InvalidAddress();

        creatorToken = IERC20(_creatorToken);
        paymentToken = IERC20(_paymentToken);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
    }

    // ─── ADMIN ────────────────────────────────────────────────────────────────

    function setCoreContract(address _core) external onlyRole(ADMIN_ROLE) {
        if (_core == address(0)) revert InvalidAddress();
        coreContract = _core;
    }

    function setPackagePricesUSD(uint256 _bronze, uint256 _silver, uint256 _gold)
        external onlyRole(ADMIN_ROLE)
    {
        if (!(_bronze > 0 && _bronze < _silver && _silver < _gold) || _gold > 1000 ether)
            revert InvalidReward();
        packagePricesUSD[0] = _bronze;
        packagePricesUSD[1] = _silver;
        packagePricesUSD[2] = _gold;
    }

    function setDiscount(uint256 _percent) external onlyRole(ADMIN_ROLE) {
        if (_percent > MAX_DISCOUNT_PERCENT) revert InvalidReward();
        currentDiscountPercent = _percent;
    }

    // ─── PRICING ─────────────────────────────────────────────────────────────

    function getCostInTokens(SponsorLevel _level) public view returns (uint256) {
        uint256 usdPrice = packagePricesUSD[uint256(_level)];
        uint256 tokenAmount = (usdPrice * 1e18) / tokenPriceUSD;
        if (currentDiscountPercent > 0) {
            tokenAmount -= (tokenAmount * currentDiscountPercent) / 100;
        }
        return tokenAmount;
    }

    // ─── BUY SPONSORSHIP ─────────────────────────────────────────────────────

    function buySponsorshipWithToken(
        SponsorLevel _level,
        string calldata _title,
        string calldata _link,
        string calldata _email,
        uint256 _rewardAmount,
        uint256 _maxParticipants
    ) external whenNotPaused nonReentrant {
        if (_maxParticipants == 0 || _rewardAmount == 0) revert InvalidReward();
        if ((_rewardAmount / _maxParticipants) < 0.01 ether) revert RewardTooLow();

        uint256 feeToPay = getCostInTokens(_level);
        if (paymentToken.balanceOf(msg.sender) < feeToPay) revert InsufficientPayment();
        if (paymentToken.allowance(msg.sender, address(this)) < feeToPay) revert InsufficientPayment();
        if (creatorToken.balanceOf(msg.sender) < _rewardAmount) revert InsufficientPoints();
        if (creatorToken.allowance(msg.sender, address(this)) < _rewardAmount) revert InsufficientPoints();

        _processSponsorship(msg.sender, _level, _title, _link, _email, feeToPay, address(paymentToken), _rewardAmount, _maxParticipants);

        paymentToken.safeTransferFrom(msg.sender, address(this), feeToPay);
        creatorToken.safeTransferFrom(msg.sender, address(this), _rewardAmount);
    }

    function buySponsorshipWithETH(
        SponsorLevel _level,
        string calldata _title,
        string calldata _link,
        string calldata _email,
        uint256 _rewardAmount,
        uint256 _maxParticipants,
        address _masterX,
        uint256 _ethFee
    ) external payable whenNotPaused nonReentrant {
        if (_maxParticipants == 0 || _rewardAmount == 0) revert InvalidReward();
        if ((_rewardAmount / _maxParticipants) < 0.01 ether) revert RewardTooLow();
        if (msg.value < _ethFee) revert InsufficientPayment();
        if (creatorToken.balanceOf(msg.sender) < _rewardAmount) revert InsufficientPoints();
        if (creatorToken.allowance(msg.sender, address(this)) < _rewardAmount) revert InsufficientPoints();

        _processSponsorship(msg.sender, _level, _title, _link, _email, _ethFee, address(0), _rewardAmount, _maxParticipants);

        creatorToken.safeTransferFrom(msg.sender, address(this), _rewardAmount);

        // Forward fee to MasterX — FIX #2: use .call instead of .transfer
        if (_masterX != address(0)) {
            (bool s, ) = payable(_masterX).call{value: _ethFee}("");
            if (!s) revert TransferFailed();
        }

        // Refund excess ETH — FIX #2: use .call instead of .transfer
        if (msg.value > _ethFee) {
            (bool ok, ) = payable(msg.sender).call{value: msg.value - _ethFee}("");
            if (!ok) revert TransferFailed();
        }
    }

    // ─── INTERNAL ────────────────────────────────────────────────────────────

    function _processSponsorship(
        address _sponsor,
        SponsorLevel _level,
        string memory _title,
        string memory _link,
        string memory _email,
        uint256 _feePaid,
        address _feeToken,
        uint256 _rewardAmount,
        uint256 _maxParticipants
    ) internal {
        if (bytes(_title).length == 0 || bytes(_title).length > 100) revert InvalidTitle();
        if (bytes(_link).length == 0 || bytes(_link).length > 200) revert InvalidLink();
        if (bytes(_email).length == 0 || bytes(_email).length > 100) revert InvalidTitle();

        totalSponsorRequests++;
        uint256 requestId = totalSponsorRequests;

        sponsorRequests[requestId] = SponsorRequest({
            sponsor: _sponsor,
            level: _level,
            title: _title,
            link: _link,
            contactEmail: _email,
            feePaid: _feePaid,
            feeToken: _feeToken,
            rewardAmount: _rewardAmount,
            maxParticipants: _maxParticipants,
            rewardPerUser: _rewardAmount / _maxParticipants,
            status: RequestStatus.PENDING,
            timestamp: block.timestamp,
            unlockTime: 0
        });

        emit SponsorshipRequested(requestId, _sponsor, _level, _feePaid);
    }

    // ─── ADMIN: APPROVE / REJECT ──────────────────────────────────────────────

    /**
     * @notice Approve a sponsorship. Returns the new taskId for the core contract to create.
     */
    function approveSponsorship(uint256 _reqId) external onlyRole(ADMIN_ROLE) returns (uint256 reqId) {
        SponsorRequest storage req = sponsorRequests[_reqId];
        if (req.status != RequestStatus.PENDING) revert NotPending();
        if (req.sponsor == address(0)) revert InvalidAddress();

        req.status = RequestStatus.APPROVED;
        req.unlockTime = block.timestamp + 37 days;

        emit SponsorshipApproved(_reqId, 0); // taskId assigned by core
        return _reqId;
    }

    function rejectSponsorship(uint256 _reqId, string calldata _reason)
        external onlyRole(ADMIN_ROLE) nonReentrant
    {
        SponsorRequest storage req = sponsorRequests[_reqId];
        if (req.status != RequestStatus.PENDING) revert NotPending();
        if (req.sponsor == address(0)) revert InvalidAddress();
        if (bytes(_reason).length == 0) revert InvalidTitle();

        req.status = RequestStatus.REJECTED;

        uint256 penalty = (req.feePaid * REFUND_PENALTY_PERCENT) / 100;
        uint256 refundAmount = req.feePaid - penalty;

        // FIX #2: .call instead of .transfer for ETH refund
        if (req.feeToken == address(0)) {
            (bool success, ) = payable(req.sponsor).call{value: refundAmount}("");
            if (!success) revert TransferFailed();
        } else {
            paymentToken.safeTransfer(req.sponsor, refundAmount);
        }

        creatorToken.safeTransfer(req.sponsor, req.rewardAmount);

        emit SponsorshipRejected(_reqId, refundAmount, _reason);
    }

    // ─── USER: CLAIM REWARD ───────────────────────────────────────────────────

    function claimSponsorshipReward(uint256 _taskId, uint256 _reqId) external nonReentrant whenNotPaused {
        SponsorRequest storage req = sponsorRequests[_reqId];
        if (req.status != RequestStatus.APPROVED) revert NotApproved();
        if (!taskCompletedByUser[_taskId][msg.sender]) revert TierTooLow();
        if (taskPaidOutByUser[_taskId][msg.sender]) revert AlreadyClaimed();

        bool periodFinished = block.timestamp >= req.timestamp + 30 days;
        bool maxReached = taskParticipantsCount[_taskId] >= req.maxParticipants;
        if (!(periodFinished || maxReached)) revert RewardsLocked();

        uint256 rewardAmount = req.rewardPerUser;
        if (req.rewardAmount < rewardAmount) revert PoolEmpty();

        taskPaidOutByUser[_taskId][msg.sender] = true;
        req.rewardAmount -= rewardAmount;

        creatorToken.safeTransfer(msg.sender, rewardAmount);
        emit RewardClaimed(msg.sender, _taskId, rewardAmount);
    }

    // ─── ADMIN: RECOVER DUST ──────────────────────────────────────────────────

    function recoverUnclaimedRewards(uint256 _reqId) external onlyRole(ADMIN_ROLE) nonReentrant {
        SponsorRequest storage req = sponsorRequests[_reqId];
        if (req.status != RequestStatus.APPROVED) revert NotApproved();
        if (block.timestamp < req.unlockTime) revert RewardsLocked();
        if (req.rewardAmount == 0) revert PoolEmpty();

        uint256 amount = req.rewardAmount;
        req.rewardAmount = 0;

        creatorToken.safeTransfer(msg.sender, amount);
        emit DustRecovered(_reqId, amount);
    }

    // ─── CALLED BY CORE ──────────────────────────────────────────────────────

    /**
     * @notice Called by core contract's doTask() to record task completion.
     *         FIX #4: No array push — only count + mapping.
     */
    function recordTaskCompletion(uint256 _taskId, address _user) external {
        if (msg.sender != coreContract) revert Unauthorized();
        taskCompletedByUser[_taskId][_user] = true;
        taskParticipantsCount[_taskId]++;
        // ✅ FIX #4: taskParticipants[] array REMOVED — use TaskCompleted event for off-chain indexing
    }

    // ─── VIEWS ────────────────────────────────────────────────────────────────

    function getSponsorRequest(uint256 _reqId) external view returns (SponsorRequest memory) {
        if (_reqId == 0 || _reqId > totalSponsorRequests) revert NotApproved();
        return sponsorRequests[_reqId];
    }

    receive() external payable {}
}
