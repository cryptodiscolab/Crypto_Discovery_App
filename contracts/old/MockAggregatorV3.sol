// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

contract MockAggregatorV3 is AggregatorV3Interface {
    uint8 public override decimals;
    int256 public latestAnswer;

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals = _decimals;
        latestAnswer = _initialAnswer;
    }

    function updateAnswer(int256 _answer) external {
        latestAnswer = _answer;
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        return (1, latestAnswer, block.timestamp, block.timestamp, 1);
    }
}
