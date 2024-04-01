// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IInvestmentManager.sol";

/// @title Mock Trader Contract
/// @notice This contract simulates trading operations using the InvestmentManager contract.
contract MockTrader {
    address private immutable rewardRecipient;
    IInvestmentManager public investmentManager;
    IERC20 public immutable rewardToken;

    /// @notice Contract constructor.
    /// @param _rewardRecipient The address that will receive the reward tokens.
    /// @param _rewardToken The ERC20 token used as the reward.
    constructor(address _rewardRecipient, address _rewardToken) {
        require(
            _rewardRecipient != address(0),
            "Invalid reward recipient address"
        );
        require(_rewardToken != address(0), "Invalid reward token address");
        rewardRecipient = _rewardRecipient;
        rewardToken = IERC20(_rewardToken);
    }

    /// @notice Adds the address of the Investment Manager contract.
    /// @param _investmentManager Address of the Investment Manager contract.
    function addInvestmentManager(address _investmentManager) external {
        require(
            _investmentManager != address(0),
            "Invalid investment manager address"
        );
        require(
            address(investmentManager) == address(0),
            "Investment manager already set"
        );
        investmentManager = IInvestmentManager(_investmentManager);
    }

    /// @notice Simulates withdrawal of tokens from the Investment Manager and trading them for reward tokens.
    /// @param blockCounter The current block counter.
    function withdrawAndTrade(uint256 blockCounter) external {
        require(
            address(investmentManager) != address(0),
            "Investment manager must be set first"
        );
        uint256 withdrawnAmount = investmentManager.withdraw(blockCounter);
        // A live implementation needs a trade function here
        // that would trade the withdrawn tokens in an exchange
        // in exchange for the reward tokens.
        rewardToken.transfer(rewardRecipient, withdrawnAmount);
    }
}
