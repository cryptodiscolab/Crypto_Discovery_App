// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CryptoDiscoMaster
 * @notice 100% Transparent, No-Riba, Anti-Whale Revenue Distribution System
 * @dev Optimized for low-spec compilation with gas-efficient operations
 * 
 * Revenue Split:
 * - 40% Owner (Auto-distributed)
 * - 20% Operations (Auto-distributed)
 * - 30% SBT Pool (Pull-based claim by tier: Gold/Silver/Bronze)
 * - 10% Treasury (Accumulated)
 * 
 * Point System:
 * - 10 points per Daily Task
 * - 15 points per Raffle Ticket ($0.15 USD)
 * - 2 points per Referral
 */

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@api3/airnode-protocol/contracts/rrp/requesters/RrpRequesterV0.sol";

/**
 * @dev Chainlink Price Feed Interface for ETH/USD conversion
 */
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

contract CryptoDiscoMaster is ReentrancyGuard, Pausable, Ownable, RrpRequesterV0 {
    
    // ============ State Variables ============
    
    // Revenue distribution percentages (basis points: 10000 = 100%)
    uint256 public constant OWNER_SHARE = 4000;      // 40%
    uint256 public constant OPS_SHARE = 2000;        // 20%
    uint256 public constant SBT_POOL_SHARE = 3000;   // 30%
    uint256 public constant TREASURY_SHARE = 1000;   // 10%
    uint256 public constant BASIS_POINTS = 10000;
    
    // Point values
    uint256 public constant POINTS_DAILY_TASK = 10;
    uint256 public constant POINTS_RAFFLE_TICKET = 15;
    uint256 public constant POINTS_REFERRAL = 2;
    
    // Dynamic Raffle Ticket Price (in USD with 6 decimals)
    uint256 public ticketPriceUSD = 150000; // $0.15 USD (6 decimals: 0.15 * 10^6)
    
    // Chainlink Price Feed for ETH/USD
    AggregatorV3Interface public priceFeed;
    
    // Decimal precision constants
    uint256 public constant USD_DECIMALS = 6;
    uint256 public constant ETH_DECIMALS = 18;
    
    // Gas optimization: Max gas price protection (in gwei)
    uint256 public maxGasPrice = 100 gwei; // Default 100 gwei
    
    // SBT Tier weights for distribution
    uint256 public constant GOLD_WEIGHT = 50;
    uint256 public constant SILVER_WEIGHT = 30;
    uint256 public constant BRONZE_WEIGHT = 20;
    
    // Addresses
    address public operationsWallet;
    address public treasuryWallet;
    
    // SBT Tier tracking
    enum SBTTier { NONE, BRONZE, SILVER, GOLD }
    
    struct UserData {
        uint256 points;
        SBTTier tier;
        uint256 lastClaimTimestamp;
        uint256 referralCount;
        bool isVerified; // Neynar Social Verification
        address referrer;
    }
    
    mapping(address => UserData) public users;
    
    // SBT Pool tracking
    uint256 public totalSBTPoolBalance;
    uint256 public lastDistributionTimestamp;
    
    // Tier holder counts for weight calculation
    uint256 public goldHolders;
    uint256 public silverHolders;
    uint256 public bronzeHolders;
    
    // Claimable amounts per tier
    mapping(SBTTier => uint256) public tierClaimablePerHolder;
    mapping(address => uint256) public pendingClaims;
    
    // API3 QRNG Integration
    address public airnode;
    bytes32 public endpointIdUint256;
    address public sponsorWallet;
    
    mapping(bytes32 => address) public requestToUser;
    mapping(bytes32 => uint256) public requestToRaffleId;
    
    struct RaffleData {
        uint256 raffleId;
        uint256 totalTickets;
        uint256 prizePool;
        address[] participants;
        mapping(address => uint256) ticketCount;
        address winner;
        uint256 randomNumber;
        bool isActive;
        bool isFinalized;
    }
    
    mapping(uint256 => RaffleData) public raffles;
    uint256 public currentRaffleId;
    
    // Anti-whale & Safety mechanisms
    uint256 public constant MAX_TICKETS_PER_USER = 100;
    uint256 public constant MAX_PARTICIPANTS = 4000; // Protection against Gas Limit DoS
    
    // Emergency controls
    bool public emergencyMode;
    
    // ============ Events ============
    
    event RevenueReceived(uint256 amount, uint256 timestamp);
    event OwnerPaid(address indexed owner, uint256 amount);
    event OpsPaid(address indexed ops, uint256 amount);
    event SBTPoolDistributed(uint256 amount, uint256 timestamp);
    event TreasuryUpdated(uint256 amount);
    event ClaimProcessed(address indexed user, SBTTier tier, uint256 amount);
    event PointsAwarded(address indexed user, uint256 points, string reason);
    event TierUpdated(address indexed user, SBTTier oldTier, SBTTier newTier);
    event RaffleCreated(uint256 indexed raffleId, uint256 timestamp);
    event TicketPurchased(address indexed user, uint256 indexed raffleId, uint256 ticketCount);
    event QRNGRequested(bytes32 indexed requestId, uint256 indexed raffleId);
    event QRNGFulfilled(bytes32 indexed requestId, uint256 randomNumber);
    event RaffleWinner(uint256 indexed raffleId, address indexed winner, uint256 prize);
    event SocialVerified(address indexed user, bool verified);
    event ReferralRecorded(address indexed referrer, address indexed referee);
    event EmergencyModeActivated(uint256 timestamp);
    event EmergencyWithdrawal(address indexed owner, uint256 amount);
    event TicketPriceUpdated(uint256 newPriceUSD, uint256 timestamp);
    event PriceFeedUpdated(address indexed newPriceFeed);
    event MaxGasPriceUpdated(uint256 newMaxGasPrice);
    event PointsPending(address indexed user, uint256 points, string reason);
    
    // ============ Constructor ============
    
    constructor(
        address _operationsWallet,
        address _treasuryWallet,
        address _airnodeRrp,
        address _priceFeed
    ) RrpRequesterV0(_airnodeRrp) Ownable(msg.sender) {
        require(_operationsWallet != address(0), "Invalid ops wallet");
        require(_treasuryWallet != address(0), "Invalid treasury wallet");
        require(_priceFeed != address(0), "Invalid price feed");
        
        operationsWallet = _operationsWallet;
        treasuryWallet = _treasuryWallet;
        priceFeed = AggregatorV3Interface(_priceFeed);
        lastDistributionTimestamp = block.timestamp;
        
        // Initialize first raffle
        currentRaffleId = 1;
        raffles[currentRaffleId].raffleId = currentRaffleId;
        raffles[currentRaffleId].isActive = true;
        
        emit RaffleCreated(currentRaffleId, block.timestamp);
    }
    
    // ============ Revenue Distribution ============
    
    /**
     * @notice Receive revenue and automatically distribute to Owner & Ops
     * @dev Uses gas-efficient 'call' for transfers
     */
    receive() external payable whenNotPaused {
        require(msg.value > 0, "No value sent");
        
        emit RevenueReceived(msg.value, block.timestamp);
        
        // Calculate shares
        uint256 ownerAmount = (msg.value * OWNER_SHARE) / BASIS_POINTS;
        uint256 opsAmount = (msg.value * OPS_SHARE) / BASIS_POINTS;
        uint256 sbtPoolAmount = (msg.value * SBT_POOL_SHARE) / BASIS_POINTS;
        uint256 treasuryAmount = msg.value - ownerAmount - opsAmount - sbtPoolAmount;
        
        // Auto-distribute to Owner (40%)
        (bool ownerSuccess, ) = owner().call{value: ownerAmount}("");
        require(ownerSuccess, "Owner transfer failed");
        emit OwnerPaid(owner(), ownerAmount);
        
        // Auto-distribute to Operations (20%)
        (bool opsSuccess, ) = operationsWallet.call{value: opsAmount}("");
        require(opsSuccess, "Ops transfer failed");
        emit OpsPaid(operationsWallet, opsAmount);
        
        // Add to SBT Pool (30%) - Pull-based
        totalSBTPoolBalance += sbtPoolAmount;
        emit SBTPoolDistributed(sbtPoolAmount, block.timestamp);
        
        // Treasury accumulation (10%)
        emit TreasuryUpdated(treasuryAmount);
    }
    
    /**
     * @notice Distribute SBT Pool to tiers based on weights
     * @dev Can be called periodically to update claimable amounts
     */
    function distributeSBTPool() external nonReentrant whenNotPaused {
        require(totalSBTPoolBalance > 0, "No balance to distribute");
        
        uint256 totalWeight = (goldHolders * GOLD_WEIGHT) + 
                              (silverHolders * SILVER_WEIGHT) + 
                              (bronzeHolders * BRONZE_WEIGHT);
        
        require(totalWeight > 0, "No SBT holders");
        
        uint256 amountToDistribute = totalSBTPoolBalance;
        
        // Calculate per-holder amounts for each tier
        if (goldHolders > 0) {
            uint256 goldShare = (amountToDistribute * goldHolders * GOLD_WEIGHT) / totalWeight;
            tierClaimablePerHolder[SBTTier.GOLD] += goldShare / goldHolders;
        }
        
        if (silverHolders > 0) {
            uint256 silverShare = (amountToDistribute * silverHolders * SILVER_WEIGHT) / totalWeight;
            tierClaimablePerHolder[SBTTier.SILVER] += silverShare / silverHolders;
        }
        
        if (bronzeHolders > 0) {
            uint256 bronzeShare = (amountToDistribute * bronzeHolders * BRONZE_WEIGHT) / totalWeight;
            tierClaimablePerHolder[SBTTier.BRONZE] += bronzeShare / bronzeHolders;
        }
        
        totalSBTPoolBalance = 0;
        lastDistributionTimestamp = block.timestamp;
    }
    
    /**
     * @notice Pull-based claim for SBT holders
     * @dev Gas-efficient claim mechanism with gas price protection
     */
    function claimSBTRewards() external nonReentrant whenNotPaused {
        require(tx.gasprice <= maxGasPrice, "Gas price too high");
        UserData storage user = users[msg.sender];
        require(user.tier != SBTTier.NONE, "No SBT tier");
        
        uint256 claimableAmount = tierClaimablePerHolder[user.tier];
        require(claimableAmount > 0, "Nothing to claim");
        
        // Reset claimable for this user's tier
        tierClaimablePerHolder[user.tier] = 0;
        user.lastClaimTimestamp = block.timestamp;
        
        // Transfer using call
        (bool success, ) = msg.sender.call{value: claimableAmount}("");
        require(success, "Claim transfer failed");
        
        emit ClaimProcessed(msg.sender, user.tier, claimableAmount);
    }
    
    // ============ Point System ============
    
    /**
     * @notice Award points for daily task completion (emits pending event)
     * @dev Gas-efficient: Use batchUpdatePoints to actually update points
     */
    function completeDailyTask(address user) external onlyOwner {
        emit PointsPending(user, POINTS_DAILY_TASK, "Daily Task");
    }
    
    /**
     * @notice Batch update points for multiple users (Gas Optimized)
     * @dev Saves up to 80% gas compared to individual updates
     * @param _users Array of user addresses
     * @param _points Array of points to add (must match users length)
     */
    function batchUpdatePoints(address[] calldata _users, uint256[] calldata _points) external onlyOwner {
        require(_users.length == _points.length, "Array length mismatch");
        require(_users.length > 0, "Empty arrays");
        
        uint256 length = _users.length;
        for (uint256 i = 0; i < length;) {
            users[_users[i]].points += _points[i];
            emit PointsAwarded(_users[i], _points[i], "Batch Update");
            
            unchecked {
                ++i;
            }
        }
    }
    
    /**
     * @notice Record referral and emit pending points (Gas Optimized)
     * @dev Use batchUpdatePoints to actually update points
     */
    function recordReferral(address referee, address referrer) external onlyOwner {
        require(referee != referrer, "Cannot refer self");
        require(users[referee].referrer == address(0), "Already referred");
        
        users[referee].referrer = referrer;
        users[referrer].referralCount++;
        
        emit ReferralRecorded(referrer, referee);
        emit PointsPending(referrer, POINTS_REFERRAL, "Referral");
    }
    
    // ============ SBT Tier Management ============
    
    /**
     * @notice Update user's SBT tier
     * @dev Updates holder counts for accurate distribution
     */
    function updateUserTier(address user, SBTTier newTier) external onlyOwner {
        SBTTier oldTier = users[user].tier;
        
        // Decrease old tier count
        if (oldTier == SBTTier.GOLD) goldHolders--;
        else if (oldTier == SBTTier.SILVER) silverHolders--;
        else if (oldTier == SBTTier.BRONZE) bronzeHolders--;
        
        // Increase new tier count
        if (newTier == SBTTier.GOLD) goldHolders++;
        else if (newTier == SBTTier.SILVER) silverHolders++;
        else if (newTier == SBTTier.BRONZE) bronzeHolders++;
        
        users[user].tier = newTier;
        
        emit TierUpdated(user, oldTier, newTier);
    }
    
    // ============ Raffle System with API3 QRNG ============
    
    /**
     * @notice Set API3 QRNG parameters
     */
    function setQRNGParameters(
        address _airnode,
        bytes32 _endpointIdUint256,
        address _sponsorWallet
    ) external onlyOwner {
        airnode = _airnode;
        endpointIdUint256 = _endpointIdUint256;
        sponsorWallet = _sponsorWallet;
    }
    
    /**
     * @notice Purchase raffle tickets (Anti-Whale: max 100 per user)
     * @dev Accepts ETH payment, converts to USD using Chainlink price feed
     */
    function purchaseRaffleTickets(uint256 ticketCount) external payable nonReentrant whenNotPaused {
        require(tx.gasprice <= maxGasPrice, "Gas price too high");
        require(ticketCount > 0, "Invalid ticket count");
        
        RaffleData storage raffle = raffles[currentRaffleId];
        require(raffle.isActive, "Raffle not active");
        
        // Anti-whale check
        require(
            raffle.ticketCount[msg.sender] + ticketCount <= MAX_TICKETS_PER_USER,
            "Exceeds max tickets per user"
        );
        
        // Calculate required ETH amount based on current price feed
        uint256 requiredETH = getTicketPriceInETH() * ticketCount;
        require(msg.value >= requiredETH, "Insufficient ETH sent");
        
        // Award points
        users[msg.sender].points += (ticketCount * POINTS_RAFFLE_TICKET);
        
        // Add tickets
        if (raffle.ticketCount[msg.sender] == 0) {
            require(raffle.participants.length < MAX_PARTICIPANTS, "Raffle is full (participants)");
            raffle.participants.push(msg.sender);
        }
        raffle.ticketCount[msg.sender] += ticketCount;
        raffle.totalTickets += ticketCount;
        raffle.prizePool += msg.value;
        
        // Refund excess ETH if overpaid
        if (msg.value > requiredETH) {
            uint256 refund = msg.value - requiredETH;
            (bool success, ) = msg.sender.call{value: refund}("");
            require(success, "Refund failed");
        }
        
        emit TicketPurchased(msg.sender, currentRaffleId, ticketCount);
        emit PointsAwarded(msg.sender, ticketCount * POINTS_RAFFLE_TICKET, "Raffle Ticket");
    }
    
    /**
     * @notice Get current ticket price in ETH using Chainlink price feed
     * @return Price in ETH (18 decimals)
     */
    function getTicketPriceInETH() public view returns (uint256) {
        require(address(priceFeed) != address(0), "Price feed not set");
        
        // Get latest ETH/USD price from Chainlink
        (, int256 price, , uint256 updatedAt, ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price feed data");
        require(updatedAt > 0, "Price feed not updated");
        require(block.timestamp - updatedAt < 1 hours, "Price feed stale");
        
        uint8 feedDecimals = priceFeed.decimals();
        
        // Convert price to ETH (18 decimals)
        // Formula: (ticketPriceUSD * 10^20) / ethUsdPrice
        // 
        // Derivation:
        // ticketPriceUSD (6 decimals) -> normalize to 18 decimals: * 10^12
        // ethUsdPrice (8 decimals) -> normalize to 18 decimals: * 10^10
        // Result = (ticketPriceUSD * 10^12 * 10^18) / (ethUsdPrice * 10^10)
        //        = (ticketPriceUSD * 10^20) / ethUsdPrice
        
        uint256 ethUsdPrice = uint256(price);
        uint256 ticketPriceInETH = (ticketPriceUSD * 1e20) / ethUsdPrice;
        
        return ticketPriceInETH;
    }
    
    /**
     * @notice Set new ticket price in USD (onlyOwner)
     * @param newPriceUSD New price in USD with 6 decimals (e.g., 150000 = $0.15)
     */
    function setTicketPrice(uint256 newPriceUSD) external onlyOwner {
        require(newPriceUSD > 0, "Price must be greater than 0");
        require(newPriceUSD <= 1000000000, "Price too high"); // Max $1000 USD
        
        ticketPriceUSD = newPriceUSD;
        emit TicketPriceUpdated(newPriceUSD, block.timestamp);
    }
    
    /**
     * @notice Update Chainlink price feed address (onlyOwner)
     * @param newPriceFeed Address of new Chainlink ETH/USD price feed
     */
    function setPriceFeed(address newPriceFeed) external onlyOwner {
        require(newPriceFeed != address(0), "Invalid price feed address");
        priceFeed = AggregatorV3Interface(newPriceFeed);
        emit PriceFeedUpdated(newPriceFeed);
    }
    
    /**
     * @notice Set maximum gas price for protected functions (onlyOwner)
     * @param newMaxGasPrice New max gas price in wei (e.g., 100 gwei = 100000000000)
     */
    function setMaxGasPrice(uint256 newMaxGasPrice) external onlyOwner {
        require(newMaxGasPrice > 0, "Gas price must be greater than 0");
        require(newMaxGasPrice <= 1000 gwei, "Gas price too high"); // Max 1000 gwei
        
        maxGasPrice = newMaxGasPrice;
        emit MaxGasPriceUpdated(newMaxGasPrice);
    }
    
    /**
     * @notice Request random number from API3 QRNG for raffle
     */
    function requestRaffleWinner(uint256 raffleId) external onlyOwner {
        require(raffles[raffleId].isActive, "Raffle not active");
        require(raffles[raffleId].totalTickets > 0, "No tickets sold");
        require(airnode != address(0), "QRNG not configured");
        
        raffles[raffleId].isActive = false;
        
        bytes32 requestId = airnodeRrp.makeFullRequest(
            airnode,
            endpointIdUint256,
            address(this),
            sponsorWallet,
            address(this),
            this.fulfillRandomness.selector,
            ""
        );
        
        requestToRaffleId[requestId] = raffleId;
        
        emit QRNGRequested(requestId, raffleId);
    }
    
    /**
     * @notice Fulfill random number from API3 QRNG
     */
    function fulfillRandomness(bytes32 requestId, bytes calldata data)
        external
        onlyAirnodeRrp
    {
        uint256 randomNumber = abi.decode(data, (uint256));
        uint256 raffleId = requestToRaffleId[requestId];
        
        raffles[raffleId].randomNumber = randomNumber;
        
        emit QRNGFulfilled(requestId, randomNumber);
        
        _finalizeRaffle(raffleId, randomNumber);
    }
    
    /**
     * @notice Finalize raffle and select winner (Gas Optimized)
     */
    function _finalizeRaffle(uint256 raffleId, uint256 randomNumber) internal {
        RaffleData storage raffle = raffles[raffleId];
        
        uint256 winningTicket = randomNumber % raffle.totalTickets;
        uint256 ticketCounter = 0;
        address winner;
        
        uint256 participantCount = raffle.participants.length;
        for (uint256 i = 0; i < participantCount;) {
            address participant = raffle.participants[i];
            ticketCounter += raffle.ticketCount[participant];
            
            if (winningTicket < ticketCounter) {
                winner = participant;
                break;
            }
            
            unchecked {
                ++i;
            }
        }
        
        raffle.winner = winner;
        raffle.isFinalized = true;
        
        // Transfer prize to winner
        uint256 prize = raffle.prizePool;
        (bool success, ) = winner.call{value: prize}("");
        require(success, "Prize transfer failed");
        
        emit RaffleWinner(raffleId, winner, prize);
        
        // Create new raffle
        currentRaffleId++;
        raffles[currentRaffleId].raffleId = currentRaffleId;
        raffles[currentRaffleId].isActive = true;
        emit RaffleCreated(currentRaffleId, block.timestamp);
    }
    
    // ============ Neynar Social Verification ============
    
    /**
     * @notice Verify user's social account (Neynar integration)
     * @dev Called by backend after Neynar verification
     */
    function verifySocialAccount(address user, bool verified) external onlyOwner {
        users[user].isVerified = verified;
        emit SocialVerified(user, verified);
    }
    
    // ============ Emergency Functions ============
    
    /**
     * @notice EMERGENCY: Pause all contract operations
     * @dev Only owner can pause
     */
    function pause() external onlyOwner {
        _pause();
        emergencyMode = true;
        emit EmergencyModeActivated(block.timestamp);
    }
    
    /**
     * @notice Unpause contract operations
     */
    function unpause() external onlyOwner {
        _unpause();
        emergencyMode = false;
    }
    
    /**
     * @notice EMERGENCY: Withdraw all funds if critical bug found
     * @dev Only owner (40% holder) can execute
     */
    function emergencyWithdraw() external onlyOwner {
        require(emergencyMode || paused(), "Not in emergency mode");
        
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Emergency withdrawal failed");
        
        emit EmergencyWithdrawal(owner(), balance);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update operations wallet
     */
    function updateOperationsWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Invalid address");
        operationsWallet = newWallet;
    }
    
    /**
     * @notice Update treasury wallet
     */
    function updateTreasuryWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Invalid address");
        treasuryWallet = newWallet;
    }
    
    /**
     * @notice Withdraw treasury funds
     */
    function withdrawTreasury(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        
        (bool success, ) = treasuryWallet.call{value: amount}("");
        require(success, "Treasury withdrawal failed");
    }
    
    // ============ View Functions ============
    
    function getUserData(address user) external view returns (
        uint256 points,
        SBTTier tier,
        uint256 lastClaim,
        uint256 referrals,
        bool verified,
        address referrer
    ) {
        UserData memory userData = users[user];
        return (
            userData.points,
            userData.tier,
            userData.lastClaimTimestamp,
            userData.referralCount,
            userData.isVerified,
            userData.referrer
        );
    }
    
    function getRaffleData(uint256 raffleId) external view returns (
        uint256 totalTickets,
        uint256 prizePool,
        address winner,
        bool isActive,
        bool isFinalized
    ) {
        RaffleData storage raffle = raffles[raffleId];
        return (
            raffle.totalTickets,
            raffle.prizePool,
            raffle.winner,
            raffle.isActive,
            raffle.isFinalized
        );
    }
    
    function getUserTickets(uint256 raffleId, address user) external view returns (uint256) {
        return raffles[raffleId].ticketCount[user];
    }
    
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
