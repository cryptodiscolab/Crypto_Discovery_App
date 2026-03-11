const { ethers } = require('hardhat');

async function main() {
    const addresses = [
        '0xf074b0457d5c092bb67e62734B13C5f4cBC69e89',
        '0x5d7338Cd98029a73283F959fe24935a5099771b7',
        '0x87a3d1203Bf20E7dF5659A819ED79a67b236F571'
    ];
    for (const addr of addresses) {
        try {
            console.log('Checking ' + addr);
            const latest = await ethers.provider.getBlockNumber();
            for (let i = 0; i < 500000; i += 10000) {
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
        } catch (e) {
            console.error(e.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
