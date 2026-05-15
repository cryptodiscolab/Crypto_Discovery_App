#!/usr/bin/env node
/**
 * Live ABI Selector Parity Check
 *
 * Scans frontend `functionName: '...'` references, maps them to the canonical
 * ABI bundle, then verifies that the corresponding 4-byte selectors exist in
 * deployed runtime bytecode. This catches ABI/source drift that a string-level
 * ABI scan cannot prove.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..');
const SRC_DIR = path.join(ROOT, 'src');
const ABI_FILE = path.join(ROOT, 'src', 'lib', 'abis_data.txt');

const KNOWN_LOCAL_ABIS = new Set([
    'transfer', 'approve', 'balanceOf', 'allowance', 'totalSupply',
    'name', 'symbol', 'decimals', 'transferFrom',
    'latestRoundData', 'latestAnswer', 'description',
    'getCallsStatus'
]);

const CONTRACT_ENV = {
    base: {
        chainId: 8453,
        rpcKeys: ['VITE_BASE_MAINNET_RPC_URL', 'BASE_MAINNET_RPC_URL', 'VITE_BASE_RPC_URL', 'VITE_RPC_URL'],
        defaultRpc: 'https://mainnet.base.org',
        contracts: {
            MASTER_X: ['VITE_MASTER_X_ADDRESS'],
            DAILY_APP: ['VITE_DAILY_APP_ADDRESS', 'VITE_V12_CONTRACT_ADDRESS'],
            RAFFLE: ['VITE_RAFFLE_ADDRESS'],
            CMS: ['VITE_CMS_CONTRACT_ADDRESS'],
        },
    },
    'base-sepolia': {
        chainId: 84532,
        rpcKeys: ['VITE_BASE_SEPOLIA_RPC_URL', 'BASE_SEPOLIA_RPC_URL', 'VITE_RPC_URL'],
        defaultRpc: 'https://sepolia.base.org',
        contracts: {
            MASTER_X: ['VITE_MASTER_X_ADDRESS_SEPOLIA'],
            DAILY_APP: ['VITE_DAILY_APP_ADDRESS_SEPOLIA', 'VITE_V12_CONTRACT_ADDRESS_SEPOLIA', 'DAILY_APP_ADDRESS'],
            RAFFLE: ['VITE_RAFFLE_ADDRESS_SEPOLIA'],
            CMS: ['VITE_CMS_CONTRACT_ADDRESS_SEPOLIA'],
        },
    },
};

const EIP1967_IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc'
    + '3735a920a3ca505d382bbc';

function loadEnvFile(file) {
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, 'utf8');
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const eq = trimmed.indexOf('=');
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
    }
}

function loadEnv() {
    [
        path.join(REPO_ROOT, '.env'),
        path.join(REPO_ROOT, '.env.local'),
        path.join(ROOT, '.env'),
        path.join(ROOT, '.env.local'),
    ].forEach(loadEnvFile);
}

function walk(dir, files = []) {
    if (!fs.existsSync(dir)) return files;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, files);
        else if (/\.(t|j)sx?$/.test(entry.name)) files.push(full);
    }
    return files;
}

function stripComments(content) {
    return content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function extractFunctionNames(content) {
    const names = new Set();
    const regex = /functionName\s*:\s*['"]([a-zA-Z_$][a-zA-Z0-9_$]*)['"]/g;
    let match;
    const stripped = stripComments(content);
    while ((match = regex.exec(stripped)) !== null) names.add(match[1]);
    return [...names];
}

function cleanAddress(value) {
    if (!value || typeof value !== 'string') return '';
    const cleaned = value.replace(/["'\s\r\n\t\0]/g, '').trim();
    if (!cleaned || cleaned === '[RESERVED]' || cleaned === 'undefined' || cleaned === 'null') return '';
    return /^0x[a-fA-F0-9]{40}$/.test(cleaned) ? cleaned : '';
}

function firstEnv(keys, fallback = '') {
    for (const key of keys) {
        const value = process.env[key];
        if (value) return value;
    }
    return fallback;
}

function resolveAddress(contractName, chainConfig) {
    return cleanAddress(firstEnv(chainConfig.contracts[contractName] || []));
}

function getChainArg() {
    const args = process.argv.slice(2);
    const chainFlag = args.find((arg) => arg.startsWith('--chain='));
    const chain = chainFlag ? chainFlag.split('=')[1] : args[args.indexOf('--chain') + 1];
    return chain || 'base-sepolia';
}

function referencedFunctions() {
    const usagesByName = new Map();
    for (const file of walk(SRC_DIR)) {
        const content = fs.readFileSync(file, 'utf8');
        for (const name of extractFunctionNames(content)) {
            if (!usagesByName.has(name)) usagesByName.set(name, []);
            usagesByName.get(name).push(path.relative(ROOT, file));
        }
    }
    return usagesByName;
}

function toImplementationAddress(slotValue) {
    if (!slotValue || slotValue === '0x') return '';
    const normalized = slotValue.toLowerCase().replace(/^0x/, '').padStart(64, '0');
    const addr = `0x${normalized.slice(-40)}`;
    return /^0x0{40}$/.test(addr) ? '' : addr;
}

async function callWithFallback(clients, method, args) {
    let lastError;
    for (const client of clients) {
        try {
            return await client[method](args);
        } catch (error) {
            lastError = error;
        }
    }
    const message = lastError?.shortMessage || lastError?.details || lastError?.message || String(lastError);
    throw new Error(message.replace(/https?:\/\/[^\s")]+/g, '[redacted-rpc-url]'));
}

async function main() {
    loadEnv();
    const { createPublicClient, http, toFunctionSelector } = await import('viem');
    const { base, baseSepolia } = await import('viem/chains');

    const chainName = getChainArg();
    const chainConfig = CONTRACT_ENV[chainName];
    if (!chainConfig) {
        console.error(`❌ Unknown chain "${chainName}". Use one of: ${Object.keys(CONTRACT_ENV).join(', ')}`);
        process.exit(1);
    }

    if (!fs.existsSync(ABI_FILE)) {
        console.error(`❌ ABI file not found: ${ABI_FILE}`);
        process.exit(1);
    }

    const abiData = JSON.parse(fs.readFileSync(ABI_FILE, 'utf8'));
    const usagesByName = referencedFunctions();
    const referenced = new Set([...usagesByName.keys()].filter((name) => !KNOWN_LOCAL_ABIS.has(name)));
    const rpcUrl = firstEnv(chainConfig.rpcKeys, chainConfig.defaultRpc);
    const chain = chainConfig.chainId === 8453 ? base : baseSepolia;
    const clients = [
        createPublicClient({ chain, transport: http(rpcUrl) }),
        ...(rpcUrl === chainConfig.defaultRpc ? [] : [createPublicClient({ chain, transport: http(chainConfig.defaultRpc) })]),
    ];

    console.log(`🔍 Live ABI selector parity: ${chainName} (${chainConfig.chainId})`);
    console.log(`📋 Referenced master ABI function names: ${referenced.size}`);

    const failures = [];
    const checked = [];
    const missingAddress = [];

    for (const [contractName, abi] of Object.entries(abiData.ABIS || {})) {
        if (!chainConfig.contracts[contractName]) continue;
        const entries = (abi || []).filter((item) => item.type === 'function' && referenced.has(item.name));
        if (entries.length === 0) continue;

        const address = resolveAddress(contractName, chainConfig);
        if (!address) {
            missingAddress.push({ contractName, count: entries.length });
            continue;
        }

        const bytecode = await callWithFallback(clients, 'getBytecode', { address });
        if (!bytecode || bytecode === '0x') {
            failures.push({ contractName, address, selector: '*', name: 'bytecode', reason: 'no deployed code' });
            continue;
        }

        let implementationCode = '';
        let implementationAddress = '';
        const slot = await callWithFallback(clients, 'getStorageAt', { address, slot: EIP1967_IMPL_SLOT }).catch(() => undefined);
        implementationAddress = toImplementationAddress(slot);
        if (implementationAddress) {
            implementationCode = await callWithFallback(clients, 'getBytecode', { address: implementationAddress }).catch(() => '') || '';
        }

        const runtime = bytecode.toLowerCase();
        const implementationRuntime = implementationCode.toLowerCase();
        for (const item of entries) {
            const selector = toFunctionSelector(item).toLowerCase();
            const needle = selector.slice(2);
            const foundInRuntime = runtime.includes(needle);
            const foundInImplementation = implementationRuntime.includes(needle);
            const source = foundInRuntime ? 'runtime' : foundInImplementation ? 'implementation' : '';
            checked.push({ contractName, address, name: item.name, selector, source });
            if (!source) {
                failures.push({ contractName, address, selector, name: item.name, reason: 'selector not found in runtime bytecode' });
            }
        }
    }

    for (const item of checked) {
        const status = item.source ? '✅' : '❌';
        console.log(`  ${status} ${item.contractName.padEnd(9)} ${item.selector} ${item.name} (${item.source || 'missing'})`);
    }

    if (missingAddress.length > 0) {
        console.log('\n⚠️  Missing contract address env:');
        for (const item of missingAddress) {
            console.log(`  - ${item.contractName}: ${item.count} referenced selector(s) skipped`);
        }
    }

    if (failures.length > 0) {
        console.error(`\n❌ ${failures.length} live selector check(s) failed:`);
        for (const failure of failures) {
            console.error(`  - ${failure.contractName} ${failure.selector} ${failure.name}: ${failure.reason}`);
        }
        process.exit(1);
    }

    if (missingAddress.length > 0) {
        console.error('\n❌ Live selector parity incomplete because one or more contract addresses are missing.');
        process.exit(1);
    }

    console.log(`\n🎉 Live selector parity passed for ${checked.length} selector(s).`);
}

main().catch((error) => {
    console.error(`❌ Live ABI selector check failed: ${error?.message || error}`);
    process.exit(1);
});
