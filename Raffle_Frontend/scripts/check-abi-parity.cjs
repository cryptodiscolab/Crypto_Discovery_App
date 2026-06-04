#!/usr/bin/env node
/**
 * ABI Reference Parity Check
 *
 * Scans all `functionName: '...'` references in src/ and verifies each
 * function name appears in src/lib/abis_data.txt.
 *
 * NOTE: This is a string-level check only. For final production sign-off,
 * a runtime ABI parity test against deployed contracts is still recommended
 * (e.g. via `eth_call` to each function selector).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const ABI_FILE = path.join(ROOT, 'src', 'lib', 'abis_data.txt');

// Functions allowed to be referenced without being in the master ABI
// (typically from local ABIs like ERC20, Chainlink, etc.)
const KNOWN_LOCAL_ABIS = new Set([
    'transfer', 'approve', 'balanceOf', 'allowance', 'totalSupply',
    'name', 'symbol', 'decimals', 'transferFrom',
    'latestRoundData', 'latestAnswer', 'description',
    'getCallsStatus', // EIP-5792
    'claim' // UGCRewardEscrow local ABI
]);

function walk(dir, files = []) {
    if (!fs.existsSync(dir)) return files;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, files);
        else if (/\.(t|j)sx?$/.test(entry.name)) files.push(full);
    }
    return files;
}

function extractFunctionNames(content) {
    const names = new Set();
    // Match: functionName: 'foo' or functionName: "foo"
    const regex = /functionName\s*:\s*['"]([a-zA-Z_$][a-zA-Z0-9_$]*)['"]/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
        names.add(m[1]);
    }
    return [...names];
}

function main() {
    console.log('🔍 Scanning frontend for `functionName: ...` references…');
    if (!fs.existsSync(ABI_FILE)) {
        console.error(`❌ ABI file not found: ${ABI_FILE}`);
        process.exit(1);
    }

    const abiContent = fs.readFileSync(ABI_FILE, 'utf8');
    const files = walk(SRC_DIR);
    const usagesByName = new Map(); // name -> [file paths]

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        for (const name of extractFunctionNames(content)) {
            if (!usagesByName.has(name)) usagesByName.set(name, []);
            usagesByName.get(name).push(path.relative(ROOT, file));
        }
    }

    console.log(`📋 Unique function names referenced: ${usagesByName.size}`);

    const missing = [];
    const ok = [];
    for (const [name, sources] of [...usagesByName.entries()].sort()) {
        if (KNOWN_LOCAL_ABIS.has(name)) {
            ok.push({ name, status: 'local-abi-allowlist', sources });
            continue;
        }
        // Check if `"name": "<funcname>"` exists in ABI file
        const pattern = new RegExp(`"name"\\s*:\\s*"${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);
        if (pattern.test(abiContent)) {
            ok.push({ name, status: 'in-master-abi', sources });
        } else {
            missing.push({ name, sources });
        }
    }

    console.log(`✅ ${ok.length} resolved`);
    if (missing.length === 0) {
        console.log('\n🎉 All function references are accounted for in master ABI or local allowlist.');
        process.exit(0);
    }

    console.warn(`\n⚠️  ${missing.length} function name(s) not found in master ABI:`);
    for (const m of missing) {
        console.warn(`\n  ${m.name}`);
        for (const src of m.sources.slice(0, 3)) {
            console.warn(`    used in ${src}`);
        }
        if (m.sources.length > 3) console.warn(`    … +${m.sources.length - 3} more`);
    }
    console.warn('\n💡 Add to KNOWN_LOCAL_ABIS in this script if these are from local/inline ABIs (ERC20, Chainlink, etc).');
    console.warn('   Or update src/lib/abis_data.txt if these belong to the master proxy ABI.');
    // Exit 0 so this doesn't block builds; treat as advisory.
    process.exit(0);
}

main();
