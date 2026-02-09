// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Manual interface definition to avoid buggy constructor calls in inherited Requesters
interface IAirnodeRrpV0 {
    function setSponsorshipStatus(address sponsor, bool status) external;
    function makeFullRequest(
        address airnode,
        bytes32 endpointId,
        address sponsor,
        address sponsorWallet,
        address fulfillAddress,
        bytes4 fulfillFunctionId,
        bytes calldata parameters
    ) external returns (bytes32 requestId);
}

interface ICryptoDiscoMaster {
    function addPoints(address user, uint256 points, string calldata reason) external;
    function getTicketPriceInETH() external view returns (uint256);
}

/**
 * @title CryptoDiscoRaffle
 * @notice Modular Raffle system for Crypto Disco App
 * @dev Hardened version with Manual RRP to bypass Airnode Protocol v0.15 constructor reverts.
 */
contract CryptoDiscoRaffle is ReentrancyGuard, Pausable, Ownable {
    
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

    // ============ State Variables ============
    
    ICryptoDiscoMaster public masterContract;
    IAirnodeRrpV0 public immutable airnodeRrp;
    
    uint256 public constant POINTS_RAFFLE_TICKET = 15;
    uint256 public constant MAX_TICKETS_PER_USER = 100;
    uint256 public constant MAX_PARTICIPANTS = 4000;
    
    // API3 QRNG Integration
    address public airnode;
    bytes32 public endpointIdUint256;
    address public sponsorWallet;
    
    mapping(uint256 => RaffleData) public raffles;
    uint256 public currentRaffleId;
    mapping(bytes32 => uint256) public requestToRaffleId;

    // ============ Events ============
    
    event RaffleCreated(uint256 indexed raffleId, uint256 timestamp);
    event TicketPurchased(address indexed user, uint256 indexed raffleId, uint256 ticketCount);
    event QRNGRequested(bytes32 indexed requestId, uint256 indexed raffleId);
    event QRNGFulfilled(bytes32 indexed requestId, uint256 randomNumber);
    event RaffleWinner(uint256 indexed raffleId, address indexed winner, uint256 prize);

    // ============ Constructor ============
    
    constructor(
        address _masterContract,
        address _airnodeRrp
    ) Ownable(msg.sender) {
        require(_masterContract != address(0), "Invalid master");
        require(_airnodeRrp != address(0), "Invalid RRP");
        masterContract = ICryptoDiscoMaster(_masterContract);
        airnodeRrp = IAirnodeRrpV0(_airnodeRrp);
        // Note: No external calls here to prevent Base Sepolia deployment reverts.
    }

    /**
     * @notice Initialize the first raffle. Offloaded from constructor for gas safety.
     */
    function initializeFirstRaffle() external onlyOwner {
        require(currentRaffleId == 0, "Already initialized");
        currentRaffleId = 1;
        raffles[currentRaffleId].raffleId = currentRaffleId;
        raffles[currentRaffleId].isActive = true;
        emit RaffleCreated(currentRaffleId, block.timestamp);
    }

    // ============ Raffle Logic ============
    
    function purchaseRaffleTickets(uint256 ticketCount) external payable nonReentrant whenNotPaused {
        require(ticketCount > 0, "Invalid count");
        
        RaffleData storage raffle = raffles[currentRaffleId];
        require(raffle.isActive, "Raffle not active");
        require(raffle.ticketCount[msg.sender] + ticketCount <= MAX_TICKETS_PER_USER, "Exceeds max");
        
        uint256 requiredETH = masterContract.getTicketPriceInETH() * ticketCount;
        require(msg.value >= requiredETH, "Insufficient ETH");
        
        // Award points via Master contract
        masterContract.addPoints(msg.sender, ticketCount * POINTS_RAFFLE_TICKET, "Raffle Ticket");
        
        // Add tickets
        if (raffle.ticketCount[msg.sender] == 0) {
            require(raffle.participants.length < MAX_PARTICIPANTS, "Full");
            raffle.participants.push(msg.sender);
        }
        raffle.ticketCount[msg.sender] += ticketCount;
        raffle.totalTickets += ticketCount;
        raffle.prizePool += msg.value;
        
        // Refund excess
        if (msg.value > requiredETH) {
            payable(msg.sender).transfer(msg.value - requiredETH);
        }
        
        emit TicketPurchased(msg.sender, currentRaffleId, ticketCount);
    }

    // ============ API3 QRNG ============
    
    function setQRNGParameters(address _airnode, bytes32 _eid, address _sw) external onlyOwner {
        airnode = _airnode;
        endpointIdUint256 = _eid;
        sponsorWallet = _sw;
    }

    function requestRaffleWinner(uint256 raffleId) external onlyOwner {
        RaffleData storage raffle = raffles[raffleId];
        require(raffle.isActive && raffle.totalTickets > 0, "Cannot request");
        require(airnode != address(0), "QRNG not set");
        
        raffle.isActive = false;
        bytes32 requestId = airnodeRrp.makeFullRequest(
            airnode, endpointIdUint256, address(this), sponsorWallet,
            address(this), this.fulfillRandomness.selector, ""
        );
        requestToRaffleId[requestId] = raffleId;
        emit QRNGRequested(requestId, raffleId);
    }

    function fulfillRandomness(bytes32 requestId, bytes calldata data) external {
        require(msg.sender == address(airnodeRrp), "Only AirnodeRrp");
        uint256 randomNumber = abi.decode(data, (uint256));
        uint256 raffleId = requestToRaffleId[requestId];
        raffles[raffleId].randomNumber = randomNumber;
        emit QRNGFulfilled(requestId, randomNumber);
        _finalizeRaffle(raffleId, randomNumber);
    }

    function _finalizeRaffle(uint256 raffleId, uint256 randomNumber) internal {
        RaffleData storage raffle = raffles[raffleId];
        uint256 winningTicket = randomNumber % raffle.totalTickets;
        uint256 ticketCounter = 0;
        address winner;
        
        uint256 pCount = raffle.participants.length;
        for (uint256 i = 0; i < pCount;) {
            address p = raffle.participants[i];
            ticketCounter += raffle.ticketCount[p];
            if (winningTicket < ticketCounter) {
                winner = p;
                break;
            }
            unchecked { ++i; }
        }
        
        raffle.winner = winner;
        raffle.isFinalized = true;
        payable(winner).transfer(raffle.prizePool);
        
        emit RaffleWinner(raffleId, winner, raffle.prizePool);
        
        currentRaffleId++;
        raffles[currentRaffleId].raffleId = currentRaffleId;
        raffles[currentRaffleId].isActive = true;
        emit RaffleCreated(currentRaffleId, block.timestamp);
    }

    // ============ Admin ============
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function setMaster(address _m) external onlyOwner { masterContract = ICryptoDiscoMaster(_m); }
}
