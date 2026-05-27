/**
 * CryptoDiscoRaffle — Comprehensive Test Suite
 * Covers: full lifecycle, QRNG callback, winner selection, Ownable2Step transfer
 * Run: npx hardhat test test/CryptoDiscoRaffle.test.cjs
 */
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("CryptoDiscoRaffle — Full Test Suite", function () {
    let masterX, mockPriceFeed, raffle, mockAirnodeRrp;
    let owner, buyer1, buyer2, buyer3, newOwner, airnodeRrp;

    const TICKET_PRICE = ethers.parseEther("0.000075"); // Matches Oracle calculation: $0.15 at $2000/ETH
    const REQUIRED_TICKET_PRICE = (TICKET_PRICE * 110n) / 100n; // 10% surcharge
    const RAFFLE_DURATION = 7; // 7 days in duration param

    beforeEach(async function () {
        [owner, buyer1, buyer2, buyer3, newOwner, airnodeRrp] = await ethers.getSigners();

        // 1. Mock Price Feed
        const MockFeed = await ethers.getContractFactory("MockAggregatorV3");
        mockPriceFeed = await MockFeed.deploy(8, 200000000000); // $2000 per ETH

        // 2. Mock Airnode RRP
        const MockRrpFactory = await ethers.getContractFactory("MockAirnodeRrp");
        mockAirnodeRrp = await MockRrpFactory.deploy();

        // 3. Deploy MasterX
        const MasterXFactory = await ethers.getContractFactory("CryptoDiscoMasterX");
        masterX = await MasterXFactory.deploy(buyer2.address, buyer3.address, mockPriceFeed.target);

        // 4. Deploy Raffle
        const CryptoDiscoRaffleFactory = await ethers.getContractFactory("CryptoDiscoRaffle");
        raffle = await CryptoDiscoRaffleFactory.deploy(masterX.target, mockAirnodeRrp.target);

        // 5. Link MasterX and Raffle
        await masterX.setRaffleContract(raffle.target);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("1. Deployment & Initial State", function () {
        it("should set deployer as owner", async function () {
            expect(await raffle.owner()).to.equal(owner.address);
        });

        it("should have zero currentRaffleId on deploy", async function () {
            const nextId = await raffle.currentRaffleId();
            expect(nextId).to.equal(0n);
        });

        it("should not have a pending ownership transfer initially", async function () {
            expect(await raffle.pendingOwner()).to.equal(ethers.ZeroAddress);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("2. Initialize First Raffle", function () {
        it("should allow owner to initialize first raffle", async function () {
            await expect(raffle.connect(owner).initializeFirstRaffle())
                .to.emit(raffle, "RaffleCreated");
            expect(await raffle.currentRaffleId()).to.equal(1n);
        });

        it("should reject double initialization of first raffle", async function () {
            await raffle.connect(owner).initializeFirstRaffle();
            await expect(raffle.connect(owner).initializeFirstRaffle())
                .to.be.revertedWith("Already initialized");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("3. Raffle Creation", function () {
        it("should allow sponsor to create a community raffle", async function () {
            const deposit = ethers.parseEther("0.1");
            await expect(
                raffle.connect(buyer1).createSponsorshipRaffle(
                    1, // winner count
                    100, // max tickets
                    RAFFLE_DURATION, // duration in days
                    "ipfs://community-raffle",
                    { value: deposit }
                )
            ).to.emit(raffle, "RaffleCreated");
        });

        it("should reject sponsorship raffle with 0 deposit", async function () {
            await expect(
                raffle.connect(buyer1).createSponsorshipRaffle(
                    1, 100, RAFFLE_DURATION, "ipfs://community-raffle", { value: 0 }
                )
            ).to.be.revertedWith("Deposit required");
        });

        it("should allow admin to create a free raffle", async function () {
            await expect(
                raffle.connect(owner).adminCreateRaffle(
                    1, 100, RAFFLE_DURATION, "ipfs://admin-raffle"
                )
            ).to.emit(raffle, "RaffleCreated");
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("4. Ticket Purchase", function () {
        let raffleId = 1n;

        beforeEach(async function () {
            await raffle.connect(owner).initializeFirstRaffle();
        });

        it("should allow buying tickets with correct ETH", async function () {
            const qty = 5n;
            const cost = REQUIRED_TICKET_PRICE * qty;
            await expect(
                raffle.connect(buyer1).buyTickets(raffleId, qty, { value: cost })
            ).to.emit(raffle, "TicketPurchased")
             .withArgs(buyer1.address, raffleId, qty);
        });

        it("should revert if insufficient ETH sent", async function () {
            await expect(
                raffle.connect(buyer1).buyTickets(raffleId, 5n, { value: TICKET_PRICE * 4n })
            ).to.be.revertedWith("Insufficient ETH");
        });

        it("should revert buying 0 tickets", async function () {
            await expect(
                raffle.connect(buyer1).buyTickets(raffleId, 0n, { value: 0n })
            ).to.be.revertedWith("Invalid count");
        });

        it("should track total tickets sold", async function () {
            await raffle.connect(buyer1).buyTickets(raffleId, 3n, { value: REQUIRED_TICKET_PRICE * 3n });
            await raffle.connect(buyer2).buyTickets(raffleId, 7n, { value: REQUIRED_TICKET_PRICE * 7n });
            const raffleData = await raffle.getRaffleInfo(raffleId);
            expect(raffleData.totalTickets).to.equal(10n);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("5. Draw Winner (QRNG)", function () {
        let raffleId = 1n;

        beforeEach(async function () {
            await raffle.connect(owner).initializeFirstRaffle();
            await raffle.connect(buyer1).buyTickets(raffleId, 5n, { value: REQUIRED_TICKET_PRICE * 5n });
            await raffle.connect(buyer2).buyTickets(raffleId, 5n, { value: REQUIRED_TICKET_PRICE * 5n });
            
            // Set QRNG parameters
            await raffle.connect(owner).setQRNGParameters(
                owner.address,
                ethers.ZeroHash,
                buyer3.address
            );
        });

        it("should revert drawWinner before raffle conditions met", async function () {
            await expect(raffle.connect(buyer1).drawWinner(raffleId))
                .to.be.revertedWith("Not authorized or conditions not met");
        });

        it("should allow owner/anyone to request QRNG after time has expired", async function () {
            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine");
            await expect(raffle.connect(owner).drawWinner(raffleId))
                .to.emit(raffle, "QRNGRequested");
        });

        it("should fulfill randomness via airnodeRrp callback and select winner", async function () {
            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine");

            const tx = await raffle.connect(owner).drawWinner(raffleId);
            const receipt = await tx.wait();
            const event = receipt.logs.find(l => {
                try { return raffle.interface.parseLog(l).name === 'QRNGRequested'; }
                catch { return false; }
            });
            const requestId = event ? raffle.interface.parseLog(event).args.requestId : ethers.ZeroHash;

            const randomWord = ethers.toBeHex(12345n, 32);
            
            // Impersonate MockAirnodeRrp contract address to call fulfillRandomness
            const impersonatedSigner = await ethers.getImpersonatedSigner(mockAirnodeRrp.target);
            
            // Set balance directly on impersonated signer instead of sending ETH
            await network.provider.send("hardhat_setBalance", [
                mockAirnodeRrp.target,
                "0x1000000000000000000" // 1 ETH
            ]);

            await expect(
                raffle.connect(impersonatedSigner).fulfillRandomness(requestId, randomWord)
            ).to.emit(raffle, "QRNGFulfilled");
            
            const raffleData = await raffle.getRaffleInfo(raffleId);
            expect(raffleData.isFinalized).to.be.true;
            expect(raffleData.winners.length).to.be.gt(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    describe("6. Ownable2Step Transfer", function () {
        it("should initiate ownership transfer (step 1)", async function () {
            await raffle.connect(owner).transferOwnership(newOwner.address);
            expect(await raffle.pendingOwner()).to.equal(newOwner.address);
        });

        it("should NOT transfer ownership until new owner accepts", async function () {
            await raffle.connect(owner).transferOwnership(newOwner.address);
            expect(await raffle.owner()).to.equal(owner.address);
        });

        it("should complete transfer only when new owner calls acceptOwnership", async function () {
            await raffle.connect(owner).transferOwnership(newOwner.address);
            await raffle.connect(newOwner).acceptOwnership();
            expect(await raffle.owner()).to.equal(newOwner.address);
        });
    });
});
