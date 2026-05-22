// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IMasterX {
    function addPoints(address user, uint256 points, string calldata reason) external;
}
