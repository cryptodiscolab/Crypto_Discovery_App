const { ethers } = require('hardhat');

async function main() {
    const MASTER_X_ADDR = '0xd7f6d4589a04f51d22b3a5965860eb40fb219c78';
    const masterABI = [
        "event RevenueReceived(uint256 amount, uint256 timestamp)",
        "event RevenueDistributed(uint256 totalAmount, uint256 timestamp)"
    ];

    const provider = ethers.provider;
    const master = new ethers.Contract(MASTER_X_ADDR, masterABI, provider);

    console.log(`Fetching events for ${MASTER_X_ADDR}...`);
    const latestBlock = await provider.getBlockNumber();
    const startBlock = 21000000; // Deployment block around Feb 2025
    const CHUNK_SIZE = 50000;

    let totalRevenue = 0n;
    let foundEvents = 0;

    for (let i = startBlock; i <= latestBlock; i += CHUNK_SIZE) {
        const toBlock = Math.min(i + CHUNK_SIZE - 1, latestBlock);
        console.log(`Fetching RevenueReceived: blocks ${i} to ${toBlock}...`);
        const events = await master.queryFilter(master.filters.RevenueReceived(), i, toBlock);
        foundEvents += events.length;
        events.forEach(e => {
            totalRevenue += e.args.amount;
        });
    }

    console.log(`Found ${foundEvents} RevenueReceived events.`);

    console.log(`Total Revenue Collected: ${ethers.formatEther(totalRevenue)} ETH`);

    const distFilter = master.filters.RevenueDistributed();
    const distEvents = await master.queryFilter(distFilter, 0, 'latest');
    let totalDistributed = 0n;
    console.log(`Found ${distEvents.length} RevenueDistributed events.`);
    distEvents.forEach(e => {
        totalDistributed += e.args.totalAmount;
    });
    console.log(`Total Revenue Distributed: ${ethers.formatEther(totalDistributed)} ETH`);
}

main()
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
