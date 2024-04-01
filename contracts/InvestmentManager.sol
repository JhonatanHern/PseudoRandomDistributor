// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Investment Manager Contract
/// @notice This contract manages pseudo-random investment rounds for a specific ERC20 token.
contract InvestmentManager {
    struct InvestmentRound {
        uint256 zeroBlock; // The block number when the investment round begins.
        uint256 blockInterval; // The interval between blocks for the investment round.
        uint256 minimumDailyAmount; // The minimum daily amount for an approved round.
        uint256 maximumDailyAmount; // The maximum daily amount for an approved round.
        uint256 withdrawChance; // The chance of withdrawing, expressed as "withdrawChance in 1000".
        mapping(uint => mapping(uint => bool)) claimedBlockIndexes; // The indexes of the already claimed blocks.
    }

    address public immutable investor; // The address of the investor.
    address public immutable marketMaker; // The address of the market maker.
    IERC20 public immutable investmentToken; // The ERC20 token used for the investment.
    InvestmentRound public investmentRound; // The current investment round.
    // It increases every time resetInvestmentRound is called. This allows to validate claimed blocks after rounds resets.
    // https://docs.soliditylang.org/en/develop/types.html#:~:text=delete%20has%20no%20effect%20on%20mappings
    uint256 public roundReplacementCounter;

    event Withdrawal(uint256 blockCounter, uint256 amount);

    event RoundReset(
        uint256 newRoundCounter,
        uint256 blockInterval,
        uint256 minimumDailyAmount,
        uint256 maximumDailyAmount,
        uint256 withdrawChance
    );

    /// @notice Contract constructor.
    /// @param _investor The address of the investor.
    /// @param _marketMaker The address of the market maker.
    /// @param _investmentToken The ERC20 token used for the investment.
    constructor(
        address _investor,
        address _marketMaker,
        IERC20 _investmentToken
    ) {
        investor = _investor;
        marketMaker = _marketMaker;
        investmentToken = _investmentToken;
    }

    /// @notice Modifier to restrict function access to the investor only.
    modifier onlyInvestor() {
        require(msg.sender == investor, "Caller is not the investor");
        _;
    }

    /// @notice Modifier to restrict function access to the market maker only.
    modifier onlyMarketMaker() {
        require(msg.sender == marketMaker, "Caller is not the market maker");
        _;
    }

    /// @notice Creates a new investment round.
    /// @param amount The amount of tokens to invest.
    /// @param blockInterval The interval between blocks for the investment round.
    /// @param minimumDailyAmount The minimum daily amount for the investment round.
    /// @param maximumDailyAmount The maximum daily amount for the investment round.
    /// @param withdrawChance The chance of withdrawing, expressed as "withdrawChance in 1000".
    function createInvestmentRound(
        uint256 amount,
        uint256 blockInterval,
        uint256 minimumDailyAmount,
        uint256 maximumDailyAmount,
        uint256 withdrawChance
    ) external onlyInvestor {
        require(amount > 0, "Investment must be greater than 0");
        require(
            investmentRound.zeroBlock == 0,
            "Investment round already exists"
        );
        require(
            withdrawChance <= 1000 && withdrawChance > 0,
            "Withdraw chance invalid"
        );
        require(
            investmentToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        investmentRound.zeroBlock = block.number;
        investmentRound.blockInterval = blockInterval;
        investmentRound.minimumDailyAmount = minimumDailyAmount;
        investmentRound.maximumDailyAmount = maximumDailyAmount;
        investmentRound.withdrawChance = withdrawChance;
    }

    /// @notice Calculates if tokens are to be withdrawn based on the a specific block and how many tokens should be withdrawn.
    /// @param blockCounter The counter that determines the block to be tested.
    /// @param minimumDailyAmount The minimum daily amount for the investment round.
    /// @param maximumDailyAmount The maximum daily amount for the investment round.
    /// @param withdrawChance The chance of withdrawing, expressed as "withdrawChance in 1000".
    /// @return The amount of tokens that should be withdrawn.
    function randomAmountBasedOnBlock(
        uint256 blockCounter,
        uint256 minimumDailyAmount,
        uint256 maximumDailyAmount,
        uint256 withdrawChance
    ) private view returns (uint256) {
        uint256 requestedWithdrawBlock = investmentRound.zeroBlock +
            (investmentRound.blockInterval * blockCounter);
        require(
            block.number >= requestedWithdrawBlock,
            "It's not time to withdraw yet"
        );
        bytes32 requestedBlockHash = blockhash(requestedWithdrawBlock);
        uint256 range = maximumDailyAmount - minimumDailyAmount;
        uint256 pseudoRandomNumber = uint(
            keccak256(abi.encodePacked(requestedBlockHash))
        );
        if (pseudoRandomNumber % 1000 > withdrawChance) {
            return 0;
        }
        return minimumDailyAmount + (pseudoRandomNumber % range);
    }

    /// @notice Allows the market maker to withdraw tokens for selected blocks.
    /// @param blockCounter The current block counter.
    function withdraw(
        uint256 blockCounter
    ) external onlyMarketMaker returns (uint256) {
        require(
            investmentRound.zeroBlock > 0,
            "Investment round does not exist"
        );
        require(blockCounter >= 1, "blockCounter must be >= 1");
        require(
            !investmentRound.claimedBlockIndexes[roundReplacementCounter][
                blockCounter
            ],
            "Block already claimed"
        );
        investmentRound.claimedBlockIndexes[roundReplacementCounter][
            blockCounter
        ] = true;

        uint256 contractBalance = investmentToken.balanceOf(address(this));

        uint256 amountForBlock = randomAmountBasedOnBlock(
            blockCounter,
            investmentRound.minimumDailyAmount,
            investmentRound.maximumDailyAmount,
            investmentRound.withdrawChance
        );

        require(amountForBlock > 0, "No funds available for this block");
        require(contractBalance > 0, "No funds left in the contract");

        uint256 finalAmountToWithdraw = amountForBlock < contractBalance
            ? amountForBlock
            : contractBalance;

        require(
            investmentToken.transfer(marketMaker, finalAmountToWithdraw),
            "Withdrawal failed"
        );
        emit Withdrawal(blockCounter, finalAmountToWithdraw);
        return finalAmountToWithdraw;
    }

    /// @notice Checks if a block is available for withdrawal.
    /// @param blockCounter The counter that determines the block to be tested.
    /// @return The amount of tokens that can be withdrawn.
    function isBlockAvailable(
        uint256 blockCounter
    ) public view returns (uint256) {
        if (
            investmentRound.claimedBlockIndexes[roundReplacementCounter][
                blockCounter
            ]
        ) {
            return 0;
        }
        return
            randomAmountBasedOnBlock(
                blockCounter,
                investmentRound.minimumDailyAmount,
                investmentRound.maximumDailyAmount,
                investmentRound.withdrawChance
            );
    }

    /// @notice Resets the current investment round with new parameters. This function can be used to change the parameters of the current round or to pause the contract by providing an extremely large block interval.
    /// @dev Executing this function will block any unclaimed funds from the current round. If there are any unclaimed funds, they should be claimed before executing this function. This function does not recover the funds invested in the current round. It simply changes the parameters for future rounds. Can only be called by the investor.
    /// @param blockInterval The interval between blocks for the new round. Must be greater than 1000.
    /// @param minimumDailyAmount The minimum daily amount for the new round.
    /// @param maximumDailyAmount The maximum daily amount for the new round.
    /// @param withdrawChance The chance of withdrawing for the new round, expressed as "withdrawChance in 1000".
    function resetInvestmentRound(
        uint256 blockInterval,
        uint256 minimumDailyAmount,
        uint256 maximumDailyAmount,
        uint256 withdrawChance
    ) external onlyInvestor {
        require(
            investmentRound.zeroBlock > 0,
            "Investment round does not exist"
        );
        require(blockInterval > 1000, "Block interval too small");
        // starting from the current block
        investmentRound.zeroBlock = block.number;
        investmentRound.blockInterval = blockInterval;
        investmentRound.minimumDailyAmount = minimumDailyAmount;
        investmentRound.maximumDailyAmount = maximumDailyAmount;
        investmentRound.withdrawChance = withdrawChance;
        roundReplacementCounter++;
        emit RoundReset(
            roundReplacementCounter,
            blockInterval,
            minimumDailyAmount,
            maximumDailyAmount,
            withdrawChance
        );
    }

    /// @notice Gets the hash of a specific block. Testing helper.
    /// @param blockCounter The current block counter.
    /// @return The hash of the specified block.
    function getBlockHash(uint256 blockCounter) public view returns (bytes32) {
        uint256 requestedWithdrawBlock = investmentRound.zeroBlock +
            (investmentRound.blockInterval * blockCounter);
        require(
            block.number >= requestedWithdrawBlock,
            "It's not time to withdraw yet"
        );
        return blockhash(requestedWithdrawBlock);
    }
}
