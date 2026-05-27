/**
 * DailyAppV16 — Comprehensive Test Suite
 * Covers: check-in, XP earn, referral, task, SBT mint/upgrade, pause/unpause, access control
 * Run: npx hardhat test test/DailyAppV16.test.cjs
 */
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("DailyAppV16 — Full Test Suite", function () {
    let DailyAppV16;
    let proxy;
    let owner, admin, user1, user2, user3, referrer;

    const ADMIN_ROLE   = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
    const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
    const ONE_DAY      = 24 * 60 * 60;

    beforeEach(async function () {
        [owner, admin, user1, user2, user3, referrer] = await ethers.getSigners();

        DailyAppV16 = await ethers.getContractFactory("DailyAppV16");
        // Deploy as UUPS proxy (passing creatorToken, usdcToken, initialOwner)
        proxy = await upgrades.deployProxy(DailyAppV16, [owner.address, owner.address, owner.address], { kind: "uups", initializer: "initialize" });
        await proxy.waitForDeployment();

        // Grant ADMIN_ROLE to admin account
        await proxy.connect(owner).grantRole(ADMIN_ROLE, admin.address);

        // Add a basic task
        await proxy.connect(admin).addTask(100, 3600, 0, "Twitter Follow", "https://twitter.com", false);
        await proxy.connect(admin).setTaskActive(2, true); // Tasks start at ID 2
    });

    async function getUserPoints(userAddress) {
        const stats = await proxy.userStats(userAddress);
        return stats.points;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    describe("1. Initialization & Access Control", function () {
        it("should set owner as DEFAULT_ADMIN_ROLE holder", async function () {
            const DEFAULT_ADMIN = ethers.ZeroHash;
            expect(await proxy.hasRole(DEFAULT_ADMIN, owner.address)).to.be.true;
        });

        it("should reject unauthorized role grant", async function () {
            await expect(
                proxy.connect(user1).grantRole(ADMIN_ROLE, user2.address)
            ).to.be.revertedWithCustomError(proxy, "Unauthorized");
        });

        it("should not be paused on deploy", async function () {
            expect(await proxy.paused()).to.be.false;
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("2. Pause / Unpause (Emergency Stop)", function () {
        it("should allow ADMIN_ROLE to pause", async function () {
            await proxy.connect(admin).pause();
            expect(await proxy.paused()).to.be.true;
        });

        it("should revert check-in when paused", async function () {
            await proxy.connect(admin).pause();
            await expect(
                proxy.connect(user1).claimDailyBonus()
            ).to.be.revertedWithCustomError(proxy, "Unauthorized");
        });

        it("should allow ADMIN_ROLE to unpause", async function () {
            await proxy.connect(admin).pause();
            await proxy.connect(admin).unpause();
            expect(await proxy.paused()).to.be.false;
        });

        it("should revert pause by non-admin", async function () {
            await expect(proxy.connect(user1).pause()).to.be.revertedWithCustomError(proxy, "Unauthorized");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("3. Daily Check-In & XP", function () {
        it("should allow first check-in and emit event", async function () {
            await expect(proxy.connect(user1).claimDailyBonus())
                .to.emit(proxy, "TaskCompleted")
                .withArgs(user1.address, 0, 100, any => true);
        });

        it("should prevent double check-in within 24h", async function () {
            await proxy.connect(user1).claimDailyBonus();
            await expect(proxy.connect(user1).claimDailyBonus())
                .to.be.revertedWithCustomError(proxy, "Unauthorized");
        });

        it("should allow check-in again after 24h", async function () {
            await proxy.connect(user1).claimDailyBonus();
            await ethers.provider.send("evm_increaseTime", [ONE_DAY + 1]);
            await ethers.provider.send("evm_mine");
            await expect(proxy.connect(user1).claimDailyBonus()).to.not.be.reverted;
        });

        it("should credit daily bonus XP on check-in", async function () {
            const before = await getUserPoints(user1.address);
            await proxy.connect(user1).claimDailyBonus();
            const after = await getUserPoints(user1.address);
            expect(after - before).to.equal(100n);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("4. Task Completion & XP", function () {
        it("should allow admin to create a task", async function () {
            await expect(
                proxy.connect(admin).addTask(150, 3600, 0, "Twitter Post", "https://twitter.com", false)
            ).to.emit(proxy, "TaskAdded");
        });

        it("should allow user to complete a task once", async function () {
            const taskId = 2; // basic task created in beforeEach
            await expect(proxy.connect(user1).doTask(taskId, ethers.ZeroAddress))
                .to.emit(proxy, "TaskCompleted");
        });

        it("should prevent completing the same task twice if not repeatable", async function () {
            const taskId = 2;
            await proxy.connect(user1).doTask(taskId, ethers.ZeroAddress);
            await expect(proxy.connect(user1).doTask(taskId, ethers.ZeroAddress))
                .to.be.revertedWithCustomError(proxy, "Unauthorized");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("5. Referral System", function () {
        it("should register referral on first doTask with referrer", async function () {
            const taskId = 2;
            // Referrer must join first
            await proxy.connect(referrer).claimDailyBonus();
            // Complete first task with referrer
            await proxy.connect(user1).doTask(taskId, referrer.address);
            expect(await proxy.referrerOf(user1.address)).to.equal(referrer.address);
        });

        it("should award referral bonus after 3 completed tasks", async function () {
            // Setup additional tasks
            await proxy.connect(admin).addTask(100, 3600, 0, "Task 2", "Link", false);
            await proxy.connect(admin).setTaskActive(3, true);
            await proxy.connect(admin).addTask(100, 3600, 0, "Task 3", "Link", false);
            await proxy.connect(admin).setTaskActive(4, true);

            // Referrer must join first
            await proxy.connect(referrer).claimDailyBonus();
            const referrerBefore = await getUserPoints(referrer.address);

            // User completes 3 tasks
            await proxy.connect(user1).doTask(2, referrer.address);
            await proxy.connect(user1).doTask(3, referrer.address);
            await proxy.connect(user1).doTask(4, referrer.address);

            const referrerAfter = await getUserPoints(referrer.address);
            expect(referrerAfter - referrerBefore).to.equal(50n); // baseReferralReward = 50 XP
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("6. SBT Mint & Upgrade", function () {
        beforeEach(async function () {
            // Setup NFT Config for BRONZE (Tier 1)
            // config parameters: pointsRequired, mintPrice, dailyBonus, multiplierBP, maxSupply, isOpen
            await proxy.connect(admin).updateNFTConfig(1, 200, 0, 11000, 10, 1000, true);
        });

        it("should revert SBT mint if user has insufficient XP", async function () {
            await expect(proxy.connect(user1).mintNFT(1))
                .to.be.revertedWithCustomError(proxy, "Unauthorized");
        });

        it("should mint SBT when user meets threshold", async function () {
            // Award user 300 XP
            await proxy.connect(admin).awardAdminBatchXp([user1.address], [300], 11); // XpSource.ADMIN_AWARD
            await expect(proxy.connect(user1).mintNFT(1))
                .to.emit(proxy, "NFTMinted");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("7. Admin XP Batch Award", function () {
        it("should allow ADMIN_ROLE to batch award XP", async function () {
            const xpBefore = await getUserPoints(user1.address);
            await proxy.connect(admin).awardAdminBatchXp([user1.address], [500], 11);
            const xpAfter = await getUserPoints(user1.address);
            expect(xpAfter - xpBefore).to.equal(500n);
        });

        it("should reject batch XP award by non-admin", async function () {
            await expect(
                proxy.connect(user1).awardAdminBatchXp([user2.address], [500], 11)
            ).to.be.revertedWithCustomError(proxy, "Unauthorized");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("8. UUPS Upgradeability", function () {
        it("should be upgradeable by owner", async function () {
            const DailyAppV16v2 = await ethers.getContractFactory("DailyAppV16");
            await expect(
                upgrades.upgradeProxy(proxy.target, DailyAppV16v2, { kind: "uups" })
            ).to.not.be.reverted;
        });

        it("should reject upgrade by non-owner", async function () {
            const DailyAppV16v2 = await ethers.getContractFactory("DailyAppV16", user1);
            await expect(
                upgrades.upgradeProxy(proxy.target, DailyAppV16v2, { kind: "uups" })
            ).to.be.reverted;
        });
    });
});
