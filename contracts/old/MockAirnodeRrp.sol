// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockAirnodeRrp {
    function makeFullRequest(
        address,
        bytes32,
        address,
        address,
        address,
        bytes4,
        bytes calldata
    ) external view returns (bytes32) {
        return keccak256(abi.encodePacked(block.timestamp));
    }

    function setSponsorshipStatus(address, bool) external pure {}
}
