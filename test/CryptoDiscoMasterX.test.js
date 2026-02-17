const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CryptoDiscoMasterX - Batch Distribution Logic", function () {
    let CryptoDiscoMasterX, masterX;
    let owner, user1, user2, opsWallet, treasury;
    let mockPriceFeed;

    const REWARD_PRECISION = BigInt(1e18);
    const TIER_GOLD = 3;
    const TIER_SILVER = 2;
    const TIER_BRONZE = 1;
    const FIVE_DAYS = 5 * 24 * 60 * 60;

    beforeEach(async function () {
        [owner, user1, user2, opsWallet, treasury] = await ethers.getSigners();

        // Mock Price Feed
        const MockFeed = await ethers.getContractFactory("MockAggregatorV3");
        mockPriceFeed = await MockFeed.deploy(8, 200000000000); // $2000

        // Deploy MasterX
        const Factory = await ethers.getContractFactory("CryptoDiscoMasterX");
        masterX = await Factory.deploy(opsWallet.address, treasury.address, mockPriceFeed.target);
    });

    describe("Revenue Accumulation", function () {
        it("should accumulate direct ETH transfers", async function () {
            await owner.sendTransaction({ to: masterX.target, value: ethers.parseEther("1.0") });
            expect(await ethers.provider.getBalance(masterX.target)).to.equal(ethers.parseEther("1.0"));
        });

        it("should accumulate raffle ticket revenue (including 5% fee) without distributing", async function () {
            const ticketPrice = await masterX.getTicketPriceInETH(); // 0.000075 ETH
            const quantity = 10n;
            const totalWithFee = (ticketPrice * quantity * 105n) / 100n;

            const opsBefore = await ethers.provider.getBalance(opsWallet.address);
            await masterX.connect(user1).buyRaffleTickets(Number(quantity), { value: totalWithFee });

            const opsAfter = await ethers.provider.getBalance(opsWallet.address);
            expect(opsAfter).to.equal(opsBefore); // Still no immediate distribution
            expect(await ethers.provider.getBalance(masterX.target)).to.equal(totalWithFee);
        });
    });

    describe("distributeRevenue() Cooldown & Access", function () {
        it("should revert if called by non-owner before 5 days", async function () {
            await owner.sendTransaction({ to: masterX.target, value: ethers.parseEther("1.0") });
            await expect(masterX.connect(user1).distributeRevenue())
                .to.be.revertedWith("Cooldown active");
        });

        it("should allow anyone to call after 5 days", async function () {
            await owner.sendTransaction({ to: masterX.target, value: ethers.parseEther("1.0") });

            // Advance time
            await ethers.provider.send("evm_increaseTime", [FIVE_DAYS + 1]);
            await ethers.provider.send("evm_mine");

            await expect(masterX.connect(user1).distributeRevenue()).to.emit(masterX, "RevenueDistributed");
        });

        it("should allow owner to bypass cooldown", async function () {
            await owner.sendTransaction({ to: masterX.target, value: ethers.parseEther("1.0") });
            // No time advance
            await expect(masterX.connect(owner).distributeRevenue()).to.emit(masterX, "RevenueDistributed");
        });

        it("should revert if balance is zero", async function () {
            await expect(masterX.distributeRevenue()).to.be.revertedWith("No revenue to distribute");
        });
    });

    describe("Revenue Splitting Math", function () {
        it("should split revenue 40/20/30/10 correctly", async function () {
            const revenue = ethers.parseEther("10.0");
            await owner.sendTransaction({ to: masterX.target, value: revenue });

            // Setup tiers so SBT 30% goes to rewards
            await masterX.updateUserTier(user1.address, TIER_GOLD);

            const ownerBefore = await ethers.provider.getBalance(owner.address);
            const opsBefore = await ethers.provider.getBalance(opsWallet.address);
            const treasuryBefore = await ethers.provider.getBalance(treasury.address);

            // Advance time so user1 can call
            await ethers.provider.send("evm_increaseTime", [FIVE_DAYS + 1]);
            await ethers.provider.send("evm_mine");

            await masterX.connect(user1).distributeRevenue();

            // 40% Owner = 4 ETH
            // SBT Split = 3 ETH. GOLD (user1) gets 50% = 1.5 ETH.
            // Silver (30%) and Bronze (20%) are empty -> Owner Overflow = 1.5 ETH.
            // Total expected for Owner: 4 + 1.5 = 5.5 ETH.

            const ownerAfter = await ethers.provider.getBalance(owner.address);
            expect(ownerAfter - ownerBefore).to.equal(ethers.parseEther("5.5"));

            // 20% Ops = 2 ETH
            const opsAfter = await ethers.provider.getBalance(opsWallet.address);
            expect(opsAfter - opsBefore).to.equal(ethers.parseEther("2.0"));

            // 10% Treasury = 1 ETH
            const treasuryAfter = await ethers.provider.getBalance(treasury.address);
            expect(treasuryAfter - treasuryBefore).to.equal(ethers.parseEther("1.0"));

            // SBT Pool check
            expect(await masterX.totalLockedRewards()).to.equal(ethers.parseEther("1.5"));
        });
    });

    describe("SBT Pool Integration", function () {
        it("should update accRewardPerShare during revenue distribution", async function () {
            await masterX.updateUserTier(user1.address, TIER_GOLD);
            await owner.sendTransaction({ to: masterX.target, value: ethers.parseEther("10") });

            await masterX.distributeRevenue(); // 3 ETH split to SBT, 1.5 ETH to GOLD

            expect(await masterX.accRewardPerShare(TIER_GOLD)).to.equal(ethers.parseEther("1.5") * REWARD_PRECISION);
        });
    });
});
