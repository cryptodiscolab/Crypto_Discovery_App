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
    const MINTER_ROLE  = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const ONE_DAY      = 24 * 60 * 60;

    beforeEach(async function () {
        [owner, admin, user1, user2, user3, referrer] = await ethers.getSigners();

        DailyAppV16 = await ethers.getContractFactory("DailyAppV16");
        // Deploy as UUPS proxy
        proxy = await upgrades.deployProxy(DailyAppV16, [], { kind: "uups", initializer: "initialize" });
        await proxy.waitForDeployment();

        // Grant ADMIN_ROLE to admin account
        await proxy.connect(owner).grantRole(ADMIN_ROLE, admin.address);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("1. Initialization & Access Control", function () {
        it("should set owner as DEFAULT_ADMIN_ROLE holder", async function () {
            const DEFAULT_ADMIN = ethers.ZeroHash;
            expect(await proxy.hasRole(DEFAULT_ADMIN, owner.address)).to.be.true;
        });

        it("should reject unauthorized role grant", async function () {
            await expect(
                proxy.connect(user1).grantRole(ADMIN_ROLE, user2.address)
            ).to.be.reverted;
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
                proxy.connect(user1).checkIn()
            ).to.be.revertedWith("Paused");
        });

        it("should allow ADMIN_ROLE to unpause", async function () {
            await proxy.connect(admin).pause();
            await proxy.connect(admin).unpause();
            expect(await proxy.paused()).to.be.false;
        });

        it("should revert pause by non-admin", async function () {
            await expect(proxy.connect(user1).pause()).to.be.reverted;
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("3. Daily Check-In & XP", function () {
        it("should allow first check-in and emit event", async function () {
            await expect(proxy.connect(user1).checkIn())
                .to.emit(proxy, "CheckIn")
                .withArgs(user1.address);
        });

        it("should prevent double check-in within 24h", async function () {
            await proxy.connect(user1).checkIn();
            await expect(proxy.connect(user1).checkIn())
                .to.be.revertedWith("Already checked in today");
        });

        it("should allow check-in again after 24h", async function () {
            await proxy.connect(user1).checkIn();
            await ethers.provider.send("evm_increaseTime", [ONE_DAY + 1]);
            await ethers.provider.send("evm_mine");
            await expect(proxy.connect(user1).checkIn()).to.not.be.reverted;
        });

        it("should credit daily bonus XP on check-in", async function () {
            const before = await proxy.getUserPoints(user1.address);
            await proxy.connect(user1).checkIn();
            const after = await proxy.getUserPoints(user1.address);
            expect(after).to.be.gt(before);
        });

        it("should increase streak on consecutive days", async function () {
            await proxy.connect(user1).checkIn();
            await ethers.provider.send("evm_increaseTime", [ONE_DAY + 1]);
            await ethers.provider.send("evm_mine");
            await proxy.connect(user1).checkIn();
            const streak = await proxy.getUserStreak(user1.address);
            expect(streak).to.equal(2);
        });

        it("should reset streak if missed a day", async function () {
            await proxy.connect(user1).checkIn();
            // Skip 2 days
            await ethers.provider.send("evm_increaseTime", [2 * ONE_DAY + 1]);
            await ethers.provider.send("evm_mine");
            await proxy.connect(user1).checkIn();
            const streak = await proxy.getUserStreak(user1.address);
            expect(streak).to.equal(1);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("4. Task Completion & XP", function () {
        it("should allow admin to create a task", async function () {
            await expect(
                proxy.connect(admin).createTask("twitter_follow", 100, true)
            ).to.not.be.reverted;
        });

        it("should allow user to complete a task once", async function () {
            await proxy.connect(admin).createTask("twitter_follow", 100, true);
            const taskId = 2; // nextTaskId starts at 2
            await expect(proxy.connect(user1).doTask(taskId))
                .to.emit(proxy, "TaskCompleted");
        });

        it("should prevent completing the same task twice", async function () {
            await proxy.connect(admin).createTask("twitter_follow", 100, true);
            const taskId = 2;
            await proxy.connect(user1).doTask(taskId);
            await expect(proxy.connect(user1).doTask(taskId))
                .to.be.revertedWith("Already completed");
        });

        it("should revert task completion when paused", async function () {
            await proxy.connect(admin).createTask("twitter_follow", 100, true);
            await proxy.connect(admin).pause();
            await expect(proxy.connect(user1).doTask(2)).to.be.revertedWith("Paused");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("5. Referral System", function () {
        it("should register referral on first check-in with referrer", async function () {
            await expect(proxy.connect(user1).checkInWithReferral(referrer.address))
                .to.not.be.reverted;
        });

        it("should not allow self-referral", async function () {
            await expect(proxy.connect(user1).checkInWithReferral(user1.address))
                .to.be.revertedWith("Cannot refer yourself");
        });

        it("should not allow re-referral", async function () {
            await proxy.connect(user1).checkInWithReferral(referrer.address);
            await ethers.provider.send("evm_increaseTime", [ONE_DAY + 1]);
            await ethers.provider.send("evm_mine");
            await expect(proxy.connect(user1).checkInWithReferral(user2.address))
                .to.be.revertedWith("Already referred");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("6. SBT Mint & Upgrade", function () {
        it("should allow admin to set SBT tier thresholds", async function () {
            await expect(
                proxy.connect(admin).setSBTThreshold(1, 500)
            ).to.not.be.reverted;
        });

        it("should revert SBT mint if user has insufficient XP", async function () {
            await proxy.connect(admin).setSBTThreshold(1, 500);
            await expect(proxy.connect(user1).mintNFT(1))
                .to.be.revertedWith("Insufficient XP");
        });

        it("should mint SBT when user meets threshold", async function () {
            await proxy.connect(admin).setSBTThreshold(1, 0); // Threshold 0 for testing
            await expect(proxy.connect(user1).mintNFT(1))
                .to.emit(proxy, "NFTMinted");
        });

        it("should prevent double SBT mint at same tier", async function () {
            await proxy.connect(admin).setSBTThreshold(1, 0);
            await proxy.connect(user1).mintNFT(1);
            await expect(proxy.connect(user1).mintNFT(1))
                .to.be.revertedWith("Already minted");
        });

        it("should revert mintNFT when paused", async function () {
            await proxy.connect(admin).setSBTThreshold(1, 0);
            await proxy.connect(admin).pause();
            await expect(proxy.connect(user1).mintNFT(1)).to.be.revertedWith("Paused");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("7. Admin XP Batch Award", function () {
        it("should allow ADMIN_ROLE to batch award XP", async function () {
            const xpBefore = await proxy.getUserPoints(user1.address);
            await proxy.connect(admin).awardAdminBatchXp([user1.address], [500]);
            const xpAfter = await proxy.getUserPoints(user1.address);
            expect(xpAfter - xpBefore).to.equal(500n);
        });

        it("should reject batch XP award by non-admin", async function () {
            await expect(
                proxy.connect(user1).awardAdminBatchXp([user2.address], [500])
            ).to.be.reverted;
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("8. withdrawTreasury — Reentrancy Guard", function () {
        it("should allow admin to withdraw ETH", async function () {
            await owner.sendTransaction({ to: proxy.target, value: ethers.parseEther("1") });
            const before = await ethers.provider.getBalance(admin.address);
            const tx = await proxy.connect(admin).withdrawTreasury(admin.address, ethers.parseEther("1"));
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * tx.gasPrice;
            const after = await ethers.provider.getBalance(admin.address);
            expect(after + gasUsed - before).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.001"));
        });

        it("should revert treasury withdrawal by non-admin", async function () {
            await owner.sendTransaction({ to: proxy.target, value: ethers.parseEther("1") });
            await expect(
                proxy.connect(user1).withdrawTreasury(user1.address, ethers.parseEther("1"))
            ).to.be.reverted;
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("9. UUPS Upgradeability", function () {
        it("should be upgradeable by owner", async function () {
            // Try upgrading to same implementation (should succeed with no changes)
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

        it("should preserve XP balances after upgrade", async function () {
            await proxy.connect(user1).checkIn();
            const xpBefore = await proxy.getUserPoints(user1.address);
            expect(xpBefore).to.be.gt(0n);

            const DailyAppV16v2 = await ethers.getContractFactory("DailyAppV16");
            const upgraded = await upgrades.upgradeProxy(proxy.target, DailyAppV16v2, { kind: "uups" });

            const xpAfter = await upgraded.getUserPoints(user1.address);
            expect(xpAfter).to.equal(xpBefore);
        });
    });
});
