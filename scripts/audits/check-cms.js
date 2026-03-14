const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
    const MASTER_X_ADDR = '0xd7f6d4589a04f51d22b3a5965860eb40fb219c78';
    const CMS_ADDR = '0x8D5ef43A69DDc9f9d4bCc6dF3DcCcDBEDa53A302';

    const masterABI = [
        "function totalSBTPoolBalance() view returns (uint256)",
        "function totalLockedRewards() view returns (uint256)"
    ];

    const cmsABI = [
        "function getAnnouncement() view returns (string)",
        "function getFeatureCards() view returns (string)"
    ];

    const provider = ethers.provider;
    const master = new ethers.Contract(MASTER_X_ADDR, masterABI, provider);
    const cms = new ethers.Contract(CMS_ADDR, cmsABI, provider);

    const balance = await provider.getBalance(MASTER_X_ADDR);
    const totalSBT = await master.totalSBTPoolBalance();
    const ann = await cms.getAnnouncement();
    const cards = await cms.getFeatureCards();

    console.log(`--- MasterX (${MASTER_X_ADDR}) ---`);
    console.log(`Contract Balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`Total SBT Pool (30% share): ${ethers.formatEther(totalSBT)} ETH`);

    console.log(`\n--- CMS Announcement ---`);
    console.log(ann);

    console.log(`\n--- CMS Feature Cards ---`);
    try {
        const parsedCards = JSON.parse(cards);
        console.log('\n--- Raw Feature Cards ---');
        console.log(JSON.stringify(parsedCards, null, 2));
    } catch (e) {
        console.log(cards);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
