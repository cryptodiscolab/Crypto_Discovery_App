// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ContentCMSV2
 * @notice Advanced On-chain Content Management System with Role-Based Access & Sponsored Access
 * @dev Uses AccessControl for role management and supports batch operations
 */
contract ContentCMSV2 is AccessControl {
    // Role definitions
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Feature IDs for sponsored access
    uint256 public constant FEATURE_FREE_DAILY_TASK = 1;
    uint256 public constant FEATURE_FREE_RAFFLE_TICKET = 2;
    uint256 public constant FEATURE_PREMIUM_ACCESS = 3;
    
    // Content storage (JSON strings for flexibility)
    string public announcementJSON;
    string public newsJSON;
    string public featureCardsJSON;
    
    // Sponsored access whitelist: user => featureId => hasAccess
    mapping(address => mapping(uint256 => bool)) public hasPrivilege;
    
    // Events
    event ContentUpdated(string contentType, uint256 timestamp);
    event BatchContentUpdated(uint256 timestamp);
    event PrivilegeGranted(address indexed user, uint256 indexed featureId, uint256 timestamp);
    event PrivilegeRevoked(address indexed user, uint256 indexed featureId, uint256 timestamp);
    event BatchPrivilegesGranted(uint256 userCount, uint256 timestamp);
    
    /**
     * @dev Constructor sets up roles and default content
     * @param initialAdmin Address of the initial admin (deployer)
     */
    constructor(address initialAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(OPERATOR_ROLE, initialAdmin);
        
        // Set default empty content
        announcementJSON = '{"visible":false,"title":"","message":"","type":"info"}';
        newsJSON = "[]";
        featureCardsJSON = "[]";
    }
    
    // ============================================
    // CONTENT MANAGEMENT FUNCTIONS
    // ============================================
    
    /**
     * @notice Update announcement content
     * @param _newContent JSON string containing announcement data
     */
    function updateAnnouncement(string memory _newContent) external onlyRole(OPERATOR_ROLE) {
        announcementJSON = _newContent;
        emit ContentUpdated("announcement", block.timestamp);
    }
    
    /**
     * @notice Update news content
     * @param _newContent JSON string containing news array
     */
    function updateNews(string memory _newContent) external onlyRole(OPERATOR_ROLE) {
        newsJSON = _newContent;
        emit ContentUpdated("news", block.timestamp);
    }
    
    /**
     * @notice Update feature cards content
     * @param _newContent JSON string containing feature cards array
     */
    function updateFeatureCards(string memory _newContent) external onlyRole(OPERATOR_ROLE) {
        featureCardsJSON = _newContent;
        emit ContentUpdated("featureCards", block.timestamp);
    }
    
    /**
     * @notice Batch update all content in one transaction (GAS SAVER!)
     * @param _announcement New announcement JSON
     * @param _news New news JSON
     * @param _featureCards New feature cards JSON
     */
    function batchUpdate(
        string memory _announcement,
        string memory _news,
        string memory _featureCards
    ) external onlyRole(OPERATOR_ROLE) {
        announcementJSON = _announcement;
        newsJSON = _news;
        featureCardsJSON = _featureCards;
        emit BatchContentUpdated(block.timestamp);
    }
    
    // ============================================
    // VIEW FUNCTIONS (FREE - NO GAS)
    // ============================================
    
    function getAnnouncement() external view returns (string memory) {
        return announcementJSON;
    }
    
    function getNews() external view returns (string memory) {
        return newsJSON;
    }
    
    function getFeatureCards() external view returns (string memory) {
        return featureCardsJSON;
    }
    
    // ============================================
    // ROLE MANAGEMENT FUNCTIONS
    // ============================================
    
    /**
     * @notice Grant operator role to an address
     * @param account Address to grant operator role
     */
    function grantOperator(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(OPERATOR_ROLE, account);
    }
    
    /**
     * @notice Revoke operator role from an address
     * @param account Address to revoke operator role
     */
    function revokeOperator(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(OPERATOR_ROLE, account);
    }
    
    /**
     * @notice Check if an address has operator role
     * @param account Address to check
     */
    function isOperator(address account) external view returns (bool) {
        return hasRole(OPERATOR_ROLE, account);
    }
    
    // ============================================
    // SPONSORED ACCESS WHITELIST FUNCTIONS
    // ============================================
    
    /**
     * @notice Grant privilege to a user for a specific feature
     * @param user User address to grant privilege
     * @param featureId Feature ID (1=Daily Task, 2=Raffle Ticket, 3=Premium)
     */
    function grantPrivilege(address user, uint256 featureId) 
        external 
        onlyRole(OPERATOR_ROLE) 
    {
        hasPrivilege[user][featureId] = true;
        emit PrivilegeGranted(user, featureId, block.timestamp);
    }
    
    /**
     * @notice Revoke privilege from a user for a specific feature
     * @param user User address to revoke privilege
     * @param featureId Feature ID
     */
    function revokePrivilege(address user, uint256 featureId) 
        external 
        onlyRole(OPERATOR_ROLE) 
    {
        hasPrivilege[user][featureId] = false;
        emit PrivilegeRevoked(user, featureId, block.timestamp);
    }
    
    /**
     * @notice Batch grant privileges to multiple users (GAS SAVER!)
     * @param users Array of user addresses
     * @param featureIds Array of feature IDs (must match users length)
     */
    function batchGrantPrivileges(
        address[] memory users,
        uint256[] memory featureIds
    ) external onlyRole(OPERATOR_ROLE) {
        require(users.length == featureIds.length, "Array length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            hasPrivilege[users[i]][featureIds[i]] = true;
            emit PrivilegeGranted(users[i], featureIds[i], block.timestamp);
        }
        
        emit BatchPrivilegesGranted(users.length, block.timestamp);
    }
    
    /**
     * @notice Check if a user has access to a specific feature
     * @param user User address to check
     * @param featureId Feature ID to check
     * @return bool True if user has privilege, false otherwise
     */
    function hasAccess(address user, uint256 featureId) 
        external 
        view 
        returns (bool) 
    {
        return hasPrivilege[user][featureId];
    }
}
