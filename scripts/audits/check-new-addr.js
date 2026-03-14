const { ethers } = require('hardhat');

async function main() {
    const addr = '0x9BdE662649A9C080E96086f70Ed2e5BDa091E653';
    const latest = await ethers.provider.getBlockNumber();
    for (let i = 0; i < 100000; i += 10000) {
        const logs = await ethers.provider.getLogs({
            address: addr,
            fromBlock: latest - i - 10000,
            toBlock: latest - i
        });
        if (logs.length > 0) {
            console.log(`Found ${logs.length} logs for ${addr} at blocks ${latest - i - 10000} - ${latest - i}`);
            logs.forEach(l => console.log(`  Topic: ${l.topics[0]}`));
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
