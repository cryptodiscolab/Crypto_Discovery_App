const { ethers } = require('hardhat');

async function main() {
    const sigs = [
        'PointsAwarded(address,uint256,string)',
        'PointsPending(address,uint256,string)',
        'TaskCompleted(uint256,uint256,string)',
        'TaskCompleted(address,uint256,uint256)',
        'TaskCompleted(address,uint256,uint256,uint256)',
        'RewardClaimed(address,uint256,uint256)'
    ];
    sigs.forEach(s => {
        console.log(`${s}: ${ethers.id(s)}`);
    });
}

main()
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
