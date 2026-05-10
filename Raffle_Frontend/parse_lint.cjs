const fs = require('fs');

const content = fs.readFileSync('lint_results.txt', 'utf16le');
const lines = content.split('\n');

let currentFile = '';
const errors = [];

lines.forEach((line, index) => {
    if (line.startsWith('E:\\')) {
        currentFile = line.trim();
    }
    if (line.includes('error')) {
        errors.push({
            file: currentFile,
            line: line.trim(),
            context: lines.slice(Math.max(0, index - 5), index + 5).join('\n')
        });
    }
});

console.log(JSON.stringify(errors, null, 2));
