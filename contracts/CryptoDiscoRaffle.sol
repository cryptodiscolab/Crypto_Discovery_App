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
        uint256 maxTickets;     // Max tickets for this event
        uint256 targetPrizePool; // Target amount in ETH
        uint256 prizePool;
        address[] participants;
        mapping(address => uint256) ticketCount;
        address[] winners;      // Support for multiple winners
        uint256 winnerCount;    // Number of winners to pick
        uint256 randomNumber;
        bool isActive;
        bool isFinalized;
        address sponsor;        // User who created the raffle (address(0) for Admin)
        string metadataURI;     // JSON with Image, Title, Description
        uint256 endTime;        // End timestamp
        mapping(address => bool) isClaimed; 
        uint256 prizePerWinner; // Calculated at finalization
        uint256 totalTicketRevenue; // Amount collected from ticket sales
    }

    // ============ State Variables ============
    
    ICryptoDiscoMaster public masterContract;
    IAirnodeRrpV0 public immutable airnodeRrp;
    
    uint256 public constant POINTS_RAFFLE_TICKET = 15;
    uint256 public constant MAX_TICKETS_PER_USER = 1000; // Increased for high-cap events
    uint256 public constant MAX_PARTICIPANTS = 10000;
    uint256 public constant MAINTENANCE_FEE_BP = 2000; // 20% Rake
    
    // API3 QRNG Integration
    address public airnode;
    bytes32 public endpointIdUint256;
    address public sponsorWallet;
    
    mapping(uint256 => RaffleData) public raffles;
    uint256 public currentRaffleId;
    mapping(bytes32 => uint256) public requestToRaffleId;
    mapping(address => uint256) public sponsorBalances; // Claimable earnings for creators

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
        RaffleData storage r = raffles[currentRaffleId];
        r.raffleId = currentRaffleId;
        r.isActive = true;
        r.winnerCount = 1;
        r.maxTickets = MAX_PARTICIPANTS;
        r.endTime = block.timestamp + 7 days;
        r.metadataURI = "ipfs://default-admin-raffle";
        emit RaffleCreated(currentRaffleId, block.timestamp);
    }

    /**
     * @notice Create a community raffle event.
     */
    function createSponsorshipRaffle(
        uint256 _winnerCount,
        uint256 _maxTickets,
        uint256 _durationDays,
        string calldata _metadataURI
    ) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Deposit required");
        uint256 basePrize = msg.value * 100 / 105; // 5% is surcharge
        uint256 surcharge = msg.value - basePrize;
        
        require(_winnerCount > 0 && _winnerCount <= 10, "Invalid winner count");
        require(_durationDays > 0 && _durationDays <= 25, "Max 25 days");
        require(_maxTickets > 0 && _maxTickets <= MAX_PARTICIPANTS, "Exceeds max");

        // Forward 5% surcharge to MasterX
        if (surcharge > 0) {
            (bool success, ) = payable(address(masterContract)).call{value: surcharge}("");
            require(success, "Surcharge forward failed");
        }

        currentRaffleId++;
        RaffleData storage r = raffles[currentRaffleId];
        r.raffleId = currentRaffleId;
        r.isActive = true;
        r.winnerCount = _winnerCount;
        r.maxTickets = _maxTickets;
        r.endTime = block.timestamp + (_durationDays * 1 days);
        r.metadataURI = _metadataURI;
        r.prizePool = basePrize; // Initial prize from creator (untouched by ticket sales)
        r.sponsor = msg.sender;

        emit RaffleCreated(currentRaffleId, block.timestamp);
    }

    // ============ Raffle Logic ============
    
    function purchaseRaffleTickets(uint256 ticketCount) external payable nonReentrant whenNotPaused {
        require(ticketCount > 0, "Invalid count");
        
        RaffleData storage raffle = raffles[currentRaffleId];
        require(raffle.isActive, "Raffle not active");
        require(block.timestamp <= raffle.endTime, "Raffle expired");
        require(raffle.totalTickets + ticketCount <= raffle.maxTickets, "Sold out");
        require(raffle.ticketCount[msg.sender] + ticketCount <= MAX_TICKETS_PER_USER, "Exceeds user max");
        
        uint256 baseETH = masterContract.getTicketPriceInETH() * ticketCount;
        uint256 requiredETH = (baseETH * 105) / 100;
        require(msg.value >= requiredETH, "Insufficient ETH");
        
        // 1. Forward 5% Fee to MasterX
        uint256 fee = requiredETH - baseETH;
        (bool s, ) = payable(address(masterContract)).call{value: fee}("");
        require(s, "Fee forwarding failed");

        // 2. Award points via Master contract
        masterContract.addPoints(msg.sender, ticketCount * POINTS_RAFFLE_TICKET, "Raffle Ticket");
        
        // 3. Add tickets
        if (raffle.ticketCount[msg.sender] == 0) {
            require(raffle.participants.length < MAX_PARTICIPANTS, "Room limit");
            raffle.participants.push(msg.sender);
        }
        raffle.ticketCount[msg.sender] += ticketCount;
        raffle.totalTickets += ticketCount;
        raffle.totalTicketRevenue += baseETH; 
        
        // Refund excess
        if (msg.value > requiredETH) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - requiredETH}("");
            require(success, "Refund failed");
        }
        
        emit TicketPurchased(msg.sender, currentRaffleId, ticketCount);
    }

    // ============ API3 QRNG ============
    
    function setQRNGParameters(address _airnode, bytes32 _eid, address _sw) external onlyOwner {
        airnode = _airnode;
        endpointIdUint256 = _eid;
        sponsorWallet = _sw;
    }

    function requestRaffleWinner(uint256 raffleId) external {
        RaffleData storage raffle = raffles[raffleId];
        require(raffle.isActive, "Not active");
        require(raffle.totalTickets > 0, "No tickets");
        
        // Authorization: Owner or the Sponsor can request if conditions met
        bool isSponsor = (msg.sender == raffle.sponsor && raffle.sponsor != address(0));
        bool isAdmin = (msg.sender == owner());
        require(isAdmin || isSponsor, "Not authorized");

        // Allow request if Sold Out or Time Expired
        require(
            raffle.totalTickets >= raffle.maxTickets || 
            block.timestamp >= raffle.endTime || 
            isAdmin, 
            "Conditions not met"
        );
        
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
        require(!raffle.isFinalized, "Already finalized");

        // 1. Calculate 20% Project Rake from TICKET SALES only
        uint256 projectRake = (raffle.totalTicketRevenue * MAINTENANCE_FEE_BP) / 10000;
        uint256 sponsorShare = raffle.totalTicketRevenue - projectRake;
        
        // 2. Distribute Rake to Owner
        if (projectRake > 0) {
            (bool success, ) = payable(owner()).call{value: projectRake}("");
            require(success, "Rake transfer failed");
        }

        // 3. Credit Sponsor (80% of sales + original PrizePool deposit)
        if (raffle.sponsor != address(0)) {
            sponsorBalances[raffle.sponsor] += (sponsorShare + raffle.prizePool);
        }

        // 4. Select Multiple Winners
        uint256 winnersToPick = raffle.winnerCount;
        if (winnersToPick > raffle.participants.length) {
            winnersToPick = raffle.participants.length;
        }

        // Winners share the ORIGINAL prize pool provided by sponsor
        uint256 prizePerWinner = raffle.prizePool / winnersToPick;

        for (uint256 i = 0; i < winnersToPick; i++) {
            // Derive unique random for each winner slot
            uint256 derivedRandom = uint256(keccak256(abi.encode(randomNumber, i)));
            uint256 winningTicket = derivedRandom % raffle.totalTickets;
            
            uint256 ticketCounter = 0;
            address winner;
            
            for (uint256 j = 0; j < raffle.participants.length; j++) {
                address p = raffle.participants[j];
                ticketCounter += raffle.ticketCount[p];
                if (winningTicket < ticketCounter) {
                    winner = p;
                    break;
                }
            }
            
            raffle.winners.push(winner);
        }
        
        raffle.prizePerWinner = prizePerWinner;
        raffle.isFinalized = true;
        
        // If it was the current auto-raffle (Admin one), spawn next
        if (raffle.sponsor == address(0)) {
            currentRaffleId++;
            RaffleData storage next = raffles[currentRaffleId];
            next.raffleId = currentRaffleId;
            next.isActive = true;
            next.winnerCount = 1;
            next.maxTickets = MAX_PARTICIPANTS;
            next.endTime = block.timestamp + 7 days;
            next.metadataURI = "ipfs://default-admin-raffle";
            emit RaffleCreated(currentRaffleId, block.timestamp);
        }
    }

    /**
     * @notice Winners claim their prize. They pay the gas.
     */
    function claimRafflePrize(uint256 raffleId) external nonReentrant {
        RaffleData storage raffle = raffles[raffleId];
        require(raffle.isFinalized, "Not finalized");
        require(!raffle.isClaimed[msg.sender], "Already claimed");
        
        // Check if user is a winner
        bool isWinner = false;
        uint256 winnersLen = raffle.winners.length;
        for (uint256 i = 0; i < winnersLen; i++) {
            if (raffle.winners[i] == msg.sender) {
                isWinner = true;
                break;
            }
        }
        require(isWinner, "Not a winner");

        uint256 prize = raffle.prizePerWinner;
        require(prize > 0, "No prize");

        raffle.isClaimed[msg.sender] = true;
        (bool s, ) = payable(msg.sender).call{value: prize}("");
        require(s, "Transfer failed");

        emit RaffleWinner(raffleId, msg.sender, prize);
    }

    /**
     * @notice Sponsors withdraw their 80% revenue + leftover deposit.
     */
    function withdrawSponsorBalance() external nonReentrant {
        uint256 balance = sponsorBalances[msg.sender];
        require(balance > 0, "No balance");
        
        sponsorBalances[msg.sender] = 0;
        (bool s, ) = payable(msg.sender).call{value: balance}("");
        require(s, "Withdrawal failed");
    }

    // ============ Admin ============
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function setMaster(address _m) external onlyOwner { masterContract = ICryptoDiscoMaster(_m); }
}
