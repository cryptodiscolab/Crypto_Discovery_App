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
    uint256 public ticketPriceUSD = 150000; // $0.15
    uint256 public maxGasPrice = 100 gwei;
    uint256 public totalSBTPoolBalance;
    uint256 public totalLockedRewards;
    uint256 public lastDistributionTimestamp;
    
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
    event SBTPoolDistributed(uint256 amount, uint256 timestamp);
    event ClaimProcessed(address indexed user, SBTTier tier, uint256 amount);
    event PointsAwarded(address indexed user, uint256 points, string reason);
    event TierUpdated(address indexed user, SBTTier oldTier, SBTTier newTier);
    event EmergencyWithdrawal(address indexed owner, uint256 amount);

    // ============ Constructor ============
    
    constructor(
        address _ops,
        address _treasury,
        address _priceFeed
    ) Ownable(msg.sender) {
        operationsWallet = _ops;
        treasuryWallet = _treasury;
        priceFeed = AggregatorV3Interface(_priceFeed);
        lastDistributionTimestamp = block.timestamp;
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
        if (msg.value == 0) return;
        
        uint256 ownerAmt = (msg.value * OWNER_SHARE) / BASIS_POINTS;
        uint256 opsAmt = (msg.value * OPS_SHARE) / BASIS_POINTS;
        uint256 sbtPoolAmt = (msg.value * SBT_POOL_SHARE) / BASIS_POINTS;
        
        payable(owner()).transfer(ownerAmt);
        payable(operationsWallet).transfer(opsAmt);
        
        totalSBTPoolBalance += sbtPoolAmt;
        emit RevenueReceived(msg.value, block.timestamp);
    }

    function distributeSBTPool() external nonReentrant whenNotPaused {
        uint256 totalWeight = (goldHolders * GOLD_WEIGHT) + (silverHolders * SILVER_WEIGHT) + (bronzeHolders * BRONZE_WEIGHT);
        if (totalWeight == 0) return;
        
        uint256 amount = totalSBTPoolBalance;
        totalLockedRewards += amount;
        
        if (goldHolders > 0) {
            uint256 share = (amount * goldHolders * GOLD_WEIGHT) / totalWeight;
            accRewardPerShare[SBTTier.GOLD] += (share * REWARD_PRECISION) / goldHolders;
        }
        if (silverHolders > 0) {
            uint256 share = (amount * silverHolders * SILVER_WEIGHT) / totalWeight;
            accRewardPerShare[SBTTier.SILVER] += (share * REWARD_PRECISION) / silverHolders;
        }
        if (bronzeHolders > 0) {
            uint256 share = (amount * bronzeHolders * BRONZE_WEIGHT) / totalWeight;
            accRewardPerShare[SBTTier.BRONZE] += (share * REWARD_PRECISION) / bronzeHolders;
        }
        
        totalSBTPoolBalance = 0;
        lastDistributionTimestamp = block.timestamp;
        emit SBTPoolDistributed(amount, block.timestamp);
    }

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
        payable(msg.sender).transfer(pending);
        
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
                payable(user).transfer(pending);
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
    
    function getTicketPriceInETH() public view returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return (ticketPriceUSD * 1e20) / uint256(price);
    }

    // ============ Admin ============
    
    function emergencyWithdraw() external onlyOwner {
        uint256 stuck = address(this).balance - totalLockedRewards;
        require(stuck > 0, "No funds");
        payable(owner()).transfer(stuck);
        emit EmergencyWithdrawal(owner(), stuck);
    }

    function setParams(uint256 _tUSD, uint256 _mGas) external onlyOwner {
        ticketPriceUSD = _tUSD;
        maxGasPrice = _mGas;
    }
}
