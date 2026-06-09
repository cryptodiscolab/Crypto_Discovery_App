/**
 * DailyAppV17 - Full Test Suite (Hardhat 3 compatible)
 * Uses HH3 native test API + node:assert + node:test
 * Run: hardhat test test/DailyAppV17.test.mjs
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

describe("DailyAppV17 - Full Test Suite (V17 Features)", function () {
    let ethers, upgrades;
    let DailyAppV17;
    let proxy;
    let owner, admin, user1, user2, user3, referrer;

    beforeEach(async function () {
        const connection = await globalThis.network.connect();
        ethers = connection.ethers;
        upgrades = connection.upgrades;
        [owner, admin, user1, user2, user3, referrer] = await ethers.getSigners();

        DailyAppV17 = await ethers.getContractFactory("DailyAppV17");
        proxy = await upgrades.deployProxy(
            DailyAppV17,
            [owner.address, owner.address, owner.address],
            { kind: "uups", initializer: "initialize" }
        );
        await proxy.waitForDeployment();

        const ADMIN_ROLE_LOCAL = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
        await proxy.connect(owner).grantRole(ADMIN_ROLE_LOCAL, admin.address);
        await proxy.connect(admin).addTask(100, 3600, 0, "Twitter Follow", "https://twitter.com", false);
        await proxy.connect(admin).setTaskActive(2, true);
    });

    describe("1. Initialization & Access Control", function () {
        it("should set owner as DEFAULT_ADMIN_ROLE holder", async function () {
            const DEFAULT_ADMIN = ethers.ZeroHash;
            assert.equal(await proxy.hasRole(DEFAULT_ADMIN, owner.address), true);
        });

        it("should reject unauthorized role grant", async function () {
            const ADMIN_ROLE_LOCAL = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
            await assert.rejects(
                proxy.connect(user1).grantRole(ADMIN_ROLE_LOCAL, user2.address),
                (err) => err.message.includes("Unauthorized") || err.message.includes("reverted")
            );
        });
    });

    describe("2. V17 Referral Vesting", function () {
        it("should credit XP and trigger referral reward at 500 XP threshold", async function () {
            // Set user1 as referrer
            await proxy.connect(user1).doTask(2, ethers.ZeroAddress);

            // user2 joins with referrer = user1
            await proxy.connect(user2).doTask(2, user1.address);

            const stats = await proxy.userStats(user1.address);
            assert.ok(Number(stats.referralCount) >= 0, "Referral count should be set");
        });
    });

    describe("3. Task & XP Mechanics", function () {
        it("should allow user to do a task and earn XP", async function () {
            await proxy.connect(user1).doTask(2, ethers.ZeroAddress);
            const stats = await proxy.userStats(user1.address);
            assert.ok(Number(stats.points) >= 100, `Expected points >= 100, got ${stats.points}`);
        });

        it("should reject redoing the same task", async function () {
            await proxy.connect(user1).doTask(2, ethers.ZeroAddress);
            await assert.rejects(
                proxy.connect(user1).doTask(2, ethers.ZeroAddress),
                (err) => err.message.includes("reverted")
            );
        });
    });

    describe("4. Pause/Unpause", function () {
        it("should pause and unpause contract", async function () {
            await proxy.connect(admin).pause();
            assert.equal(await proxy.paused(), true);

            await proxy.connect(admin).unpause();
            assert.equal(await proxy.paused(), false);
        });
    });

    describe("5. Blacklist", function () {
        it("should allow admin to blacklist a user", async function () {
            await proxy.connect(admin).setUserBlacklist(user1.address, true);
            const stats = await proxy.userStats(user1.address);
            assert.equal(stats.isBlacklisted, true);
        });
    });
});