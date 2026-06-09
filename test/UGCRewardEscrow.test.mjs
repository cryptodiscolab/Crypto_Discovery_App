/**
 * UGCRewardEscrow - Claim Authorization Safety (Hardhat 3 compatible)
 * Uses HH3 native test API + node:assert + node:test
 * Run: hardhat test test/UGCRewardEscrow.test.mjs
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

describe("UGCRewardEscrow - Claim Authorization Safety", function () {
    let ethers;
    let escrow;
    let owner, authorizer, claimant;

    beforeEach(async function () {
        const connection = await globalThis.network.connect();
        ethers = connection.ethers;
        [owner, authorizer, claimant] = await ethers.getSigners();

        const Factory = await ethers.getContractFactory("UGCRewardEscrow");
        escrow = await Factory.deploy();
        await escrow.waitForDeployment();
    });

    describe("Deployment", function () {
        it("should deploy successfully", async function () {
            assert.ok(escrow.target, "Escrow should have an address");
        });
    });

    describe("Authorization", function () {
        it("should allow owner to set authorizer", async function () {
            await escrow.setAuthorizer(authorizer.address);
            assert.equal(
                await escrow.authorizer(),
                authorizer.address,
                "Authorizer should be set"
            );
        });
    });
});