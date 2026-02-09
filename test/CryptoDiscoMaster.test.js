const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CryptoDiscoMaster", function () {
    let CryptoDiscoMaster, cryptoDiscoMaster;
    let MockPriceFeed, mockPriceFeed;
    let owner, user1, user2, operationsWallet, treasuryWallet, airnodeRrp;

    const REWARD_PRECISION = BigInt(1e18);
    const TIER_GOLD = 3;
    const TIER_SILVER = 2;
    const TIER_BRONZE = 1;
    const TIER_NONE = 0;

    beforeEach(async function () {
        [owner, user1, user2, operationsWallet, treasuryWallet, airnodeRrp] = await ethers.getSigners();

        // Deploy Mock Price Feed (8 decimals, $2000 ETH)
        const MockPriceFeedFactory = await ethers.getContractFactory("MockAggregatorV3");
        mockPriceFeed = await MockPriceFeedFactory.deploy(8, 200000000000);

        // Deploy Mock Airnode RRP
        const MockAirnodeRrpFactory = await ethers.getContractFactory("MockAirnodeRrp");
        const mockAirnodeRrp = await MockAirnodeRrpFactory.deploy();

        // Deploy Main Contract
        const CryptoDiscoMasterFactory = await ethers.getContractFactory("CryptoDiscoMaster");
        cryptoDiscoMaster = await CryptoDiscoMasterFactory.deploy(
            operationsWallet.address,
            treasuryWallet.address,
            mockAirnodeRrp.target,
            mockPriceFeed.target
        );
    });

    describe("AccRewardPerShare Logic", function () {
        it("should distribute rewards correctly to GOLD tier holders", async function () {
            // 1. Assign users to GOLD tier
            await cryptoDiscoMaster.updateUserTier(user1.address, TIER_GOLD);
            await cryptoDiscoMaster.updateUserTier(user2.address, TIER_GOLD);

            expect(await cryptoDiscoMaster.goldHolders()).to.equal(2);

            // 2. Simulate revenue (100 ETH)
            // 30% goes to SBT Pool = 30 ETH
            const revenue = ethers.parseEther("100");

            await owner.sendTransaction({
                to: cryptoDiscoMaster.target,
                value: revenue
            });

            // Verify Pool Balance
            expect(await cryptoDiscoMaster.totalSBTPoolBalance()).to.equal(ethers.parseEther("30"));

            // 3. Distribute Pool
            // Gold weight = 50, Silver = 30, Bronze = 20. Total = 50 * 2 = 100 weight? 
            // No, weight calculation in contract is: (goldHolders * GOLD_WEIGHT) ...
            // Total Weight = (2 * 50) + (0 * 30) + (0 * 20) = 100
            // Gold Share = (30 ETH * 2 * 50) / 100 = 30 ETH
            // Per Holder = 15 ETH

            await cryptoDiscoMaster.distributeSBTPool();

            // 4. Verify AccRewardPerShare
            // Expected: 15 ETH * 1e18 (scaled by precision)
            const expectedAccReward = ethers.parseEther("15") * REWARD_PRECISION;
            expect(await cryptoDiscoMaster.accRewardPerShare(TIER_GOLD)).to.equal(expectedAccReward);

            // 5. User 1 Claims
            const cleanBalanceBefore = await ethers.provider.getBalance(user1.address);

            const tx = await cryptoDiscoMaster.connect(user1).claimSBTRewards();
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;

            const cleanBalanceAfter = await ethers.provider.getBalance(user1.address);

            // Allow for small gas deviations, but verify roughly 15 ETH gain
            expect(cleanBalanceAfter + gasUsed - cleanBalanceBefore).to.equal(ethers.parseEther("15"));

            // Verify Debt Updated
            expect(await cryptoDiscoMaster.userRewardDebt(user1.address)).to.equal(expectedAccReward);
        });

        it("should handle tier updates correctly (claim pending rewards)", async function () {
            // User starts at GOLD
            await cryptoDiscoMaster.updateUserTier(user1.address, TIER_GOLD);

            // Revenue 100 ETH -> 30 ETH to Pool
            await owner.sendTransaction({ to: cryptoDiscoMaster.target, value: ethers.parseEther("100") });
            await cryptoDiscoMaster.distributeSBTPool();

            // 30 ETH for Gold (1 holder)
            // Expected Reward: 30 ETH

            // Change Tier GOLD -> SILVER
            // Should auto-claim 30 ETH
            const balanceBefore = await ethers.provider.getBalance(user1.address);
            await cryptoDiscoMaster.updateUserTier(user1.address, TIER_SILVER);
            const balanceAfter = await ethers.provider.getBalance(user1.address);

            expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("30"));

            // Verify new tier state
            const userData = await cryptoDiscoMaster.users(user1.address);
            expect(userData.tier).to.equal(TIER_SILVER);

            // Verify Debt Reset (AccReward for Silver is 0)
            expect(await cryptoDiscoMaster.userRewardDebt(user1.address)).to.equal(0);
        });
    });

    describe("Emergency Withdraw", function () {
        it("should only withdraw stuck funds, not user rewards", async function () {
            // 1. Create User Rewards (Locked)
            await cryptoDiscoMaster.updateUserTier(user1.address, TIER_GOLD);
            await owner.sendTransaction({ to: cryptoDiscoMaster.target, value: ethers.parseEther("100") }); // 30 ETH to pool
            await cryptoDiscoMaster.distributeSBTPool(); // 30 ETH locked

            expect(await cryptoDiscoMaster.totalLockedRewards()).to.equal(ethers.parseEther("30"));

            // Contract Balance:
            // 100 ETH sent
            // 40 ETH -> Owner (auto)
            // 20 ETH -> Ops (auto)
            // 30 ETH -> Pool (locked)
            // 10 ETH -> Treasury (kept in contract)
            // Current Balance = 30 + 10 = 40 ETH

            // 2. Send "Stuck" funds (e.g. selfdestruct or accidental transfer not calling receive properly? 
            // Actually receive() handles logic. 
            // Let's say we just want to withdraw the 10 ETH Treasury share via emergencyWithdraw? 
            // Wait, emergencyWithdraw logic:
            // stuckFunds = balance - totalLockedRewards
            // balance = 40, locked = 30 => stuck = 10 (Treasury share)

            // The previous logic allowed withdrawing EVERYTHING.
            // New logic only allows withdrawing NON-LOCKED funds.

            const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

            const tx = await cryptoDiscoMaster.emergencyWithdraw();
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;

            const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

            // Expect 10 ETH withdrawn
            expect(ownerBalanceAfter + gasUsed - ownerBalanceBefore).to.equal(ethers.parseEther("10"));

            // Verify locked rewards still there
            expect(await ethers.provider.getBalance(cryptoDiscoMaster.target)).to.equal(ethers.parseEther("30"));
        });
    });
});
