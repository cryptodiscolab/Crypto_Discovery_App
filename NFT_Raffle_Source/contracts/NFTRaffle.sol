// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@api3/airnode-protocol/contracts/rrp/requesters/RrpRequesterV0.sol";

/**
 * @title NFTRaffle
 * @notice Secure, transparent on-chain NFT raffle system
 * @dev Uses API3 QRNG for provably fair randomness
 */
contract NFTRaffle is ReentrancyGuard, Ownable, Pausable, RrpRequesterV0 {
    
    // ==================== State Variables ====================
    
    address public airnode;
    bytes32 public endpointId;
    address public sponsorWallet;
    
    uint256 public constant TICKET_PRICE = 0.00015 ether; // $0.15 (adjust based on ETH price)
    uint256 public constant PROJECT_FEE_PERCENTAGE = 5; // 5%
    uint256 public constant MIN_NFTS_PER_RAFFLE = 10;
    uint256 public constant MAX_NFTS_PER_RAFFLE = 50;
    uint256 public constant DAILY_FREE_TICKETS = 1;
    uint256 public constant SECONDS_PER_DAY = 86400;
    
    uint256 public raffleIdCounter;
    uint256 public totalVolume;
    uint256 public totalFees;
    
    struct RaffleEvent {
        uint256 raffleId;
        address creator;
        uint256 startTime;
        uint256 endTime;
        uint256 totalTickets;
        uint256 ticketsSold;
        uint256 paidTicketsSold; // Track paid tickets for fee calculation
        bool isActive;
        bool isCompleted;
        bytes32 airnodeRequestId;
        address winner;
        NFTInfo[] nfts;
    }
    
    struct NFTInfo {
        address nftContract;
        uint256 tokenId;
        bool claimed;
    }
    
    struct UserInfo {
        uint256 totalTicketsPurchased;
        uint256 totalWins;
        uint256 lastFreeTicketClaim;
        uint256 freeTicketsAvailable;
    }
    
    struct Ticket {
        address buyer;
        uint256 raffleId;
        uint256 purchaseTime;
        bool isFree;
    }
    
    // Mappings
    mapping(uint256 => RaffleEvent) public raffles;
    mapping(uint256 => mapping(address => uint256)) public userTicketsInRaffle;
    mapping(uint256 => Ticket[]) public raffleTickets;
    mapping(address => UserInfo) public users;
    mapping(bytes32 => uint256) public airnodeRequestToRaffleId;
    
    // Events
    event RaffleCreated(uint256 indexed raffleId, address indexed creator, uint256 nftCount, uint256 endTime);
    event TicketPurchased(uint256 indexed raffleId, address indexed buyer, uint256 amount, bool isFree);
    event RaffleDrawn(uint256 indexed raffleId, bytes32 indexed requestId);
    event WinnerSelected(uint256 indexed raffleId, address indexed winner, uint256 randomness);
    event NFTClaimed(uint256 indexed raffleId, address indexed winner, address nftContract, uint256 tokenId);
    event FreeTicketClaimed(address indexed user, uint256 amount);
    
    // ==================== Constructor ====================
    
    constructor(
        address _airnodeRrp
    ) RrpRequesterV0(_airnodeRrp) Ownable(msg.sender) {}
    
    // ==================== External Functions ====================
    
    /**
     * @notice Set API3 QRNG parameters
     */
    function setQrngParameters(
        address _airnode,
        bytes32 _endpointId,
        address _sponsorWallet
    ) external onlyOwner {
        airnode = _airnode;
        endpointId = _endpointId;
        sponsorWallet = _sponsorWallet;
    }
    
    /**
     * @notice Create a new raffle event
     * @param _nftContracts Array of NFT contract addresses
     * @param _tokenIds Array of NFT token IDs
     * @param _duration Duration of raffle in seconds
     */
    function createRaffle(
        address[] calldata _nftContracts,
        uint256[] calldata _tokenIds,
        uint256 _duration
    ) external nonReentrant whenNotPaused {
        require(_nftContracts.length == _tokenIds.length, "Array length mismatch");
        require(_nftContracts.length >= MIN_NFTS_PER_RAFFLE, "Too few NFTs");
        require(_nftContracts.length <= MAX_NFTS_PER_RAFFLE, "Too many NFTs");
        require(_duration >= 1 days && _duration <= 30 days, "Invalid duration");
        
        uint256 raffleId = raffleIdCounter++;
        RaffleEvent storage raffle = raffles[raffleId];
        
        raffle.raffleId = raffleId;
        raffle.creator = msg.sender;
        raffle.startTime = block.timestamp;
        raffle.endTime = block.timestamp + _duration;
        raffle.isActive = true;
        
        // Transfer NFTs to contract
        for (uint256 i = 0; i < _nftContracts.length; i++) {
            IERC721 nft = IERC721(_nftContracts[i]);
            require(nft.ownerOf(_tokenIds[i]) == msg.sender, "Not NFT owner");
            require(nft.getApproved(_tokenIds[i]) == address(this) || 
                    nft.isApprovedForAll(msg.sender, address(this)), "NFT not approved");
            
            nft.transferFrom(msg.sender, address(this), _tokenIds[i]);
            
            raffle.nfts.push(NFTInfo({
                nftContract: _nftContracts[i],
                tokenId: _tokenIds[i],
                claimed: false
            }));
        }
        
        emit RaffleCreated(raffleId, msg.sender, _nftContracts.length, raffle.endTime);
    }
    
    /**
     * @notice Claim daily free ticket
     */
    function claimDailyFreeTicket() external nonReentrant whenNotPaused {
        UserInfo storage user = users[msg.sender];
        
        require(
            block.timestamp >= user.lastFreeTicketClaim + SECONDS_PER_DAY,
            "Already claimed today"
        );
        
        user.lastFreeTicketClaim = block.timestamp;
        user.freeTicketsAvailable += DAILY_FREE_TICKETS;
        
        emit FreeTicketClaimed(msg.sender, DAILY_FREE_TICKETS);
    }
    
    /**
     * @notice Purchase tickets for a raffle
     * @param _raffleId ID of the raffle
     * @param _amount Number of tickets to purchase
     * @param _useFreeTickets Whether to use free tickets
     */
    function buyTickets(
        uint256 _raffleId,
        uint256 _amount,
        bool _useFreeTickets
    ) external payable nonReentrant whenNotPaused {
        require(_amount > 0, "Amount must be > 0");
        RaffleEvent storage raffle = raffles[_raffleId];
        require(raffle.isActive, "Raffle not active");
        require(block.timestamp < raffle.endTime, "Raffle ended");
        
        uint256 freeTicketsUsed = 0;
        uint256 paidTickets = _amount;
        
        if (_useFreeTickets) {
            UserInfo storage user = users[msg.sender];
            freeTicketsUsed = _amount > user.freeTicketsAvailable ? 
                             user.freeTicketsAvailable : _amount;
            user.freeTicketsAvailable -= freeTicketsUsed;
            paidTickets = _amount - freeTicketsUsed;
        }
        
        // Calculate payment
        uint256 totalCost = paidTickets * TICKET_PRICE;
        require(msg.value >= totalCost, "Insufficient payment");
        
        // Add tickets
        for (uint256 i = 0; i < _amount; i++) {
            raffleTickets[_raffleId].push(Ticket({
                buyer: msg.sender,
                raffleId: _raffleId,
                purchaseTime: block.timestamp,
                isFree: i < freeTicketsUsed
            }));
        }
        
        raffle.ticketsSold += _amount;
        raffle.paidTicketsSold += paidTickets;
        userTicketsInRaffle[_raffleId][msg.sender] += _amount;
        users[msg.sender].totalTicketsPurchased += paidTickets;
        
        // Update volume (fees now collected during claim)
        if (paidTickets > 0) {
            totalVolume += totalCost;
        }
        
        // Refund excess
        if (msg.value > totalCost) {
            (bool success, ) = msg.sender.call{value: msg.value - totalCost}("");
            require(success, "Refund failed");
        }
        
        emit TicketPurchased(_raffleId, msg.sender, _amount, freeTicketsUsed > 0);
    }
    
    /**
     * @notice Draw winner using API3 QRNG
     * @param _raffleId ID of the raffle
     */
    function drawWinner(uint256 _raffleId) external nonReentrant whenNotPaused {
        RaffleEvent storage raffle = raffles[_raffleId];
        require(raffle.isActive, "Raffle not active");
        require(block.timestamp >= raffle.endTime, "Raffle not ended");
        require(raffle.ticketsSold > 0, "No tickets sold");
        require(raffle.airnodeRequestId == 0, "Draw already requested");
        require(airnode != address(0), "QRNG not configured");
        
        // Request randomness from API3 QRNG
        bytes32 requestId = airnodeRrp.makeFullRequest(
            airnode,
            endpointId,
            address(this),
            sponsorWallet,
            address(this),
            this.fulfillUint256.selector,
            ""
        );
        
        raffle.airnodeRequestId = requestId;
        airnodeRequestToRaffleId[requestId] = _raffleId;
        
        emit RaffleDrawn(_raffleId, requestId);
    }
    
    /**
     * @notice Claim NFT prizes (winner only)
     * @param _raffleId ID of the raffle
     */
    function claimPrizes(uint256 _raffleId) external payable nonReentrant {
        RaffleEvent storage raffle = raffles[_raffleId];
        require(raffle.isCompleted, "Raffle not completed");
        require(raffle.winner == msg.sender, "Not the winner");
        
        // Calculate 5% Project Fee from total revenue
        uint256 raffleRevenue = raffle.paidTicketsSold * TICKET_PRICE;
        uint256 claimFee = (raffleRevenue * PROJECT_FEE_PERCENTAGE) / 100;
        
        require(msg.value >= claimFee, "Must pay 5% project fee to claim");
        totalFees += claimFee;

        for (uint256 i = 0; i < raffle.nfts.length; i++) {
            if (!raffle.nfts[i].claimed) {
                raffle.nfts[i].claimed = true;
                IERC721(raffle.nfts[i].nftContract).transferFrom(
                    address(this),
                    msg.sender,
                    raffle.nfts[i].tokenId
                );
                
                emit NFTClaimed(
                    _raffleId,
                    msg.sender,
                    raffle.nfts[i].nftContract,
                    raffle.nfts[i].tokenId
                );
            }
        }
    }
    
    // ==================== VRF Callback ====================
    
    /**
     * @notice Callback function for API3 QRNG
     */
    function fulfillUint256(bytes32 requestId, bytes calldata data) external {
        require(msg.sender == address(airnodeRrp), "Only AirnodeRrp can call");
        uint256 _raffleId = airnodeRequestToRaffleId[requestId];
        RaffleEvent storage raffle = raffles[_raffleId];
        require(raffle.isActive, "Raffle not active");
        
        uint256 qrngUint256 = abi.decode(data, (uint256));
        
        // Select winner
        uint256 winningTicketIndex = qrngUint256 % raffle.ticketsSold;
        address winner = raffleTickets[_raffleId][winningTicketIndex].buyer;
        
        raffle.winner = winner;
        raffle.isActive = false;
        raffle.isCompleted = true;
        
        users[winner].totalWins++;
        
        emit WinnerSelected(_raffleId, winner, qrngUint256);
    }
    
    // ==================== View Functions ====================
    
    function getRaffleInfo(uint256 _raffleId) external view returns (
        uint256 raffleId,
        address creator,
        uint256 startTime,
        uint256 endTime,
        uint256 ticketsSold,
        uint256 paidTicketsSold,
        bool isActive,
        bool isCompleted,
        address winner,
        uint256 nftCount
    ) {
        RaffleEvent storage raffle = raffles[_raffleId];
        return (
            raffle.raffleId,
            raffle.creator,
            raffle.startTime,
            raffle.endTime,
            raffle.ticketsSold,
            raffle.paidTicketsSold,
            raffle.isActive,
            raffle.isCompleted,
            raffle.winner,
            raffle.nfts.length
        );
    }
    
    function getUserTickets(uint256 _raffleId, address _user) external view returns (uint256) {
        return userTicketsInRaffle[_raffleId][_user];
    }
    
    function getUserInfo(address _user) external view returns (
        uint256 totalTicketsPurchased,
        uint256 totalWins,
        uint256 freeTicketsAvailable,
        uint256 lastFreeTicketClaim
    ) {
        UserInfo storage user = users[_user];
        return (
            user.totalTicketsPurchased,
            user.totalWins,
            user.freeTicketsAvailable,
            user.lastFreeTicketClaim
        );
    }
    
    // ==================== Admin Functions ====================
    
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function withdrawRaffleRevenue(uint256 _raffleId) external nonReentrant {
        RaffleEvent storage raffle = raffles[_raffleId];
        require(raffle.isCompleted, "Raffle not completed");
        require(raffle.creator == msg.sender, "Only creator can withdraw");
        
        uint256 revenue = raffle.paidTicketsSold * TICKET_PRICE;
        require(revenue > 0, "No revenue to withdraw");
        
        // Ensure revenue is only withdrawn once
        raffle.paidTicketsSold = 0; 
        
        (bool success, ) = msg.sender.call{value: revenue}("");
        require(success, "Withdrawal failed");
    }

    receive() external payable {}
}
