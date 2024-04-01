# Investment Manager Contract

The Investment Manager contract is a Solidity contract that manages pseudo-random investment rounds for a specific ERC20 token. It allows an investor to create an investment round and a market maker to withdraw tokens based on the parameters of the round.

## Contract Details

### Structs

- `InvestmentRound`: Represents a single investment round. It includes the following properties:
  - `zeroBlock`: The block number when the investment round begins.
  - `blockInterval`: The interval between blocks for the investment round.
  - `minimumDailyAmount`: The minimum daily amount for an approved round.
  - `maximumDailyAmount`: The maximum daily amount for an approved round.
  - `withdrawChance`: The chance of withdrawing, expressed as "withdrawChance in 1000".
  - `claimedBlockIndexes`: A mapping of the indexes of the already claimed blocks.

### State Variables

- `investor`: The address of the investor.
- `marketMaker`: The address of the market maker.
- `investmentToken`: The ERC20 token used for the investment.
- `investmentRound`: The current investment round.

### Events

- `Withdrawal`: Emitted when a withdrawal is made. It includes the block counter and the amount withdrawn.

### Functions

- `constructor`: Initializes the contract with the investor, market maker, and investment token addresses.
- `createInvestmentRound`: Creates a new investment round with the specified parameters. Can only be called by the investor.
- `randomAmountBasedOnBlock`: Calculates if tokens are to be withdrawn based on a specific block and how many tokens should be withdrawn.
- `withdraw`: Allows the market maker to withdraw tokens for selected blocks. Emits a `Withdrawal` event.
- `isBlockAvailable`: Checks if a block is available for withdrawal.
- `getBlockHash`: Gets the hash of a specific block. This is a testing helper function.

## Mock Trader Contract

The Mock Trader contract is a separate contract that simulates trading operations using the Investment Manager contract. It allows a reward recipient to withdraw tokens from the Investment Manager and trade them for reward tokens.

### State Variables

- `rewardRecipient`: The address that will receive the reward tokens.
- `investmentManager`: The Investment Manager contract.
- `rewardToken`: The ERC20 token used as the reward.

### Functions

- `constructor`: Initializes the contract with the reward recipient and reward token addresses.
- `addInvestmentManager`: Adds an Investment Manager contract.
- `withdrawAndTrade`: Withdraws tokens from the Investment Manager and trades them for reward tokens.

## Getting Started

To interact with these contracts, you will need to have [Node.js](https://nodejs.org/) installed. You will also need to install the contract dependencies, which include [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts).
To install the necessary dependencies, run the following command in your terminal:

```bash
npm install
```

Once you have these tools installed, you can compile the contracts with `npx hardhat compile`, and test them with `npx hardhat test test/InvestmentManager.js`.

## Security

These contracts have not been audited. Use them at your own risk. Always make sure to test and audit your contracts thoroughly before deploying them to a live network. Especially a contract like this one that is designed to handle real funds.
