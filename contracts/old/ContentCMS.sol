// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ContentCMS
 * @notice On-chain Content Management System for Disco Gacha
 * @dev Stores feature cards and announcements as JSON strings for flexibility
 */
contract ContentCMS is Ownable {
    // JSON strings for flexible content storage
    string public featureCardsJSON;
    string public announcementJSON;
    
    // Events for tracking changes
    event FeatureCardsUpdated(string newContent, uint256 timestamp);
    event AnnouncementUpdated(string newContent, uint256 timestamp);
    
    /**
     * @dev Constructor sets initial owner and default content
     * @param initialOwner Address of the contract owner (admin)
     */
    constructor(address initialOwner) Ownable(initialOwner) {
        // Set default empty content
        featureCardsJSON = "[]";
        announcementJSON = '{"visible":false,"title":"","message":"","type":"info"}';
    }
    
    /**
     * @notice Update feature cards content (owner only)
     * @param _newContent JSON string containing feature cards data
     */
    function updateFeatureCards(string memory _newContent) external onlyOwner {
        featureCardsJSON = _newContent;
        emit FeatureCardsUpdated(_newContent, block.timestamp);
    }
    
    /**
     * @notice Update announcement content (owner only)
     * @param _newContent JSON string containing announcement data
     */
    function updateAnnouncement(string memory _newContent) external onlyOwner {
        announcementJSON = _newContent;
        emit AnnouncementUpdated(_newContent, block.timestamp);
    }
    
    /**
     * @notice Get current feature cards (public, no gas cost)
     * @return JSON string of feature cards
     */
    function getFeatureCards() external view returns (string memory) {
        return featureCardsJSON;
    }
    
    /**
     * @notice Get current announcement (public, no gas cost)
     * @return JSON string of announcement
     */
    function getAnnouncement() external view returns (string memory) {
        return announcementJSON;
    }
}
