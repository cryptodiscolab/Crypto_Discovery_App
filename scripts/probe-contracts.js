const { ethers } = require('hardhat');

async function main() {
    const addresses = [
        { name: 'MasterX (Root)', addr: '0xf074b0457d5c092bb67e62734b13c5f4cbc69e89' },
        { name: 'MasterX (Frontend)', addr: '0xd7f6d4589a04f51d22b3a5965860eb40fb219c78' },
        { name: 'CMS (Root)', addr: '0xf55280bba6f34c68b1459afd70b8798a07a8a613' },
        { name: 'CMS (Frontend)', addr: '0x555d06933cc45038c42a1ba1f74140a5e4e0695d' }
    ];

    const provider = ethers.provider;

    for (const item of addresses) {
        const code = await provider.getCode(item.addr);
        if (code === '0x') {
            console.log(`❌ ${item.name} at ${item.addr} has NO CODE`);
        } else {
            console.log(`✅ ${item.name} at ${item.addr} has code (${code.length} bytes)`);

            // Try calling a generic view if it's MasterX
            if (item.name.includes('MasterX')) {
                try {
                    const master = new ethers.Contract(item.addr, ["function totalSBTPoolBalance() view returns (uint256)"], provider);
                    const bal = await master.totalSBTPoolBalance();
                    console.log(`   totalSBTPoolBalance: ${ethers.formatEther(bal)} ETH`);
                } catch (e) {
                    console.log(`   totalSBTPoolBalance call FAILED`);
                }
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
