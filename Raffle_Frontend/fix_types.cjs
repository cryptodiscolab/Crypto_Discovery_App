const fs = require('fs');
const path = 'src/types/database.types.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\\"/g, '"');
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed database.types.ts');
