const fs = require('fs');
try {
  const content = fs.readFileSync('e:/Disco Gacha/Disco_DailyApp/Raffle_Frontend/src/lib/abis_data.txt', 'utf8');
  JSON.parse(content);
  console.log('JSON is valid');
} catch (e) {
  console.error('JSON is invalid:', e.message);
  process.exit(1);
}
