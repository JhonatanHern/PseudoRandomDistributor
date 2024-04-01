// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IInvestmentManager {
    /// @notice Allows the market maker to withdraw tokens.
    /// @param blockCounter The current block counter.
    function withdraw(uint256 blockCounter) external returns (uint256);
}
