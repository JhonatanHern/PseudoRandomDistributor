const {
  mine,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

const TOTAL_SUPPLY = ethers.parseEther("10000000");
const BLOCKS_ETHEREUM_MINES_PER_DAY = 7122; // https://ycharts.com/indicators/ethereum_blocks_per_day

/**
 * There is a limitation present in the hardhat network that stops us from increasing the block too many times (the block hash eventually becomes zero).
 * Therefore, the intended test of 2 years and 60m tokens is not possible to simulate here.
 * This test is limited to 4 months and 700k tokens.
 * Nevertheless, the test is still valid as it checks the functionality of the contract.
 */

describe("InvestmentManager", function () {
  async function deployManagerFixture() {
    const [investor, marketMaker, helperAccount] = await ethers.getSigners();

    const ExampleToken = await ethers.getContractFactory("ExampleToken");
    const investmentToken = await ExampleToken.deploy(
      "investmentToken",
      "IT",
      TOTAL_SUPPLY
    );

    const InvestmentManager = await ethers.getContractFactory(
      "InvestmentManager"
    );

    const investmentManager = await InvestmentManager.deploy(
      investor.address,
      marketMaker.address,
      investmentToken
    );

    return {
      investor,
      marketMaker,
      investmentToken,
      investmentManager,
      helperAccount,
    };
  }
  // This fixture replaces the marketMaker with a mock trader.
  // In case of developing a real trader, this fixture can be a good starter point to test the trader.
  async function deployManagerFixtureWithMockTrader() {
    const [investor, marketMaker, rewardRecipient, helperAccount] =
      await ethers.getSigners();

    const ExampleToken = await ethers.getContractFactory("ExampleToken");
    const investmentToken = await ExampleToken.deploy(
      "investmentToken",
      "IT",
      TOTAL_SUPPLY
    );
    const rewardToken = await ExampleToken.deploy(
      "rewardToken",
      "RT",
      TOTAL_SUPPLY
    );

    const MockTrader = await ethers.getContractFactory("MockTrader");
    const mockTrader = await MockTrader.deploy(
      rewardRecipient.address,
      rewardToken
    );

    await rewardToken.transfer(mockTrader, TOTAL_SUPPLY);

    const InvestmentManager = await ethers.getContractFactory(
      "InvestmentManager"
    );

    const investmentManager = await InvestmentManager.deploy(
      investor.address,
      mockTrader,
      investmentToken
    );

    await mockTrader.addInvestmentManager(investmentManager);

    return {
      investor,
      marketMaker,
      rewardRecipient,
      investmentToken,
      rewardToken,
      investmentManager,
      mockTrader,
      helperAccount,
    };
  }

  describe("Deployment", function () {
    it("Should set the right investor", async function () {
      const { investmentManager, investor } = await loadFixture(
        deployManagerFixture
      );

      expect(await investmentManager.investor()).to.equal(investor.address);
    });

    it("Should set the right marketMaker", async function () {
      const { investmentManager, marketMaker } = await loadFixture(
        deployManagerFixture
      );

      expect(await investmentManager.marketMaker()).to.equal(
        marketMaker.address
      );
    });

    it("Should set the right investmentToken", async function () {
      const { investmentManager, investmentToken } = await loadFixture(
        deployManagerFixture
      );

      expect(await investmentManager.investmentToken()).to.equal(
        investmentToken
      );
    });
  });

  describe("Invest", function () {
    it("Should invest the right amount", async function () {
      const { investmentManager, investor, investmentToken } =
        await loadFixture(deployManagerFixture);

      await investmentToken.approve(investmentManager, TOTAL_SUPPLY);
      await investmentManager.createInvestmentRound(
        ethers.parseEther("1000"), // amount,
        100, // blockInterval,
        ethers.parseEther("1"), // minimumDailyAmount,
        ethers.parseEther("19"), // maximumDailyAmount,
        500 // withdrawChance
      );

      expect(await investmentToken.balanceOf(investmentManager)).to.equal(
        ethers.parseEther("1000")
      );
    });

    it("Should fail if the investor does not have enough balance", async function () {
      const { investmentManager, investor, investmentToken, marketMaker } =
        await loadFixture(deployManagerFixture);
      await investmentToken.transfer(marketMaker.address, TOTAL_SUPPLY);
      await investmentToken.approve(investmentManager, TOTAL_SUPPLY);
      await expect(
        investmentManager.createInvestmentRound(
          ethers.parseEther("1000"), // amount,
          100, // blockInterval,
          ethers.parseEther("1"), // minimumDailyAmount,
          ethers.parseEther("19"), // maximumDailyAmount,
          500 // withdrawChance
        )
      ).to.be.revertedWithCustomError(
        investmentToken,
        "ERC20InsufficientBalance"
      );
    });

    it("Should fail if the investor has not approved the transfer", async function () {
      const { investmentManager, investor, investmentToken, marketMaker } =
        await loadFixture(deployManagerFixture);
      await expect(
        investmentManager.createInvestmentRound(
          ethers.parseEther("1000"), // amount,
          100, // blockInterval,
          ethers.parseEther("1"), // minimumDailyAmount,
          ethers.parseEther("19"), // maximumDailyAmount,
          500 // withdrawChance
        )
      ).to.be.revertedWithCustomError(
        investmentToken,
        "ERC20InsufficientAllowance"
      );
    });
  });

  describe("Complete Investment Round", function () {
    it("Should complete the investment round", async function () {
      const {
        investmentManager,
        investmentToken,
        investor,
        marketMaker,
        helperAccount,
      } = await loadFixture(deployManagerFixture);

      await investmentToken.approve(investmentManager, TOTAL_SUPPLY);
      // setup parameters
      const investingAmount = ethers.parseEther("700000");
      const oneInEight = 125; // 125/1000 = 1/8
      // create investment round
      await investmentManager.createInvestmentRound(
        investingAmount, // amount,
        BLOCKS_ETHEREUM_MINES_PER_DAY, // blockInterval,
        ethers.parseEther("1000"), // minimumDailyAmount,
        ethers.parseEther("159000"), // maximumDailyAmount,
        oneInEight // withdrawChance
      );
      const zeroBlock = (await investmentManager.investmentRound())[0];
      console.log(`Zero block:`, zeroBlock);
      const totalPeriods = 120; // Simulate for four months
      for (let i = 1; i <= totalPeriods; i++) {
        await mine(BLOCKS_ETHEREUM_MINES_PER_DAY);
        // trigger random transaction to change the blockchain status and therefore the block hash
        // this is needed to simulate the randomness of the block hash
        await helperAccount.sendTransaction({
          to: marketMaker.address,
          value: ethers.parseEther("0.01"),
        });

        const availableFundsInContract = await investmentToken.balanceOf(
          investmentManager
        );
        const availableFundsPerRound = await investmentManager.isBlockAvailable(
          i
        );
        if (availableFundsPerRound > 0 && availableFundsInContract > 0n) {
          await investmentManager.connect(marketMaker).withdraw(i);
        }
      }
      expect(await investmentToken.balanceOf(marketMaker)).to.equal(
        investingAmount
      );
      expect(await investmentToken.balanceOf(investmentManager)).to.equal(0);
    });
  });
  describe("Reset Investment Round and finish it", function () {
    it("Should complete the interrupted investment round", async function () {
      const {
        investmentManager,
        investmentToken,
        investor,
        marketMaker,
        helperAccount,
      } = await loadFixture(deployManagerFixture);

      await investmentToken.approve(investmentManager, TOTAL_SUPPLY);
      // setup parameters
      const investingAmount = ethers.parseEther("700000");
      const oneInEight = 125; // 125/1000 = 1/8
      // create investment round
      await investmentManager.createInvestmentRound(
        investingAmount, // amount,
        BLOCKS_ETHEREUM_MINES_PER_DAY, // blockInterval,
        ethers.parseEther("1000"), // minimumDailyAmount,
        ethers.parseEther("159000"), // maximumDailyAmount,
        oneInEight // withdrawChance
      );
      const totalPeriods = 120; // Simulate for four months
      for (let i = 1; i <= totalPeriods / 2; i++) {
        await mine(BLOCKS_ETHEREUM_MINES_PER_DAY);
        // trigger random transaction to change the blockchain status and therefore the block hash
        // this is needed to simulate the randomness of the block hash
        await helperAccount.sendTransaction({
          to: marketMaker.address,
          value: ethers.parseEther("0.01"),
        });

        const availableFundsInContract = await investmentToken.balanceOf(
          investmentManager
        );
        const availableFundsPerRound = await investmentManager.isBlockAvailable(
          i
        );
        if (availableFundsPerRound > 0 && availableFundsInContract > 0n) {
          await investmentManager.connect(marketMaker).withdraw(i);
        }
      }
      // reset the investment round
      await investmentManager.resetInvestmentRound(
        BLOCKS_ETHEREUM_MINES_PER_DAY / 2,
        ethers.parseEther("1000"),
        ethers.parseEther("159000"),
        oneInEight
      );
      for (let i = 1; i <= totalPeriods / 2; i++) {
        await mine(BLOCKS_ETHEREUM_MINES_PER_DAY / 2);
        await helperAccount.sendTransaction({
          to: marketMaker.address,
          value: ethers.parseEther("0.01"),
        });

        const availableFundsInContract = await investmentToken.balanceOf(
          investmentManager
        );
        const availableFundsPerRound = await investmentManager.isBlockAvailable(
          i
        );
        if (availableFundsPerRound > 0 && availableFundsInContract > 0n) {
          await investmentManager.connect(marketMaker).withdraw(i);
        }
      }
      expect(await investmentToken.balanceOf(marketMaker)).to.equal(
        investingAmount
      );
      expect(await investmentToken.balanceOf(investmentManager)).to.equal(0);
    });
  });

  describe("Complete Investment Round with Mock Trader", function () {
    it("Should complete the investment round and have the reward recipient receive the reward token", async function () {
      const {
        investmentManager,
        investmentToken,
        marketMaker,
        helperAccount,
        mockTrader,
        rewardRecipient,
        rewardToken,
      } = await loadFixture(deployManagerFixtureWithMockTrader);

      await investmentToken.approve(investmentManager, TOTAL_SUPPLY);
      // setup parameters
      const investingAmount = ethers.parseEther("700000");
      const oneInEight = 125; // 125/1000 = 1/8
      // create investment round
      await investmentManager.createInvestmentRound(
        investingAmount, // amount,
        BLOCKS_ETHEREUM_MINES_PER_DAY, // blockInterval,
        ethers.parseEther("1000"), // minimumDailyAmount,
        ethers.parseEther("159000"), // maximumDailyAmount,
        oneInEight // withdrawChance
      );
      const zeroBlock = (await investmentManager.investmentRound())[0];
      console.log(`Zero block:`, zeroBlock);
      const totalPeriods = 120; // Simulate for four months
      for (let i = 1; i <= totalPeriods; i++) {
        await mine(BLOCKS_ETHEREUM_MINES_PER_DAY);
        // trigger random transaction to change the blockchain status and therefore the block hash
        // this is needed to simulate the randomness of the block hash
        await helperAccount.sendTransaction({
          to: marketMaker.address,
          value: ethers.parseEther("0.01"),
        });

        const availableFundsInContract = await investmentToken.balanceOf(
          investmentManager
        );
        const availableFundsPerRound = await investmentManager.isBlockAvailable(
          i
        );
        if (availableFundsPerRound > 0 && availableFundsInContract > 0n) {
          await mockTrader.withdrawAndTrade(i);
        }
      }
      // Verify that the reward token has been properly transferred to the reward recipient
      expect(await rewardToken.balanceOf(rewardRecipient.address)).to.equal(
        investingAmount
      );
      expect(await investmentToken.balanceOf(investmentManager)).to.equal(0);
    });
  });
});
