// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title SBTMintEntitlementVerifier
 * @notice Phase 3 verifier module for DB-canonical SBT mint eligibility.
 * @dev Intended integration:
 *      1. Backend/admin signer issues this EIP-712 entitlement after DB XP check.
 *      2. DailyApp calls consumeEntitlement(msg.sender, ...) before minting/upgrading SBT.
 *      3. DailyApp still enforces payment, supply, soulbound, and sequential tier rules.
 */
contract SBTMintEntitlementVerifier is AccessControl, EIP712 {
    bytes32 public constant ENTITLEMENT_SIGNER_ROLE = keccak256("ENTITLEMENT_SIGNER_ROLE");
    bytes32 public constant CONSUMER_ROLE = keccak256("CONSUMER_ROLE");

    bytes32 public constant SBT_MINT_ENTITLEMENT_TYPEHASH = keccak256(
        "SBTMintEntitlement(address wallet,address targetContract,uint8 targetTier,uint256 requiredXp,uint256 nonce,uint256 deadline)"
    );

    struct SBTMintEntitlement {
        address wallet;
        address targetContract;
        uint8 targetTier;
        uint256 requiredXp;
        uint256 nonce;
        uint256 deadline;
    }

    mapping(address => mapping(uint256 => bool)) public usedNonces;

    event SBTMintEntitlementConsumed(
        address indexed wallet,
        address indexed targetContract,
        uint8 indexed targetTier,
        uint256 requiredXp,
        uint256 nonce,
        address signer
    );

    error InvalidEntitlement();
    error EntitlementExpired();
    error EntitlementAlreadyUsed();
    error UnauthorizedSigner();

    constructor(address initialOwner) EIP712("DiscoDailySBTMintEntitlement", "1") {
        if (initialOwner == address(0)) revert InvalidEntitlement();

        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(ENTITLEMENT_SIGNER_ROLE, initialOwner);
        _grantRole(CONSUMER_ROLE, initialOwner);
    }

    /**
     * @notice Verify and consume a wallet-scoped entitlement nonce.
     * @dev Must be called by the target DailyApp contract before mint. Requiring
     * targetContract == msg.sender prevents a valid voucher from being replayed
     * against another SBT contract even if both trust this verifier. The claimant
     * check binds the voucher wallet to the actual user DailyApp is minting for.
     */
    function consumeEntitlement(
        address claimant,
        SBTMintEntitlement calldata entitlement,
        bytes calldata signature
    )
        external
        onlyRole(CONSUMER_ROLE)
        returns (address signer)
    {
        if (claimant != entitlement.wallet) revert InvalidEntitlement();
        if (entitlement.wallet == address(0)) revert InvalidEntitlement();
        if (entitlement.targetContract != msg.sender) revert InvalidEntitlement();
        if (entitlement.targetTier == 0 || entitlement.targetTier > 5) revert InvalidEntitlement();
        if (entitlement.requiredXp == 0) revert InvalidEntitlement();
        if (block.timestamp > entitlement.deadline) revert EntitlementExpired();
        if (usedNonces[entitlement.wallet][entitlement.nonce]) revert EntitlementAlreadyUsed();

        signer = ECDSA.recover(hashEntitlement(entitlement), signature);
        if (!hasRole(ENTITLEMENT_SIGNER_ROLE, signer)) revert UnauthorizedSigner();

        usedNonces[entitlement.wallet][entitlement.nonce] = true;

        emit SBTMintEntitlementConsumed(
            entitlement.wallet,
            entitlement.targetContract,
            entitlement.targetTier,
            entitlement.requiredXp,
            entitlement.nonce,
            signer
        );
    }

    function hashEntitlement(SBTMintEntitlement calldata entitlement) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    SBT_MINT_ENTITLEMENT_TYPEHASH,
                    entitlement.wallet,
                    entitlement.targetContract,
                    entitlement.targetTier,
                    entitlement.requiredXp,
                    entitlement.nonce,
                    entitlement.deadline
                )
            )
        );
    }
}
