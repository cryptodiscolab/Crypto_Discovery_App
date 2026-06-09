/**
 * DailyAppV16 — Comprehensive Test Suite (Hardhat 3 compatible)
 * Uses HH3 native test API: `network.connect()` instead of `import { ethers }`
 * Uses Node.js built-in `node:assert` instead of chai-matchers (HH3 incompatible)
 * Run: hardhat test test/DailyAppV16.test.mjs
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

describe("DailyAppV16 — Full Test Suite", function () {
    let ethers, upgrades, connection;
    let DailyAppV16;
    let proxy;
    let owner, admin, user1, user2, user3, referrer;

    beforeEach(async function () {
        // HH3 native API: get connection with ethers + upgrades
        connection = await globalThis.network.connect();
        ethers = connection.ethers;
        upgrades = connection.upgrades;

        [owner, admin, user1, user2, user3, referrer] = await ethers.getSigners();

        DailyAppV16 = await ethers.getContractFactory("DailyAppV16");
        // Deploy as UUPS proxy
        proxy = await upgrades.deployProxy(
            DailyAppV16,
            [owner.address, owner.address, owner.address],
            { kind: "uups", initializer: "initialize" }
        );
        await proxy.waitForDeployment();

        const ADMIN_ROLE_LOCAL    = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
        const VERIFIER_ROLE_LOCAL = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));

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

        it("should allow admin to grant role", async function () {
            const VERIFIER_ROLE_LOCAL = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
            await proxy.connect(admin).grantRole(VERIFIER_ROLE_LOCAL, user1.address);
            assert.equal(await proxy.hasRole(VERIFIER_ROLE_LOCAL, user1.address), true);
        });

        it("should allow admin to revoke role", async function () {
            const VERIFIER_ROLE_LOCAL = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
            await proxy.connect(admin).grantRole(VERIFIER_ROLE_LOCAL, user1.address);
            await proxy.connect(admin).revokeRole(VERIFIER_ROLE_LOCAL, user1.address);
            assert.equal(await proxy.hasRole(VERIFIER_ROLE_LOCAL, user1.address), false);
        });
    });

    describe("2. Task & XP Mechanics", function () {
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

        it("should reject non-existent task", async function () {
            await assert.rejects(
                proxy.connect(user1).doTask(999, ethers.ZeroAddress),
                (err) => err.message.includes("reverted")
            );
        });
    });

    describe("3. Daily Bonus", function () {
        it("should claim daily bonus once per 24h", async function () {
            await proxy.connect(user1).claimDailyBonus();
            const stats = await proxy.userStats(user1.address);
            assert.ok(Number(stats.points) >= 100, `Expected points >= 100, got ${stats.points}`);

            await assert.rejects(
                proxy.connect(user1).claimDailyBonus(),
                (err) => err.message.includes("reverted")
            );
        });
    });

    describe("4. NFT Mint/Upgrade", function () {
        it("should reject NFT mint without enough points", async function () {
            await assert.rejects(
                proxy.connect(user1).mintNFT(1, { value: ethers.parseEther("0.01") }),
                (err) => err.message.includes("reverted")
            );
        });
    });

    describe("5. Pause/Unpause", function () {
        it("should pause and unpause contract", async function () {
            await proxy.connect(admin).pause();
            assert.equal(await proxy.paused(), true);

            await proxy.connect(admin).unpause();
            assert.equal(await proxy.paused(), false);
        });

        it("should reject non-admin pause", async function () {
            await assert.rejects(
                proxy.connect(user1).pause(),
                (err) => err.message.includes("reverted")
            );
        });
    });

    describe("6. Blacklist", function () {
        it("should allow admin to blacklist a user", async function () {
            await proxy.connect(admin).setUserBlacklist(user1.address, true);
            const stats = await proxy.userStats(user1.address);
            assert.equal(stats.isBlacklisted, true);
        });
    });
});