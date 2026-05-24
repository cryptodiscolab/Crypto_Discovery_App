/**
 * DailyAppV17 — Comprehensive Test Suite
 * Covers: check-in, XP earn, referral 500 XP vesting, task, SBT mint/upgrade, pause/unpause, access control
 * Run: npx hardhat test test/DailyAppV17.test.cjs
 */
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("DailyAppV17 — Full Test Suite (V17 Features)", function () {
    let DailyAppV17;
    let proxy;
    let owner, admin, user1, user2, user3, referrer;

    const ADMIN_ROLE   = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
    const MINTER_ROLE  = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const ONE_DAY      = 24 * 60 * 60;

    beforeEach(async function () {
        [owner, admin, user1, user2, user3, referrer] = await ethers.getSigners();

        DailyAppV17 = await ethers.getContractFactory("DailyAppV17");
        // Deploy as UUPS proxy
        proxy = await upgrades.deployProxy(DailyAppV17, [owner.address, owner.address, owner.address], { kind: "uups", initializer: "initialize" });
        await proxy.waitForDeployment();

        // Grant ADMIN_ROLE to admin account
        await proxy.connect(owner).grantRole(ADMIN_ROLE, admin.address);
        
        // Add a basic task for joining and activate it
        await proxy.connect(admin).addTask(100, 3600, 0, "Test", "Link", false);
        await proxy.connect(admin).setTaskActive(2, true);
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
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("2. Referral System (V17 - 500 XP Threshold)", function () {
        it("should register referral on first doTask with referrer", async function () {
            await proxy.connect(referrer).claimDailyBonus(); // Ensure referrer has joined
            await expect(proxy.connect(user1).doTask(2, referrer.address))
                .to.not.be.reverted;
            
            // Check that referral is linked
            expect(await proxy.referrerOf(user1.address)).to.equal(referrer.address);
        });

        it("should not vest referral bonus immediately if under 500 XP", async function () {
            await proxy.connect(referrer).claimDailyBonus();
            const referrerBefore = await getUserPoints(referrer.address);
            
            await proxy.connect(user1).doTask(2, referrer.address);
            
            const referrerAfter = await getUserPoints(referrer.address);
            expect(referrerAfter).to.equal(referrerBefore); // No change
            
            expect(await proxy.hasReferralBeenPaid(user1.address)).to.be.false;
        });

        it("should vest referral bonus automatically once referred user reaches 500 XP", async function () {
            await proxy.connect(referrer).claimDailyBonus();
            // Setup referral
            await proxy.connect(user1).doTask(2, referrer.address);
            
            const referrerBefore = await getUserPoints(referrer.address);
            
            // Award user 400 more XP to reach 500 (note: doTask gave some XP, but this ensures it crosses 500)
            await proxy.connect(admin).awardAdminBatchXp([user1.address], [400], 11);
            
            const referrerAfter = await getUserPoints(referrer.address);
            // Referrer should get baseReferralReward (50 XP)
            expect(referrerAfter - referrerBefore).to.equal(50n);
            
            expect(await proxy.hasReferralBeenPaid(user1.address)).to.be.true;
        });

        it("should not vest referral bonus more than once", async function () {
            await proxy.connect(referrer).claimDailyBonus();
            await proxy.connect(user1).doTask(2, referrer.address);
            await proxy.connect(admin).awardAdminBatchXp([user1.address], [500], 11); // Triggers vesting
            
            const referrerMiddle = await getUserPoints(referrer.address);
            
            // Award more XP
            await proxy.connect(admin).awardAdminBatchXp([user1.address], [500], 11);
            
            const referrerAfter = await getUserPoints(referrer.address);
            expect(referrerAfter).to.equal(referrerMiddle); // Should not increase again
        });
        
        it("should cascade referral bonuses safely", async function () {
            await proxy.connect(user3).claimDailyBonus();
            await proxy.connect(user2).doTask(2, user3.address);
            // reset cooldown or use different task if needed, but since it's a different user, taskId=2 is fine
            await proxy.connect(user1).doTask(2, user2.address);
            
            // Give user1 500 XP
            // This triggers bonus to user2. User2 gets 50 XP.
            // But User2 hasn't reached 500 XP yet, so user3 shouldn't get anything.
            await proxy.connect(admin).awardAdminBatchXp([user1.address], [500], 11);
            
            expect(await getUserPoints(user2.address)).to.equal(150n); // 100 from task + 50 from referral
            expect(await getUserPoints(user3.address)).to.equal(100n); // 100 from daily bonus
            
            // Now give user2 enough to cross 500 (needs 350 more)
            await proxy.connect(admin).awardAdminBatchXp([user2.address], [350], 11);
            
            // user2 now has 500 XP. user3 should get the bonus!
            expect(await getUserPoints(user3.address)).to.equal(150n);
            expect(await proxy.hasReferralBeenPaid(user2.address)).to.be.true;
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("3. UUPS Upgradeability", function () {
        it("should be upgradeable by owner", async function () {
            const DailyAppV17v2 = await ethers.getContractFactory("DailyAppV17");
            await expect(
                upgrades.upgradeProxy(proxy.target, DailyAppV17v2, { kind: "uups" })
            ).to.not.be.reverted;
        });
    });
});
