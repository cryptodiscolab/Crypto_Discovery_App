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
        address[] winners;      // Support for multiple winners
        uint256 winnerCount;    // Number of winners to pick
        uint256 randomNumber;
        bool isActive;
        bool isFinalized;
        address sponsor;        // User who created the raffle (address(0) for Admin)
        string metadataURI;     // JSON with Image, Title, Description
        uint256 endTime;        // End timestamp
        uint256 prizePerWinner; // Calculated at finalization
        uint256 totalTicketRevenue; // Amount collected from ticket sales
    }

    // ============ State Variables ============
    
    ICryptoDiscoMaster public masterContract;
    IAirnodeRrpV0 public immutable airnodeRrp;
    
    uint256 public pointsRaffleTicket = 15;
    uint256 public maxTicketsPerUser = 1000; 
    uint256 public maxParticipants = 10000;
    uint256 public maintenanceFeeBP = 2000; // 20% Rake
    uint256 public surchargeBP = 500; // 5% default
    
    // Reward XP values
    uint256 public raffleCreateXP = 200;
    uint256 public raffleClaimXP = 100;
    
    // API3 QRNG Integration
    address public airnode;
    bytes32 public endpointIdUint256;
    address public sponsorWallet;
    
    mapping(uint256 => RaffleData) public raffles;
    uint256 public currentRaffleId;
    mapping(bytes32 => uint256) public requestToRaffleId;
    
    // NEW: Separated mappings from struct to allow struct-return in getRaffleInfo
    mapping(uint256 => mapping(address => uint256)) public ticketCountPerUser;
    mapping(uint256 => mapping(address => bool)) public hasClaimedPrize;
    mapping(address => uint256) public sponsorBalances;

    // ============ Events ============
    
    event RaffleCreated(uint256 indexed raffleId, uint256 timestamp);
    event TicketPurchased(address indexed user, uint256 indexed raffleId, uint256 count);
    event QRNGRequested(bytes32 indexed requestId, uint256 indexed raffleId);
    event QRNGFulfilled(bytes32 indexed requestId, uint256 randomNumber);
    event RaffleWinner(uint256 indexed raffleId, address indexed winner, uint256 prize);
    event RaffleCancelled(uint256 indexed raffleId, address indexed sponsor, uint256 refundedAmount);

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
        r.maxTickets = maxParticipants;
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
        uint256 basePrize = msg.value * 10000 / (10000 + surchargeBP);
        uint256 surcharge = msg.value - basePrize;
        
        require(_winnerCount > 0 && _winnerCount <= 10, "Invalid winner count");
        require(_durationDays > 0 && _durationDays <= 25, "Max 25 days");
        require(_maxTickets > 0 && _maxTickets <= maxParticipants, "Exceeds max");

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

        // EXTRA POINTS for Create Raffle activity
        masterContract.addPoints(msg.sender, raffleCreateXP, "Create Raffle");

        emit RaffleCreated(currentRaffleId, block.timestamp);
    }

    // ============ Raffle Logic ============
    
    function buyTickets(uint256 raffleId, uint256 ticketCount) external payable nonReentrant whenNotPaused {
        require(ticketCount > 0, "Invalid count");
        
        RaffleData storage raffle = raffles[raffleId];
        require(raffle.isActive, "Raffle not active");
        require(block.timestamp <= raffle.endTime, "Raffle expired");
        require(raffle.totalTickets + ticketCount <= raffle.maxTickets, "Sold out");
        require(ticketCountPerUser[raffleId][msg.sender] + ticketCount <= maxTicketsPerUser, "Exceeds user max");
        
        uint256 baseETH = masterContract.getTicketPriceInETH() * ticketCount;
        uint256 requiredETH = baseETH * (10000 + surchargeBP) / 10000;
        require(msg.value >= requiredETH, "Insufficient ETH");
        
        // 1. Forward 5% Fee to MasterX
        uint256 fee = requiredETH - baseETH;
        (bool s, ) = payable(address(masterContract)).call{value: fee}("");
        require(s, "Fee forwarding failed");

        // 2. Award points via Master contract
        masterContract.addPoints(msg.sender, ticketCount * pointsRaffleTicket, "Raffle Ticket");
        
        // 3. Add tickets
        if (ticketCountPerUser[raffleId][msg.sender] == 0) {
            require(raffle.participants.length < maxParticipants, "Room limit");
            raffle.participants.push(msg.sender);
        }
        ticketCountPerUser[raffleId][msg.sender] += ticketCount;
        raffle.totalTickets += ticketCount;
        raffle.totalTicketRevenue += baseETH; 
        
        // Refund excess
        if (msg.value > requiredETH) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - requiredETH}("");
            require(success, "Refund failed");
        }
        
        emit TicketPurchased(msg.sender, raffleId, ticketCount);
    }

    // ============ API3 QRNG ============
    
    function setQRNGParameters(address _airnode, bytes32 _eid, address _sw) external onlyOwner {
        airnode = _airnode;
        endpointIdUint256 = _eid;
        sponsorWallet = _sw;
    }

    function drawWinner(uint256 raffleId) external {
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
        uint256 projectRake = (raffle.totalTicketRevenue * maintenanceFeeBP) / 10000;
        uint256 sponsorShare = raffle.totalTicketRevenue - projectRake;
        
        // 2. Distribute Rake to Owner
        if (projectRake > 0) {
            (bool success, ) = payable(owner()).call{value: projectRake}("");
            require(success, "Rake transfer failed");
        }

        // 3. Credit Sponsor (80% of sales + original PrizePool deposit)
        if (raffle.sponsor != address(0)) {
            sponsorBalances[raffle.sponsor] += (sponsorShare + raffle.prizePool);
        } else {
            // Admin Raffle: Ticket revenue becomes the prize
            raffle.prizePool += sponsorShare;
        }

        // 4. Select Multiple Winners
        uint256 winnersToPick = raffle.winnerCount;
        if (winnersToPick > raffle.participants.length) {
            winnersToPick = raffle.participants.length;
        }

        // Winners share the prize pool
        // For admin raffles, this is now the ticket revenue.
        // For sponsorship, this is the original prize deposit.
        uint256 prizePerWinner = winnersToPick > 0 ? (raffle.prizePool / winnersToPick) : 0;

        for (uint256 i = 0; i < winnersToPick; i++) {
            // Derive unique random for each winner slot
            uint256 derivedRandom = uint256(keccak256(abi.encode(randomNumber, i)));
            uint256 winningTicket = derivedRandom % raffle.totalTickets;
            
            uint256 ticketCounter = 0;
            address winner;
            
            for (uint256 j = 0; j < raffle.participants.length; j++) {
                address p = raffle.participants[j];
                ticketCounter += ticketCountPerUser[raffleId][p];
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
            next.maxTickets = maxParticipants;
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
        require(!hasClaimedPrize[raffleId][msg.sender], "Already claimed");

        uint256 prize = raffle.prizePerWinner;
        require(prize > 0, "No prize");

        hasClaimedPrize[raffleId][msg.sender] = true;
        
        // EXTRA POINTS for Claiming Raffle Winner activity
        masterContract.addPoints(msg.sender, raffleClaimXP, "Claim Raffle Prize");

        (bool s, ) = payable(msg.sender).call{value: prize}("");
        require(s, "Transfer failed");

        emit RaffleWinner(raffleId, msg.sender, prize);
    }

    /**
     * @notice Admin cancels a raffle and refunds the sponsor's deposit.
     * Only possible if no tickets have been sold yet.
     */
    function cancelRaffle(uint256 raffleId) external onlyOwner nonReentrant {
        RaffleData storage raffle = raffles[raffleId];
        require(raffle.raffleId != 0, "Raffle does not exist");
        require(raffle.isActive, "Raffle not active");
        require(!raffle.isFinalized, "Raffle already finalized");
        require(raffle.totalTickets == 0, "Cannot cancel: tickets sold");

        address sponsor = raffle.sponsor;
        uint256 refundAmount = raffle.prizePool;

        raffle.isActive = false;
        raffle.prizePool = 0;

        if (refundAmount > 0 && sponsor != address(0)) {
            (bool success, ) = payable(sponsor).call{value: refundAmount}("");
            require(success, "Refund failed");
        }

        emit RaffleCancelled(raffleId, sponsor, refundAmount);
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

    function setRaffleFees(uint256 _rakeBP, uint256 _surchargeBP) external onlyOwner {
        require(_rakeBP <= 5000, "Rake too high");
        require(_surchargeBP <= 2000, "Surcharge too high");
        maintenanceFeeBP = _rakeBP;
        surchargeBP = _surchargeBP;
    }

    function setRaffleLimits(uint256 _maxUserTickets, uint256 _maxParticipants) external onlyOwner {
        maxTicketsPerUser = _maxUserTickets;
        maxParticipants = _maxParticipants;
    }

    function setRaffleXP(uint256 _create, uint256 _claim, uint256 _ticket) external onlyOwner {
        raffleCreateXP = _create;
        raffleClaimXP = _claim;
        pointsRaffleTicket = _ticket;
    }

    /**
     * @notice Admin creates a raffle for free (no ETH deposit required).
     * Same storage as createSponsorshipRaffle. sponsor = address(0) → admin raffle.
     */
    function adminCreateRaffle(
        uint256 _winnerCount,
        uint256 _maxTickets,
        uint256 _durationDays,
        string calldata _metadataURI
    ) external onlyOwner {
        require(_winnerCount > 0 && _winnerCount <= 10, "Invalid winner count");
        require(_durationDays > 0 && _durationDays <= 25, "Max 25 days");
        require(_maxTickets > 0 && _maxTickets <= maxParticipants, "Exceeds max");

        currentRaffleId++;
        RaffleData storage r = raffles[currentRaffleId];
        r.raffleId = currentRaffleId;
        r.isActive = true;
        r.winnerCount = _winnerCount;
        r.maxTickets = _maxTickets;
        r.endTime = block.timestamp + (_durationDays * 1 days);
        r.metadataURI = _metadataURI;
        r.prizePool = 0;       // No deposit — prize comes from ticket revenue
        r.sponsor = address(0); // Admin raffle

        emit RaffleCreated(currentRaffleId, block.timestamp);
    }

    /**
     * @notice Get the raffleIdCounter (alias for currentRaffleId) for BUG-3 fix compatibility.
     */
    function raffleIdCounter() external view returns (uint256) {
        return currentRaffleId;
    }

    /**
     * @notice Fetch complete raffle info in one call (matches ABI)
     */
    function getRaffleInfo(uint256 _raffleId) external view returns (RaffleData memory) {
        return raffles[_raffleId];
    }

    /**
     * @notice Helper to check user tickets (since struct mapping was removed)
     */
    function getUserTickets(uint256 _raffleId, address _user) external view returns (uint256) {
        return ticketCountPerUser[_raffleId][_user];
    }

    /**
     * @notice Helper to check if user claimed (since struct mapping was removed)
     */
    function hasUserClaimed(uint256 _raffleId, address _user) external view returns (bool) {
        return hasClaimedPrize[_raffleId][_user];
    }
}
