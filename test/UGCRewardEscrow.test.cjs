const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("UGCRewardEscrow — Claim Authorization Safety", function () {
    let escrow;
    let owner, authorizer, claimant;

    const NATIVE_TOKEN = ethers.ZeroAddress;
    const CLAIM_TYPE = {
        ClaimAuthorization: [
            { name: "campaignId", type: "bytes32" },
            { name: "claimant", type: "address" },
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "deadline", type: "uint256" },
            { name: "nonce", type: "uint256" },
        ],
    };

    beforeEach(async function () {
        [owner, authorizer, claimant] = await ethers.getSigners();

        const Escrow = await ethers.getContractFactory("UGCRewardEscrow");
        escrow = await Escrow.deploy(owner.address, authorizer.address);
        await escrow.waitForDeployment();
    });

    async function signClaim({ campaignId, claimantAddress, token, amount, deadline, nonce }) {
        const domain = {
            name: "DiscoDailyUGCRewardEscrow",
            version: "1",
            chainId: network.config.chainId,
            verifyingContract: await escrow.getAddress(),
        };
        return authorizer.signTypedData(domain, CLAIM_TYPE, {
            campaignId,
            claimant: claimantAddress,
            token,
            amount,
            deadline,
            nonce,
        });
    }

    async function futureDeadline(offsetSeconds = 3600n) {
        const block = await ethers.provider.getBlock("latest");
        return BigInt(block.timestamp) + offsetSeconds;
    }

    it("rejects replaying the same claim signature after a successful native claim", async function () {
        const campaignId = ethers.id("campaign:replay");
        const amount = ethers.parseEther("0.01");
        const nonce = 1n;
        const deadline = await futureDeadline();
        const signature = await signClaim({
            campaignId,
            claimantAddress: claimant.address,
            token: NATIVE_TOKEN,
            amount,
            deadline,
            nonce,
        });

        await escrow.connect(owner).depositNative(campaignId, { value: amount * 2n });

        await expect(
            escrow.connect(claimant).claim(campaignId, NATIVE_TOKEN, amount, deadline, nonce, signature)
        ).to.emit(escrow, "RewardClaimed")
            .withArgs(campaignId, claimant.address, NATIVE_TOKEN, amount, deadline, nonce);

        await expect(
            escrow.connect(claimant).claim(campaignId, NATIVE_TOKEN, amount, deadline, nonce, signature)
        ).to.be.revertedWithCustomError(escrow, "AlreadyClaimed");
    });

    it("rejects reusing a consumed claimant nonce on another campaign", async function () {
        const firstCampaignId = ethers.id("campaign:first");
        const secondCampaignId = ethers.id("campaign:second");
        const amount = ethers.parseEther("0.01");
        const nonce = 7n;
        const deadline = await futureDeadline();
        const firstSignature = await signClaim({
            campaignId: firstCampaignId,
            claimantAddress: claimant.address,
            token: NATIVE_TOKEN,
            amount,
            deadline,
            nonce,
        });
        const secondSignature = await signClaim({
            campaignId: secondCampaignId,
            claimantAddress: claimant.address,
            token: NATIVE_TOKEN,
            amount,
            deadline,
            nonce,
        });

        await escrow.connect(owner).depositNative(firstCampaignId, { value: amount });
        await escrow.connect(owner).depositNative(secondCampaignId, { value: amount });
        await escrow.connect(claimant).claim(firstCampaignId, NATIVE_TOKEN, amount, deadline, nonce, firstSignature);

        await expect(
            escrow.connect(claimant).claim(secondCampaignId, NATIVE_TOKEN, amount, deadline, nonce, secondSignature)
        ).to.be.revertedWithCustomError(escrow, "NonceUsed");
    });

    it("rejects expired claim authorization before funds can move", async function () {
        const campaignId = ethers.id("campaign:expired");
        const amount = ethers.parseEther("0.01");
        const nonce = 2n;
        const block = await ethers.provider.getBlock("latest");
        const expiredDeadline = BigInt(block.timestamp) - 1n;
        const signature = await signClaim({
            campaignId,
            claimantAddress: claimant.address,
            token: NATIVE_TOKEN,
            amount,
            deadline: expiredDeadline,
            nonce,
        });

        await escrow.connect(owner).depositNative(campaignId, { value: amount });

        await expect(
            escrow.connect(claimant).claim(campaignId, NATIVE_TOKEN, amount, expiredDeadline, nonce, signature)
        ).to.be.revertedWithCustomError(escrow, "InvalidDeadline");

        expect(await escrow.escrowBalance(campaignId, NATIVE_TOKEN)).to.equal(amount);
    });

    it("rejects claim authorization deadlines beyond the 3x24h window", async function () {
        const campaignId = ethers.id("campaign:overlong");
        const amount = ethers.parseEther("0.01");
        const nonce = 3n;
        const overlongDeadline = await futureDeadline(3n * 24n * 60n * 60n + 60n);
        const signature = await signClaim({
            campaignId,
            claimantAddress: claimant.address,
            token: NATIVE_TOKEN,
            amount,
            deadline: overlongDeadline,
            nonce,
        });

        await escrow.connect(owner).depositNative(campaignId, { value: amount });

        await expect(
            escrow.connect(claimant).claim(campaignId, NATIVE_TOKEN, amount, overlongDeadline, nonce, signature)
        ).to.be.revertedWithCustomError(escrow, "InvalidDeadline");

        expect(await escrow.escrowBalance(campaignId, NATIVE_TOKEN)).to.equal(amount);
    });
});
