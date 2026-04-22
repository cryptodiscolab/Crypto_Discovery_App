const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const DESIGN_FILE = path.join(__dirname, '../../DESIGN.md');

function lint() {
    console.log('🎨 Starting Design Protocol Audit...');

    if (!fs.existsSync(DESIGN_FILE)) {
        console.error('❌ Error: DESIGN.md not found in root directory.');
        process.exit(1);
    }

    const content = fs.readFileSync(DESIGN_FILE, 'utf8');
    const parts = content.split('---');

    if (parts.length < 3) {
        console.error('❌ Error: DESIGN.md must contain YAML frontmatter.');
        process.exit(1);
    }

    const frontmatterRaw = parts[1];
    const body = parts.slice(2).join('---');

    try {
        const config = yaml.load(frontmatterRaw);
        validateFrontmatter(config);
        validateBody(body, config);
        console.log('✅ DESIGN.md is VALID and SYNCHRONIZED.');
    } catch (e) {
        console.error(`❌ YAML Parsing Error: ${e.message}`);
        process.exit(1);
    }
}

function validateFrontmatter(config) {
    const requiredFields = ['version', 'name', 'colors', 'typography', 'components'];
    requiredFields.forEach(field => {
        if (!config[field]) {
            console.warn(`⚠️  Warning: Missing recommended field '${field}' in frontmatter.`);
        }
    });

    if (config.colors) {
        if (!config.colors.background || !config.colors.brand) {
            console.warn('⚠️  Warning: Incomplete color specification (missing background or brand).');
        }
    }
}

function validateBody(body, config) {
    const requiredSections = ['# Design Specification', '## Overview', '## Core Principles', '## Component Guidelines'];
    requiredSections.forEach(section => {
        if (!body.includes(section)) {
            console.warn(`⚠️  Warning: Missing section '${section}' in Markdown body.`);
        }
    });

    // Simple broken reference check (e.g. {colors.primary})
    const refRegex = /\{([a-zA-Z0-9.]+)\}/g;
    let match;
    while ((match = refRegex.exec(body)) !== null) {
        const path = match[1].split('.');
        let current = config;
        let broken = false;
        for (const segment of path) {
            if (current && current[segment] !== undefined) {
                current = current[segment];
            } else {
                broken = true;
                break;
            }
        }
        if (broken) {
            console.warn(`⚠️  Warning: Broken token reference found: {${match[1]}}`);
        }
    }
}

lint();
