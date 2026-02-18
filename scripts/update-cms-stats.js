const { ethers } = require('hardhat');

async function main() {
    const CMS_ADDR = '0x555d06933cc45038c42a1ba1f74140a5e4e0695d';
    const cmsABI = [
        "function getFeatureCards() external view returns (string)",
        "function updateFeatureCards(string jsonContent) external"
    ];

    const [deployer] = await ethers.getSigners();
    console.log(`Using account: ${deployer.address}`);

    const cms = new ethers.Contract(CMS_ADDR, cmsABI, deployer);

    console.log("Fetching existing feature cards...");
    const rawCards = await cms.getFeatureCards();
    let cards = [];
    try {
        cards = JSON.parse(rawCards);
    } catch (e) {
        console.error("Failed to parse cards, starting fresh.");
        cards = [];
    }

    console.log(`Original cards count: ${cards.length}`);

    // Temukan kartu 'Community Stats' atau buat yang baru jika tidak ada
    let statsCard = cards.find(c => c.title === 'Community Stats' || c.id === 'transparency-stats');

    if (statsCard) {
        console.log("Updating existing Community Stats card...");
        statsCard.id = 'transparency-stats';
        statsCard.description = 'Monitor live rewards collected in our community pool. 30% of all platform revenue is distributed to soulbound holders.';
        statsCard.color = 'blue';
        statsCard.visible = true;
    } else {
        console.log("Creating new Community Stats card...");
        statsCard = {
            id: 'transparency-stats',
            title: 'Community Stats',
            description: 'Monitor live rewards collected in our community pool. 30% of all platform revenue is distributed to soulbound holders.',
            icon: 'TrendingUp',
            link: '/rewards',
            linkText: 'View Transparency',
            color: 'blue',
            visible: true
        };
        cards.push(statsCard);
    }

    const jsonContent = JSON.stringify(cards);
    console.log("Pushing updated cards to CMS contract...");
    const tx = await cms.updateFeatureCards(jsonContent);
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log("CMS Update Successful!");
}

main()
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
