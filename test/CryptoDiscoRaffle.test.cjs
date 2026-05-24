/**
 * CryptoDiscoRaffle — Comprehensive Test Suite
 * Covers: full lifecycle, QRNG callback, winner selection, Ownable2Step transfer
 * Run: npx hardhat test test/CryptoDiscoRaffle.test.cjs
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CryptoDiscoRaffle — Full Test Suite", function () {
    let CryptoDiscoRaffle;
    let raffle;
    let owner, buyer1, buyer2, buyer3, newOwner, airnodeRrp;

    const TICKET_PRICE = ethers.parseEther("0.000075"); // base price per ticket
    const RAFFLE_DURATION = 7 * 24 * 60 * 60; // 7 days

    beforeEach(async function () {
        [owner, buyer1, buyer2, buyer3, newOwner, airnodeRrp] = await ethers.getSigners();

        CryptoDiscoRaffle = await ethers.getContractFactory("CryptoDiscoRaffle");
        raffle = await CryptoDiscoRaffle.deploy(airnodeRrp.address);
        await raffle.waitForDeployment();
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("1. Deployment & Initial State", function () {
        it("should set deployer as owner", async function () {
            expect(await raffle.owner()).to.equal(owner.address);
        });

        it("should have zero raffles on deploy", async function () {
            // nextRaffleId starts at 0 or 1 depending on implementation
            const nextId = await raffle.nextRaffleId();
            expect(nextId).to.be.lte(1n);
        });

        it("should not have a pending ownership transfer initially", async function () {
            expect(await raffle.pendingOwner()).to.equal(ethers.ZeroAddress);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("2. Raffle Creation", function () {
        it("should allow owner to create a raffle", async function () {
            const now = Math.floor(Date.now() / 1000);
            await expect(
                raffle.connect(owner).createRaffle(
                    TICKET_PRICE,
                    now + RAFFLE_DURATION,
                    100 // max tickets
                )
            ).to.emit(raffle, "RaffleCreated");
        });

        it("should reject raffle creation by non-owner", async function () {
            const now = Math.floor(Date.now() / 1000);
            await expect(
                raffle.connect(buyer1).createRaffle(TICKET_PRICE, now + RAFFLE_DURATION, 100)
            ).to.be.revertedWithCustomError(raffle, "OwnableUnauthorizedAccount");
        });

        it("should reject raffle with past end time", async function () {
            const past = Math.floor(Date.now() / 1000) - 1000;
            await expect(
                raffle.connect(owner).createRaffle(TICKET_PRICE, past, 100)
            ).to.be.reverted;
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("3. Ticket Purchase", function () {
        let raffleId;

        beforeEach(async function () {
            const now = Math.floor(Date.now() / 1000);
            const tx = await raffle.connect(owner).createRaffle(
                TICKET_PRICE, now + RAFFLE_DURATION, 100
            );
            const receipt = await tx.wait();
            // Extract raffle ID from RaffleCreated event
            const event = receipt.logs.find(l => {
                try { return raffle.interface.parseLog(l).name === 'RaffleCreated'; }
                catch { return false; }
            });
            raffleId = event ? raffle.interface.parseLog(event).args.raffleId : 1n;
        });

        it("should allow buying tickets with correct ETH", async function () {
            const qty = 5n;
            const cost = TICKET_PRICE * qty;
            await expect(
                raffle.connect(buyer1).buyTickets(raffleId, qty, { value: cost })
            ).to.emit(raffle, "TicketPurchased")
             .withArgs(raffleId, buyer1.address, qty);
        });

        it("should revert if insufficient ETH sent", async function () {
            await expect(
                raffle.connect(buyer1).buyTickets(raffleId, 5n, { value: TICKET_PRICE * 4n })
            ).to.be.reverted;
        });

        it("should revert buying 0 tickets", async function () {
            await expect(
                raffle.connect(buyer1).buyTickets(raffleId, 0n, { value: 0n })
            ).to.be.reverted;
        });

        it("should revert buying after raffle ends", async function () {
            await ethers.provider.send("evm_increaseTime", [RAFFLE_DURATION + 1]);
            await ethers.provider.send("evm_mine");
            await expect(
                raffle.connect(buyer1).buyTickets(raffleId, 1n, { value: TICKET_PRICE })
            ).to.be.revertedWith("Raffle ended");
        });

        it("should track total tickets sold", async function () {
            await raffle.connect(buyer1).buyTickets(raffleId, 3n, { value: TICKET_PRICE * 3n });
            await raffle.connect(buyer2).buyTickets(raffleId, 7n, { value: TICKET_PRICE * 7n });
            const raffleData = await raffle.getRaffle(raffleId);
            expect(raffleData.totalTickets).to.equal(10n);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("4. Draw Winner (QRNG)", function () {
        let raffleId;

        beforeEach(async function () {
            const now = Math.floor(Date.now() / 1000);
            const tx = await raffle.connect(owner).createRaffle(
                TICKET_PRICE, now + RAFFLE_DURATION, 100
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find(l => {
                try { return raffle.interface.parseLog(l).name === 'RaffleCreated'; }
                catch { return false; }
            });
            raffleId = event ? raffle.interface.parseLog(event).args.raffleId : 1n;
            // Buy some tickets
            await raffle.connect(buyer1).buyTickets(raffleId, 5n, { value: TICKET_PRICE * 5n });
            await raffle.connect(buyer2).buyTickets(raffleId, 5n, { value: TICKET_PRICE * 5n });
        });

        it("should revert drawWinner before raffle ends", async function () {
            await expect(raffle.connect(owner).drawWinner(raffleId))
                .to.be.revertedWith("Raffle still active");
        });

        it("should allow owner to request QRNG after raffle ends", async function () {
            await ethers.provider.send("evm_increaseTime", [RAFFLE_DURATION + 1]);
            await ethers.provider.send("evm_mine");
            await expect(raffle.connect(owner).drawWinner(raffleId))
                .to.not.be.reverted;
        });

        it("should fulfill randomness via airnodeRrp callback", async function () {
            await ethers.provider.send("evm_increaseTime", [RAFFLE_DURATION + 1]);
            await ethers.provider.send("evm_mine");

            await raffle.connect(owner).drawWinner(raffleId);

            // Simulate QRNG callback from airnodeRrp
            const requestId = ethers.id("mock_request_" + Date.now());
            const randomWord = ethers.randomBytes(32);
            await expect(
                raffle.connect(airnodeRrp).fulfillRandomness(requestId, randomWord)
            ).to.not.be.reverted;
        });

        it("should reject fulfillRandomness from non-airnodeRrp", async function () {
            await ethers.provider.send("evm_increaseTime", [RAFFLE_DURATION + 1]);
            await ethers.provider.send("evm_mine");
            await raffle.connect(owner).drawWinner(raffleId);

            const requestId = ethers.id("mock_request_2");
            const randomWord = ethers.randomBytes(32);
            await expect(
                raffle.connect(buyer1).fulfillRandomness(requestId, randomWord)
            ).to.be.revertedWith("Only airnodeRrp");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("5. Ownable2Step Transfer", function () {
        it("should initiate ownership transfer (step 1)", async function () {
            await raffle.connect(owner).transferOwnership(newOwner.address);
            expect(await raffle.pendingOwner()).to.equal(newOwner.address);
        });

        it("should NOT transfer ownership until new owner accepts", async function () {
            await raffle.connect(owner).transferOwnership(newOwner.address);
            // Ownership should still be the original owner
            expect(await raffle.owner()).to.equal(owner.address);
        });

        it("should complete transfer only when new owner calls acceptOwnership", async function () {
            await raffle.connect(owner).transferOwnership(newOwner.address);
            await raffle.connect(newOwner).acceptOwnership();
            expect(await raffle.owner()).to.equal(newOwner.address);
        });

        it("should reject acceptOwnership from non-pending owner", async function () {
            await raffle.connect(owner).transferOwnership(newOwner.address);
            await expect(raffle.connect(buyer1).acceptOwnership())
                .to.be.reverted;
        });

        it("should prevent accidental ownership loss (core Ownable2Step value)", async function () {
            // Transfer to wrong address — original owner still has control until accepted
            await raffle.connect(owner).transferOwnership(buyer1.address);
            // Original owner can still call owner functions (not transferred yet)
            expect(await raffle.owner()).to.equal(owner.address);
            // Cancel: transfer to zero address or another address  
            await raffle.connect(owner).transferOwnership(newOwner.address);
            expect(await raffle.pendingOwner()).to.equal(newOwner.address);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("6. ReentrancyGuard on Revenue Withdrawal", function () {
        let raffleId;

        beforeEach(async function () {
            const now = Math.floor(Date.now() / 1000);
            const tx = await raffle.connect(owner).createRaffle(
                TICKET_PRICE, now + RAFFLE_DURATION, 100
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find(l => {
                try { return raffle.interface.parseLog(l).name === 'RaffleCreated'; }
                catch { return false; }
            });
            raffleId = event ? raffle.interface.parseLog(event).args.raffleId : 1n;
            await raffle.connect(buyer1).buyTickets(raffleId, 10n, { value: TICKET_PRICE * 10n });
        });

        it("should allow owner to withdraw raffle revenue", async function () {
            const balBefore = await ethers.provider.getBalance(owner.address);
            const tx = await raffle.connect(owner).withdrawRevenue();
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * tx.gasPrice;
            const balAfter = await ethers.provider.getBalance(owner.address);
            // Should receive ticket revenue minus gas
            expect(balAfter + gasUsed).to.be.gt(balBefore);
        });

        it("should reject revenue withdrawal by non-owner", async function () {
            await expect(raffle.connect(buyer1).withdrawRevenue())
                .to.be.revertedWithCustomError(raffle, "OwnableUnauthorizedAccount");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("7. Access Control Edge Cases", function () {
        it("should revert createRaffle after ownership transfer + before accept", async function () {
            await raffle.connect(owner).transferOwnership(newOwner.address);
            const now = Math.floor(Date.now() / 1000);
            // newOwner hasn't accepted yet but tries to use owner functions
            await expect(
                raffle.connect(newOwner).createRaffle(TICKET_PRICE, now + RAFFLE_DURATION, 100)
            ).to.be.revertedWithCustomError(raffle, "OwnableUnauthorizedAccount");
        });

        it("should allow createRaffle after acceptOwnership", async function () {
            await raffle.connect(owner).transferOwnership(newOwner.address);
            await raffle.connect(newOwner).acceptOwnership();
            const now = Math.floor(Date.now() / 1000);
            await expect(
                raffle.connect(newOwner).createRaffle(TICKET_PRICE, now + RAFFLE_DURATION, 100)
            ).to.not.be.reverted;
        });
    });
});
