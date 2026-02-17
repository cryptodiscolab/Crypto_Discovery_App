// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

/**
 * @title CryptoDiscoMasterX
 * @notice Optimized Revenue Distribution & Point System
 * @dev Modularized to stay under 24KB ceiling. Integrated with CryptoDiscoRaffle.
 */
contract CryptoDiscoMasterX is ReentrancyGuard, Pausable, Ownable {
    
    // ============ Enums & Structs ============
    
    enum SBTTier { NONE, BRONZE, SILVER, GOLD }
    
    struct UserData {
        uint256 points;
        uint64 lastClaimTimestamp;
        uint32 referralCount;
        SBTTier tier;
        bool isVerified;
        address referrer;
    }

    // ============ State Variables ============
    
    // Revenue shares
    uint256 public constant OWNER_SHARE = 4000;
    uint256 public constant OPS_SHARE = 2000;
    uint256 public constant SBT_POOL_SHARE = 3000;
    uint256 public constant TREASURY_SHARE = 1000;
    uint256 public constant BASIS_POINTS = 10000;
    
    // Point values
    uint256 public constant POINTS_DAILY_TASK = 10;
    uint256 public constant POINTS_REFERRAL = 2;
    
    // Tier weights
    uint256 public constant GOLD_WEIGHT = 50;
    uint256 public constant SILVER_WEIGHT = 30;
    uint256 public constant BRONZE_WEIGHT = 20;

    // Precision & Limits
    uint256 public constant REWARD_PRECISION = 1e18;
    uint256 public constant USD_DECIMALS = 6;
    
    // Logic state
    string public ticketDescription = "Raffle Ticket";
    uint256 public ticketPriceUSDC = 150000; // $0.15 (6 decimals)
    uint256 public pointsPerTicket = 15;
    uint256 public maxGasPrice = 100 gwei;
    uint256 public totalSBTPoolBalance;
    uint256 public totalLockedRewards;
    uint256 public lastDistributeTimestamp;
    uint256 public constant DISTRIBUTE_INTERVAL = 5 days;
    
    // Packed holder counts
    uint32 public goldHolders;
    uint32 public silverHolders;
    uint32 public bronzeHolders;

    address public operationsWallet;
    address public treasuryWallet;
    address public raffleContract;
    AggregatorV3Interface public priceFeed;
    
    mapping(address => UserData) public users;
    mapping(SBTTier => uint256) public accRewardPerShare;
    mapping(address => uint256) public userRewardDebt;
    mapping(address => bool) public isSatellite;

    // ============ Events ============
    
    event RevenueReceived(uint256 amount, uint256 timestamp);
    event SBTPoolDistributed(uint256 amount, uint256 goldAcc, uint256 silverAcc, uint256 bronzeAcc, uint256 timestamp);
    event ClaimProcessed(address indexed user, SBTTier tier, uint256 amount);
    uint256 public constant DISTRIBUTE_INTERVAL_SEC = 5 days; // for reference in testing
    event PointsAwarded(address indexed user, uint256 points, string reason);
    event TierUpdated(address indexed user, SBTTier oldTier, SBTTier newTier);
    event EmergencyWithdrawal(address indexed owner, uint256 amount);
    event TicketsPurchased(address indexed user, uint256 quantity, uint256 totalPaid);
    event RevenueDistributed(uint256 totalAmount, uint256 timestamp);

    // ============ Constructor ============
    
    constructor(
        address _ops,
        address _treasury,
        address _priceFeed
    ) Ownable(msg.sender) {
        operationsWallet = _ops;
        treasuryWallet = _treasury;
        priceFeed = AggregatorV3Interface(_priceFeed);
        lastDistributeTimestamp = block.timestamp;
    }

    // ============ Integration Hooks ============
    
    function setRaffleContract(address _raffle) external onlyOwner {
        raffleContract = _raffle;
    }

    function setSatelliteStatus(address _satellite, bool _status) external onlyOwner {
        isSatellite[_satellite] = _status;
    }

    function addPoints(address user, uint256 points, string calldata reason) external {
        require(msg.sender == raffleContract || isSatellite[msg.sender], "Unauthorized");
        users[user].points += points;
        emit PointsAwarded(user, points, reason);
    }

    // ============ Revenue Distribution ============
    
    receive() external payable whenNotPaused {
        if (msg.value > 0) {
            emit RevenueReceived(msg.value, block.timestamp);
        }
    }

    /**
     * @notice Distribute accumulated revenue in batch
     * @dev Shares: 40% Owner, 20% Ops, 30% SBT Pool, 10% Treasury
     * @dev Cooldown: 5 days, bypassed by Owner
     */
    function distributeRevenue() external nonReentrant whenNotPaused {
        uint256 totalBalance = address(this).balance;
        uint256 distributable = totalBalance > totalLockedRewards ? totalBalance - totalLockedRewards : 0;
        
        require(distributable > 0, "No revenue to distribute");
        require(
            msg.sender == owner() || block.timestamp >= lastDistributeTimestamp + DISTRIBUTE_INTERVAL,
            "Cooldown active"
        );

        uint256 ownerAmt = (distributable * OWNER_SHARE) / BASIS_POINTS;
        uint256 opsAmt = (distributable * OPS_SHARE) / BASIS_POINTS;
        uint256 sbtPoolAmt = (distributable * SBT_POOL_SHARE) / BASIS_POINTS;
        uint256 treasuryAmt = (distributable * TREASURY_SHARE) / BASIS_POINTS;

        // 1. Process Transfers
        (bool s1, ) = payable(owner()).call{value: ownerAmt}("");
        require(s1, "Owner payout failed");
        
        (bool s2, ) = payable(operationsWallet).call{value: opsAmt}("");
        require(s2, "Ops payout failed");

        (bool s3, ) = payable(treasuryWallet).call{value: treasuryAmt}("");
        require(s3, "Treasury payout failed");

        // 2. Distribute SBT Pool Share (Immediate accRewardPerShare update)
        _processSBTSplit(sbtPoolAmt);

        lastDistributeTimestamp = block.timestamp;
        emit RevenueDistributed(distributable, block.timestamp);
    }

    function _processSBTSplit(uint256 amount) internal {
        if (amount == 0) return;
        uint256 ownerOverflow = 0;
        
        unchecked {
            // Gold
            if (goldHolders > 0) {
                uint256 share = (amount * GOLD_WEIGHT) / 100;
                accRewardPerShare[SBTTier.GOLD] += (share * REWARD_PRECISION) / goldHolders;
                totalLockedRewards += share;
            } else {
                ownerOverflow += (amount * GOLD_WEIGHT) / 100;
            }
            
            // Silver
            if (silverHolders > 0) {
                uint256 share = (amount * SILVER_WEIGHT) / 100;
                accRewardPerShare[SBTTier.SILVER] += (share * REWARD_PRECISION) / silverHolders;
                totalLockedRewards += share;
            } else {
                ownerOverflow += (amount * SILVER_WEIGHT) / 100;
            }
            
            // Bronze
            if (bronzeHolders > 0) {
                uint256 share = (amount * BRONZE_WEIGHT) / 100;
                accRewardPerShare[SBTTier.BRONZE] += (share * REWARD_PRECISION) / bronzeHolders;
                totalLockedRewards += share;
            } else {
                ownerOverflow += (amount * BRONZE_WEIGHT) / 100;
            }
        }
        
        totalSBTPoolBalance += amount; // Historical tracking

        if (ownerOverflow > 0) {
            (bool success, ) = payable(owner()).call{value: ownerOverflow}("");
            require(success, "SBT Overflow failed");
        }
    }

    // Removed legacy _distributeRevenue and distributeSBTPool

    function claimSBTRewards() public nonReentrant whenNotPaused {
        require(tx.gasprice <= maxGasPrice, "Gas too high");
        SBTTier tier = users[msg.sender].tier;
        require(tier != SBTTier.NONE, "No tier");
        
        uint256 pending = (accRewardPerShare[tier] - userRewardDebt[msg.sender]) / REWARD_PRECISION;
        if (pending == 0) return;
        
        userRewardDebt[msg.sender] = accRewardPerShare[tier];
        users[msg.sender].lastClaimTimestamp = uint64(block.timestamp);
        
        if (pending > totalLockedRewards) pending = totalLockedRewards;
        totalLockedRewards -= pending;
        
        (bool success, ) = payable(msg.sender).call{value: pending}("");
        require(success, "Claim failed");
        
        emit ClaimProcessed(msg.sender, tier, pending);
    }

    // ============ User Management ============
    
    function updateUserTier(address user, SBTTier newTier) external onlyOwner {
        SBTTier oldTier = users[user].tier;
        if (oldTier == newTier) return;
        
        // Settle old rewards
        if (oldTier != SBTTier.NONE) {
            uint256 pending = (accRewardPerShare[oldTier] - userRewardDebt[user]) / REWARD_PRECISION;
            if (pending > 0) {
                if (pending > totalLockedRewards) pending = totalLockedRewards;
                totalLockedRewards -= pending;
                (bool success, ) = payable(user).call{value: pending}("");
                require(success, "Tier claim failed");
                emit ClaimProcessed(user, oldTier, pending);
            }
        }
        
        unchecked {
            if (oldTier == SBTTier.GOLD) goldHolders--;
            else if (oldTier == SBTTier.SILVER) silverHolders--;
            else if (oldTier == SBTTier.BRONZE) bronzeHolders--;
            
            if (newTier == SBTTier.GOLD) goldHolders++;
            else if (newTier == SBTTier.SILVER) silverHolders++;
            else if (newTier == SBTTier.BRONZE) bronzeHolders++;
        }
        
        users[user].tier = newTier;
        userRewardDebt[user] = accRewardPerShare[newTier];
        emit TierUpdated(user, oldTier, newTier);
    }

    // ============ Price Logic ============
    
    // ============ Raffle Sales (Master Store) ============
    
    /**
     * @notice Calculate ticket price in ETH using high-precision Oracle math
     * @dev (ticketPriceUSDC * 1e18 * 1e8) / (uint256(price) * 1e6)
     */
    function getTicketPriceInETH() public view returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid oracle price");
        
        // ticketPriceUSDC (6 decimals)
        // ETH (18 decimals)
        // Oracle Price (8 decimals)
        return (ticketPriceUSDC * 1e18 * 1e8) / (uint256(price) * 1e6);
    }

    /**
     * @notice Buy Raffle Tickets directly from Master Store
     * @dev Revenue is automatically distributed 40/20/30/10
     */
    function buyRaffleTickets(uint256 quantity) external payable nonReentrant whenNotPaused {
        require(quantity > 0, "Invalid quantity");
        uint256 ticketPrice = getTicketPriceInETH();
        uint256 totalRequired = (ticketPrice * quantity * 105) / 100;
        
        require(msg.value >= totalRequired, "Insufficient ETH");

        // 1. Award Points
        uint256 points = quantity * pointsPerTicket;
        users[msg.sender].points += points;
        emit PointsAwarded(msg.sender, points, "Raffle Purchase");

        // 2. Revenue (Accumulates in balance)
        // No immediate distribution here anymore.

        // 3. Handle Refund
        if (msg.value > totalRequired) {
            uint256 refund = msg.value - totalRequired;
            (bool success, ) = payable(msg.sender).call{value: refund}("");
            require(success, "Refund failed");
        }

        emit TicketsPurchased(msg.sender, quantity, totalRequired);
    }

    // ============ Admin ============
    
    function emergencyWithdraw() external onlyOwner {
        uint256 stuck = address(this).balance - totalLockedRewards;
        require(stuck > 0, "No funds");
        (bool success, ) = payable(owner()).call{value: stuck}("");
        require(success, "Emergency failed");
        emit EmergencyWithdrawal(owner(), stuck);
    }

    function setParams(
        uint256 _tUSDC, 
        uint256 _mGas, 
        uint256 _pPerTicket, 
        string calldata _desc
    ) external onlyOwner {
        ticketPriceUSDC = _tUSDC;
        maxGasPrice = _mGas;
        pointsPerTicket = _pPerTicket;
        ticketDescription = _desc;
    }
}
