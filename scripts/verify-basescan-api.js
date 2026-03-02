/**
 * verify-basescan-api.js
 * =====================
 * Submit contract source code for verification to BaseScan via API
 * Uses the Standard JSON Input from Hardhat build-info artifacts.
 *
 * Usage:
 *   node scripts/verify-basescan-api.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY;
// Etherscan API v2 with chainid=84532 (Base Sepolia) in query string
const BASESCAN_API_URL = 'https://api.etherscan.io/v2/api?chainid=84532';


// ── Contracts to Verify ──────────────────────────────────────────────────────
const CONTRACTS = [
    {
        name: 'CryptoDiscoMasterX',
        address: '0x78a566a11AcDA14b2A4F776227f61097C7381C84',
        contractFile: 'contracts/CryptoDiscoMasterX.sol',
        constructorArgs: [
            '0x73F76B2B436E2E50BB6F81A6E33A42875F1CDFF3', // opsWallet
            '0xAFB7C7E711418EFD744F74B4D92C2B91B9668FAA', // treasury
            '0x4ADC67696BA383F43FD60604633031D935F9584B', // priceFeed
        ],
    },
    {
        name: 'CryptoDiscoRaffle',
        address: '0x2c28bced53Cdfe9d9ECe7DFa79fE1066e453DE08',
        contractFile: 'contracts/CryptoDiscoRaffle.sol',
        constructorArgs: [
            '0x78a566a11AcDA14b2A4F776227f61097C7381C84', // masterX
            '0x2ab9f26E18b6103274414940251539D0105e2Add', // airnodeRrp
        ],
    },
    {
        name: 'DailyAppV12Secured',
        address: '0xfc12f4FEFf825860c5145680bde38BF222cC669A',
        contractFile: 'contracts/DailyAppV12Secured.sol',
        constructorArgs: [
            '0x8bcf8b1959aaed2c33e55edc9d0b2633f7c7c35c', // creatorToken
            '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // usdcToken
            '0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B', // initialOwner
        ],
    },
];

// ── ABI Encode Constructor Args (manual for simple address array) ─────────────
function encodeAddress(addr) {
    // Pad address to 32 bytes
    return addr.replace('0x', '').toLowerCase().padStart(64, '0');
}

function encodeConstructorArgs(args) {
    if (!args || args.length === 0) return '';
    // All args are addresses — encode each as uint256(address)
    return args.map(encodeAddress).join('');
}

// ── HTTP POST helper ───────────────────────────────────────────────────────────
function postForm(url, params) {
    return new Promise((resolve, reject) => {
        const body = Object.entries(params)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');

        const options = new URL(url);
        const req = https.request({
            hostname: options.hostname,
            path: options.pathname + options.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
            },
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve({ raw: data }); }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ── Find build-info containing a specific contract file ──────────────────────
function findBuildInfoFor(contractFile) {
    const buildInfoDir = path.join(__dirname, '..', 'artifacts', 'build-info');
    const files = fs.readdirSync(buildInfoDir).filter(f => f.endsWith('.json'));

    for (const f of files) {
        const fullPath = path.join(buildInfoDir, f);
        const raw = fs.readFileSync(fullPath, 'utf8');
        const bi = JSON.parse(raw);
        if (bi.input && bi.input.sources && bi.input.sources[contractFile]) {
            console.log(`📦 Found build-info: ${f} (contains ${contractFile})`);
            return bi;
        }
    }
    // Fallback: most recent
    let latestFile = null, latestMtime = 0;
    for (const f of files) {
        const fullPath = path.join(buildInfoDir, f);
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs > latestMtime) { latestMtime = stat.mtimeMs; latestFile = fullPath; }
    }
    console.log(`📦 Fallback build-info: ${path.basename(latestFile)}`);
    return JSON.parse(fs.readFileSync(latestFile, 'utf8'));
}

// ── Check verification status ────────────────────────────────────────────────
async function checkStatus(guid) {
    const result = await postForm(BASESCAN_API_URL, {
        apikey: BASESCAN_API_KEY,
        module: 'contract',
        action: 'checkverifystatus',
        guid,
    });
    return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    if (!BASESCAN_API_KEY) {
        console.error('❌ BASESCAN_API_KEY not found in .env');
        process.exit(1);
    }

    console.log(`📡 BaseScan API: ${BASESCAN_API_URL}`);
    console.log(`🔑 API Key: ${BASESCAN_API_KEY.slice(0, 6)}...`);
    console.log('');

    for (const contract of CONTRACTS) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔍 Verifying: ${contract.name}`);
        console.log(`   Address : ${contract.address}`);
        console.log(`   File    : ${contract.contractFile}`);

        // Find correct build-info per contract
        const buildInfo = findBuildInfoFor(contract.contractFile);
        const solcInput = buildInfo.input;
        const solcLongVersion = buildInfo.solcLongVersion || '';
        const solcVerMatch = solcLongVersion.match(/(\d+\.\d+\.\d+\+commit\.[a-f0-9]+)/);
        const solcVerForAPI = solcVerMatch ? `v${solcVerMatch[1]}` : `v${buildInfo.solcVersion || '0.8.20'}`;
        const constructorArgsEncoded = encodeConstructorArgs(contract.constructorArgs);

        const params = {
            apikey: BASESCAN_API_KEY,
            module: 'contract',
            action: 'verifysourcecode',
            contractaddress: contract.address,
            sourceCode: JSON.stringify(solcInput),
            codeformat: 'solidity-standard-json-input',
            contractname: `${contract.contractFile}:${contract.name}`,
            compilerversion: solcVerForAPI,
            constructorArguements: constructorArgsEncoded,
            optimizationUsed: solcInput.settings?.optimizer?.enabled ? '1' : '0',
            runs: String(solcInput.settings?.optimizer?.runs || 200),
            evmversion: solcInput.settings?.evmVersion || '',
        };

        console.log(`⏳ Submitting to BaseScan...`);

        try {
            const result = await postForm(BASESCAN_API_URL, params);
            console.log(`   Response:`, JSON.stringify(result.result || result));

            if (result.status === '1') {
                const guid = result.result;
                console.log(`   GUID: ${guid}`);
                console.log(`   ⏳ Waiting 15 seconds then checking status...`);

                await new Promise(r => setTimeout(r, 15000));

                const status = await checkStatus(guid);
                console.log(`   Status: ${JSON.stringify(status.result)}`);

                if (status.result === 'Pass - Verified') {
                    console.log(`   ✅ VERIFIED! https://sepolia.basescan.org/address/${contract.address}#code`);
                } else {
                    console.log(`   ⚠️  Status: ${status.result}`);
                }
            } else {
                console.log(`   ❌ Submission failed: ${result.message || JSON.stringify(result)}`);
            }
        } catch (err) {
            console.error(`   ❌ Error: ${err.message}`);
        }

        // Rate limit: 1 request per 5 seconds
        if (CONTRACTS.indexOf(contract) < CONTRACTS.length - 1) {
            console.log('   ⏳ Waiting 5s for rate limit...');
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ Done! Check https://sepolia.basescan.org for verification status.');
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
