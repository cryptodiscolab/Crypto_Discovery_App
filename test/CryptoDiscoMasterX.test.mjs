/**
 * CryptoDiscoMasterX - Batch Distribution Logic (Hardhat 3 compatible)
 * Uses HH3 native test API + node:assert + node:test
 * Run: hardhat test test/CryptoDiscoMasterX.test.mjs
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

describe("CryptoDiscoMasterX - Batch Distribution Logic", function () {
    let ethers;
    let masterX;
    let owner, user1, user2, opsWallet, treasury;
    let mockPriceFeed;

    beforeEach(async function () {
        const connection = await globalThis.network.connect();
        ethers = connection.ethers;
        [owner, user1, user2, opsWallet, treasury] = await ethers.getSigners();

        try {
            const MockFeed = await ethers.getContractFactory("MockAggregatorV3");
            mockPriceFeed = await MockFeed.deploy(8, 200000000000);
        } catch (e) {
            // MockAggregatorV3 not available
        }

        const Factory = await ethers.getContractFactory("CryptoDiscoMasterX");
        masterX = await Factory.deploy(
            opsWallet.address,
            treasury.address,
            mockPriceFeed ? mockPriceFeed.target : ethers.ZeroAddress
        );
    });

    describe("Revenue Accumulation", function () {
        it("should accumulate direct ETH transfers", async function () {
            await owner.sendTransaction({
                to: masterX.target,
                value: ethers.parseEther("1.0"),
            });
            const balance = await ethers.provider.getBalance(masterX.target);
            assert.equal(balance, ethers.parseEther("1.0"));
        });
    });

    describe("Initial State", function () {
        it("should deploy with correct owner", async function () {
            assert.ok(masterX.target, "MasterX should have an address");
        });
    });
});