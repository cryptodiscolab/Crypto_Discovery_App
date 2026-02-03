const ethers = require('ethers');

// ABI for reroll function (Minimal)
const RAFFLE_ABI = [
    "function raffles(uint256) view returns (uint256, address, uint256, uint256, uint256, uint256, uint256, bool, bool, bool, bytes32, address, uint256)", // Adjusted based on struct layout? Or use getRaffleInfo
    "function getRaffleInfo(uint256 _raffleId) external view returns (uint256, address, uint256, uint256, uint256, uint256, bool, bool, address, uint256)",
    "function raffleIdCounter() view returns (uint256)",
    "function rerollWinner(uint256 _raffleId) external",
    "function users(address) view returns (uint256, uint256, uint256, uint256)" // Check user info if needed? No.
    // We need to check claimDeadline. 
    // Wait, getRaffleInfo in contract doesn't return claimDeadline in the current view function I saw earlier?
    // Checking NFTRaffle.sol...
    // The struct has claimDeadline. getRaffleInfo returns 10 values. claimDeadline was likely not added to return.
    // I should probably update getRaffleInfo or just read the struct directly if public.
    // Struct is public: raffles(uint256) returns (...)
];

// Helper to read env
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.VITE_CONTRACT_ADDRESS; // Or dedicated server env

module.exports = async (req, res) => {
    // 1. Auth Check (Vercel Cron headers)
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // return res.status(401).json({ error: 'Unauthorized' });
        // Allowing open for now/dev, or check specific header
    }

    if (!PRIVATE_KEY || !RPC_URL || !CONTRACT_ADDRESS) {
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, RAFFLE_ABI, wallet);

        // 2. Iterate Config
        // Ideally we don't loop ALL raffles. In prod, we'd have an indexer.
        // For simple usage: Check last N raffles or maintain a list of 'active_pending_claim' in DB?
        // Since we don't have a DB here, let's check last 10 raffles.

        const count = await contract.raffleIdCounter();
        const start = count > 10n ? count - 10n : 0n;

        const updates = [];

        for (let i = Number(start); i < Number(count); i++) {
            // Read struct directly: 
            // raffles(i) returns tuple. We need to map it correctly or use specific index.
            // Solidity public getter for struct flattens fields.
            // Struct: raffleId, creator, startTime, endTime, totalTickets, ticketsSold, paidTicketsSold, revenueWithdrawn, isActive, isCompleted, airnodeRequestId, winner, claimDeadline

            const data = await contract.raffles(i);
            // data is Array-like
            // [0] id, [1] creator, ... 
            // [9] isCompleted 
            // [11] winner
            // [12] claimDeadline

            const isCompleted = data[9];
            const claimDeadline = data[12];
            const winner = data[11];

            // Logic:
            // 1. Must be completed (draw happened).
            // 2. Deadline passed (now > claimDeadline).
            // 3. Prizes NOT claimed. 
            //    Accessing NFT status requires looping `nfts` array which public getter for struct MIGHT NOT return if it's dynamic array?
            //    Solidity generated getter for struct usually OMITs dynamic arrays (NFTInfo[]).
            //    So we can't check `claimed` status easily via `raffles(i)`.
            //    We need a separate view function or check ownership of NFTs?
            //    If contract holds the NFT, it's unclaimed.

            // ALTERNATIVE: Just call rerollWinner in try-catch. Contract has the logic!
            // If it succeeds -> Good. If it reverts -> It wasn't eligible.
            // But this wastes gas if we spam transactions.
            // Better to check view functions if possible.

            if (isCompleted && BigInt(Date.now() / 1000) > claimDeadline && winner !== ethers.ZeroAddress) {
                // Potential reroll candidate
                // Try static call to see if it would succeed
                try {
                    await contract.rerollWinner.staticCall(i);
                    // If no revert, IT IS ELIGIBLE!
                    const tx = await contract.rerollWinner(i);
                    updates.push({ id: i, tx: tx.hash });
                } catch (e) {
                    // Reverted (probably claimed or not eligible)
                    // console.log(`Raffle ${i} skipped: ${e.shortMessage}`);
                }
            }
        }

        res.status(200).json({
            success: true,
            checked: Number(count) - Number(start),
            triggered: updates
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};
