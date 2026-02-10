/**
 * ESLint Local Plugin Loader
 * 
 * Loads custom ESLint rules from ./eslint-rules directory
 */
const path = require('path');
const fs = require('fs');

const rulesDir = path.join(__dirname, 'eslint-rules');
const rules = {};

// Load all rules from eslint-rules directory
if (fs.existsSync(rulesDir)) {
    fs.readdirSync(rulesDir).forEach(file => {
        if (file.endsWith('.js')) {
            const ruleName = file.replace('.js', '');
            rules[ruleName] = require(path.join(rulesDir, file));
        }
    });
}

module.exports = {
    rules,
};
