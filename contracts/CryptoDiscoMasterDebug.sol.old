// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@api3/airnode-protocol/contracts/rrp/requesters/RrpRequesterV0.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

contract CryptoDiscoMasterDebug is ReentrancyGuard, Pausable, RrpRequesterV0, Ownable {
    uint256 public constant OWNER_SHARE = 4000;
    uint256 public constant OPS_SHARE = 2000;
    uint256 public constant SBT_POOL_SHARE = 3000;
    uint256 public constant TREASURY_SHARE = 1000;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant POINTS_DAILY_TASK = 10;
    uint256 public constant POINTS_RAFFLE_TICKET = 15;
    uint256 public constant POINTS_REFERRAL = 2;
    uint256 public ticketPriceUSD = 150000;
    AggregatorV3Interface public priceFeed;
    uint256 public constant USD_DECIMALS = 6;
    uint256 public constant ETH_DECIMALS = 18;
    uint256 public maxGasPrice = 100 gwei;
    uint256 public constant GOLD_WEIGHT = 50;
    uint256 public constant SILVER_WEIGHT = 30;
    uint256 public constant BRONZE_WEIGHT = 20;
    address public operationsWallet;
    address public treasuryWallet;
    enum SBTTier { NONE, BRONZE, SILVER, GOLD }
    struct UserData {
        uint256 points;
        SBTTier tier;
        uint256 lastClaimTimestamp;
        uint256 referralCount;
        bool isVerified;
        address referrer;
    }
    mapping(address => UserData) public users;
    uint256 public totalSBTPoolBalance;
    uint256 public lastDistributionTimestamp;
    uint256 public goldHolders;
    uint256 public silverHolders;
    uint256 public bronzeHolders;
    uint256 public constant REWARD_PRECISION = 1e18;
    uint256 public totalLockedRewards;
    mapping(SBTTier => uint256) public accRewardPerShare;
    mapping(address => uint256) public userRewardDebt;
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
    uint256 public constant MAX_TICKETS_PER_USER = 100;
    uint256 public constant MAX_PARTICIPANTS = 4000;
    bool public emergencyMode;

    constructor(
        address _opsWallet,
        address _treasuryWallet,
        address _airnodeRrp,
        address _priceFeed
    ) RrpRequesterV0(_airnodeRrp) Ownable(msg.sender) {
        require(_opsWallet != address(0), "Ops zero");
        require(_treasuryWallet != address(0), "Treasury zero");
        require(_priceFeed != address(0), "PriceFeed zero");

        operationsWallet = _opsWallet;
        treasuryWallet = _treasuryWallet;
        priceFeed = AggregatorV3Interface(_priceFeed);
        lastDistributionTimestamp = block.timestamp;

        currentRaffleId = 1;
        raffles[currentRaffleId].raffleId = currentRaffleId;
        raffles[currentRaffleId].isActive = true;
    }

    function _distributeRevenue(uint256 _amount) internal {
        if (_amount == 0) return;
        
        uint256 ownerAmt = (_amount * OWNER_SHARE) / BASIS_POINTS;
        uint256 opsAmt = (_amount * OPS_SHARE) / BASIS_POINTS;
        uint256 sbtPoolAmt = (_amount * SBT_POOL_SHARE) / BASIS_POINTS;
        uint256 treasuryAmt = _amount - (ownerAmt + opsAmt + sbtPoolAmt);
        
        (bool s1, ) = payable(owner()).call{value: ownerAmt}("");
        (bool s2, ) = payable(operationsWallet).call{value: opsAmt}("");
        
        totalSBTPoolBalance += sbtPoolAmt;
        _updateSBTPool(sbtPoolAmt);
        
        totalLockedRewards += sbtPoolAmt;
        emit RevenueReceived(_amount, block.timestamp);
    }

    function _updateSBTPool(uint256 _amount) internal {
        if (goldHolders > 0) {
            uint256 goldShare = (_amount * GOLD_WEIGHT) / 100;
            accRewardPerShare[SBTTier.GOLD] += (goldShare * REWARD_PRECISION) / goldHolders;
        }
        if (silverHolders > 0) {
            uint256 silverShare = (_amount * SILVER_WEIGHT) / 100;
            accRewardPerShare[SBTTier.SILVER] += (silverShare * REWARD_PRECISION) / silverHolders;
        }
        if (bronzeHolders > 0) {
            uint256 bronzeShare = (_amount * BRONZE_WEIGHT) / 100;
            accRewardPerShare[SBTTier.BRONZE] += (bronzeShare * REWARD_PRECISION) / bronzeHolders;
        }
    }

    event RevenueReceived(uint256 amount, uint256 timestamp);

    function buyRaffleTickets(uint256 raffleId, uint256 ticketCount) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
    {
        require(ticketCount > 0, "Count zero");
        require(raffles[raffleId].isActive, "Raffle inactive");
        
        uint256 usdCost = ticketCount * ticketPriceUSD;
        uint256 ethCost = convertUSDtoETH(usdCost);
        
        require(msg.value >= ethCost, "Insuff. ETH");
        
        raffles[raffleId].ticketCount[msg.sender] += ticketCount;
        raffles[raffleId].totalTickets += ticketCount;
        raffles[raffleId].prizePool += msg.value;
        raffles[raffleId].participants.push(msg.sender);
        
        emit TicketPurchased(msg.sender, raffleId, ticketCount);
    }

    function convertUSDtoETH(uint256 usdAmount) public view returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Price error");
        uint256 ethPrice = uint256(price);
        return (usdAmount * (10**20)) / ethPrice;
    }

    event TicketPurchased(address indexed user, uint256 indexed raffleId, uint256 ticketCount);
}
