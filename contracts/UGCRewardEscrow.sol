// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title UGCRewardEscrow
 * @notice Holds UGC campaign reward pools and lets participants claim rewards themselves.
 * @dev Backend only signs a short-lived EIP-712 authorization after verifying task completion.
 */
contract UGCRewardEscrow is AccessControl, Ownable2Step, ReentrancyGuard, Pausable, EIP712 {
    using SafeERC20 for IERC20;

    bytes32 public constant CLAIM_AUTHORIZER_ROLE = keccak256("CLAIM_AUTHORIZER_ROLE");
    bytes32 public constant FUND_MANAGER_ROLE = keccak256("FUND_MANAGER_ROLE");
    bytes32 public constant CLAIM_TYPEHASH = keccak256(
        "ClaimAuthorization(bytes32 campaignId,address claimant,address token,uint256 amount,uint256 deadline,uint256 nonce)"
    );

    uint256 public constant MAX_CLAIM_WINDOW = 3 days;
    address public constant NATIVE_TOKEN = address(0);

    mapping(bytes32 => mapping(address => uint256)) public escrowBalance;
    mapping(bytes32 => mapping(address => bool)) public hasClaimedCampaign;
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    event RewardDeposited(bytes32 indexed campaignId, address indexed token, address indexed funder, uint256 amount);
    event RewardClaimed(bytes32 indexed campaignId, address indexed claimant, address indexed token, uint256 amount, uint256 deadline, uint256 nonce);
    event RewardWithdrawn(bytes32 indexed campaignId, address indexed token, address indexed to, uint256 amount);

    error InvalidAddress();
    error InvalidAmount();
    error InvalidDeadline();
    error InvalidSignature();
    error AlreadyClaimed();
    error NonceUsed();
    error InsufficientEscrow();
    error TransferFailed();

    constructor(address initialAdmin, address initialAuthorizer)
        Ownable(initialAdmin)
        EIP712("DiscoDailyUGCRewardEscrow", "1")
    {
        if (initialAdmin == address(0) || initialAuthorizer == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(FUND_MANAGER_ROLE, initialAdmin);
        _grantRole(CLAIM_AUTHORIZER_ROLE, initialAuthorizer);
    }

    receive() external payable {}

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function depositNative(bytes32 campaignId) external payable nonReentrant whenNotPaused {
        if (campaignId == bytes32(0)) revert InvalidAmount();
        if (msg.value == 0) revert InvalidAmount();
        escrowBalance[campaignId][NATIVE_TOKEN] += msg.value;
        emit RewardDeposited(campaignId, NATIVE_TOKEN, msg.sender, msg.value);
    }

    function depositERC20(bytes32 campaignId, address token, uint256 amount) external nonReentrant whenNotPaused {
        if (campaignId == bytes32(0) || token == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        escrowBalance[campaignId][token] += amount;
        emit RewardDeposited(campaignId, token, msg.sender, amount);
    }

    function claim(
        bytes32 campaignId,
        address token,
        uint256 amount,
        uint256 deadline,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        if (campaignId == bytes32(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (block.timestamp > deadline || deadline > block.timestamp + MAX_CLAIM_WINDOW) revert InvalidDeadline();
        if (hasClaimedCampaign[campaignId][msg.sender]) revert AlreadyClaimed();
        if (usedNonces[msg.sender][nonce]) revert NonceUsed();

        bytes32 structHash = keccak256(abi.encode(
            CLAIM_TYPEHASH,
            campaignId,
            msg.sender,
            token,
            amount,
            deadline,
            nonce
        ));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (!hasRole(CLAIM_AUTHORIZER_ROLE, signer)) revert InvalidSignature();

        uint256 currentBalance = escrowBalance[campaignId][token];
        if (currentBalance < amount) revert InsufficientEscrow();

        usedNonces[msg.sender][nonce] = true;
        hasClaimedCampaign[campaignId][msg.sender] = true;
        escrowBalance[campaignId][token] = currentBalance - amount;

        if (token == NATIVE_TOKEN) {
            (bool ok, ) = payable(msg.sender).call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }

        emit RewardClaimed(campaignId, msg.sender, token, amount, deadline, nonce);
    }

    function withdrawExpiredOrCancelled(
        bytes32 campaignId,
        address token,
        address payable to,
        uint256 amount
    ) external onlyRole(FUND_MANAGER_ROLE) nonReentrant {
        if (campaignId == bytes32(0) || to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        uint256 currentBalance = escrowBalance[campaignId][token];
        if (currentBalance < amount) revert InsufficientEscrow();
        escrowBalance[campaignId][token] = currentBalance - amount;

        if (token == NATIVE_TOKEN) {
            (bool ok, ) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }

        emit RewardWithdrawn(campaignId, token, to, amount);
    }
}
