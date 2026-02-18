// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DailyAppTypes
 * @notice Shared types, errors, and interfaces for the DailyApp modular system.
 *         Extracted from DailyAppV12Secured.sol to reduce bytecode per contract.
 */

// ─── ENUMS ───────────────────────────────────────────────────────────────────

enum NFTTier { NONE, BRONZE, SILVER, GOLD, PLATINUM, DIAMOND }
enum SponsorLevel { BRONZE, SILVER, GOLD }
enum RequestStatus { PENDING, APPROVED, REJECTED }

// ─── STRUCTS ─────────────────────────────────────────────────────────────────

struct NFTConfig {
    uint256 pointsRequired;
    uint256 mintPrice;
    uint256 dailyBonus;
    uint256 multiplierBP;
    uint256 maxSupply;
    uint256 currentSupply;
}

struct Task {
    uint256 baseReward;
    bool isActive;
    uint256 cooldown;
    NFTTier minTier;
    string title;
    string link;
    uint256 createdAt;
    bool requiresVerification;
    uint256 sponsorshipId;
}

struct UserStats {
    uint256 points;
    uint256 totalTasksCompleted;
    uint256 referralCount;
    NFTTier currentTier;
    uint256 tasksForReferralProgress;
    uint256 lastDailyBonusClaim;
    bool isBlacklisted;
}

struct SponsorRequest {
    address sponsor;
    SponsorLevel level;
    string title;
    string link;
    string contactEmail;
    uint256 feePaid;
    address feeToken;
    uint256 rewardAmount;
    uint256 maxParticipants;
    uint256 rewardPerUser;
    RequestStatus status;
    uint256 timestamp;
    uint256 unlockTime;
}

struct PendingPriceChange {
    uint256 newPrice;
    uint256 effectiveTime;
    bool isPending;
}

// ─── CUSTOM ERRORS ────────────────────────────────────────────────────────────

error Unauthorized();
error InvalidAddress();
error InvalidTier();
error TaskDoesNotExist();
error TaskInactive();
error TierTooLow();
error CooldownActive();
error AlreadyCompleted();
error TaskFull();
error InsufficientPoints();
error InsufficientPayment();
error SoldOut();
error AlreadyOwnNFT();
error SequentialUpgradeRequired();
error RefundFailed();
error PoolEmpty();
error NotApproved();
error AlreadyClaimed();
error Blacklisted();
error MaxUsersReached();
error TaskNotVerified();
error InvalidReward();
error InvalidCooldown();
error InvalidTitle();
error InvalidLink();
error NotPending();
error RewardsLocked();
error PoolFull();
error RewardTooLow();
error TransferFailed();
error StalePrice();

// ─── CHAINLINK INTERFACE ──────────────────────────────────────────────────────

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}
