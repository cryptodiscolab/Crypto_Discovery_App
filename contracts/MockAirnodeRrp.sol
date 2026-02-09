// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockAirnodeRrp {
    function makeFullRequest(
        address airnode,
        bytes32 endpointId,
        address sponsor,
        address sponsorWallet,
        address fulfillAddress,
        bytes4 fulfillFunctionId,
        bytes calldata parameters
    ) external returns (bytes32) {
        return keccak256(abi.encodePacked(block.timestamp));
    }

    function setSponsorshipStatus(address requester, bool status) external {}
}
