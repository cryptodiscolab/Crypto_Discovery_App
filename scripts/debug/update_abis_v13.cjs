const fs = require('fs');
const path = require('path');

const abiPath = 'e:/Disco Gacha/Disco_DailyApp/artifacts/contracts/DailyAppV13.sol/DailyAppV13.json';
const abisDataPath = 'e:/Disco Gacha/Disco_DailyApp/Raffle_Frontend/src/lib/abis_data.txt';

const v13Artifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
const abisData = JSON.parse(fs.readFileSync(abisDataPath, 'utf8'));

abisData.ABIS.DAILY_APP = v13Artifact.abi;
abisData.DAILY_APP_ADDRESS_SEPOLIA = '0x369aBcD44d3D510f4a20788BBa6F47C99e57d267';

fs.writeFileSync(abisDataPath, JSON.stringify(abisData, null, 4), 'utf8');
console.log('✅ abis_data.txt updated with V13.1 ABI');
