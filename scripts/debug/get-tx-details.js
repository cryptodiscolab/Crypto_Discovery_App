const { ethers } = require('hardhat');

async function main() {
    const addr = '0x5d7338Cd98029a73283F959fe24935a5099771b7';
    const latest = await ethers.provider.getBlockNumber();
    // Search a narrow range where we found logs
    const fromBlock = 37422652;
    const toBlock = 37432652;

    const logs = await ethers.provider.getLogs({
        address: addr,
        fromBlock,
        toBlock,
        topics: ['0x146b4b2e55f6b6a4a8ac8239494150cd5f96b163e2d019440f369714f4a31eb8']
    });

    if (logs.length > 0) {
        console.log(`Found ${logs.length} matching logs.`);
        const log = logs[0];
        console.log('TX Hash:', log.transactionHash);
        console.log('Topics:', log.topics);
        console.log('Data:', log.data);

        const tx = await ethers.provider.getTransactionReceipt(log.transactionHash);
        console.log('Full Receipt Logs:', JSON.stringify(tx.logs, null, 2));
    } else {
        console.log('No logs found in this range with that topic.');
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
