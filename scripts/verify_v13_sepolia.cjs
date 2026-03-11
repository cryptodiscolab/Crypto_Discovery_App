const https = require('https');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY;
const BASESCAN_API_URL = 'https://api.etherscan.io/v2/api?chainid=84532';

const contract = {
    name: 'DailyAppV13',
    address: '0x87a3d1203Bf20E7dF5659A819ED79a67b236F571',
    contractFile: 'contracts/DailyAppV13.sol',
    constructorArgs: [
        '0x8bcf8b1959aaed2c33e55edc9d0b2633f7c7c35c', // creatorToken
        '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // usdcToken
        '0x52260c30697674a7C837FEB2af21bBf3606795C8', // initialOwner
    ],
};

function encodeAddress(addr) {
    return addr.replace('0x', '').toLowerCase().padStart(64, '0');
}

function encodeConstructorArgs(args) {
    return args.map(encodeAddress).join('');
}

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

function findBuildInfoFor(contractFile) {
    const buildInfoDir = path.join(__dirname, '..', 'artifacts', 'build-info');
    const files = fs.readdirSync(buildInfoDir).filter(f => f.endsWith('.json'));

    for (const f of files) {
        const fullPath = path.join(buildInfoDir, f);
        const bi = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (bi.input && bi.input.sources && bi.input.sources[contractFile]) {
            console.log(`📦 Found build-info: ${f}`);
            return bi;
        }
    }
    throw new Error(`Build info for ${contractFile} not found`);
}

async function main() {
    if (!BASESCAN_API_KEY) throw new Error('BASESCAN_API_KEY missing');

    const buildInfo = findBuildInfoFor(contract.contractFile);
    const solcVerMatch = buildInfo.solcLongVersion.match(/(\d+\.\d+\.\d+\+commit\.[a-f0-9]+)/);
    const solcVerForAPI = solcVerMatch ? `v${solcVerMatch[1]}` : `v${buildInfo.solcVersion}`;

    const params = {
        apikey: BASESCAN_API_KEY,
        module: 'contract',
        action: 'verifysourcecode',
        contractaddress: contract.address,
        sourceCode: JSON.stringify(buildInfo.input),
        codeformat: 'solidity-standard-json-input',
        contractname: `${contract.contractFile}:${contract.name}`,
        compilerversion: solcVerForAPI,
        constructorArguements: encodeConstructorArgs(contract.constructorArgs),
        optimizationUsed: '1',
        runs: '1',
        evmversion: 'paris', // Standard for Sepolia/Base
    };

    console.log(`⏳ Submitting to BaseScan...`);
    const result = await postForm(BASESCAN_API_URL, params);
    console.log(`Response:`, result);

    if (result.status === '1') {
        const guid = result.result;
        console.log(`GUID: ${guid}`);
        console.log(`⏳ Waiting 30s for verification...`);
        await new Promise(r => setTimeout(r, 30000));
        
        const status = await postForm(BASESCAN_API_URL, {
            apikey: BASESCAN_API_KEY,
            module: 'contract',
            action: 'checkverifystatus',
            guid,
        });
        console.log(`Status: ${status.result}`);
    }
}

main().catch(console.error);
