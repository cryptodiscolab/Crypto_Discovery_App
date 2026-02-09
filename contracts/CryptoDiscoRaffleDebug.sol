// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Manual interface definition to avoid dependency constructor revert
interface IAirnodeRrpV0 {
    function setSponsorshipStatus(address sponsor, bool status) external;
    function makeFullRequest(address airnode, bytes32 endpointId, address sponsor, address sponsorWallet, address fulfillAddress, bytes4 fulfillFunctionId, bytes calldata parameters) external returns (bytes32 requestId);
}

/**
 * @title CryptoDiscoRaffleDebug
 * @notice Version 4 - Manual RRP Integration (Constructor Bypass)
 */
contract CryptoDiscoRaffleDebug is ReentrancyGuard, Pausable, Ownable {
    
    IAirnodeRrpV0 public immutable airnodeRrp;
    address public masterContract;

    constructor(
        address _masterContract,
        address _airnodeRrp
    ) Ownable(msg.sender) {
        masterContract = _masterContract;
        airnodeRrp = IAirnodeRrpV0(_airnodeRrp);
        // We skip the setSponsorshipStatus call here to avoid the revert.
        // It can be called manually later or from an init function.
    }

    modifier onlyAirnodeRrp() {
        require(msg.sender == address(airnodeRrp), "Caller not Airnode RRP");
        _;
    }
}
