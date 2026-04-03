const fs = require('fs');

const abi = fs.readFileSync('abi_extracted.json', 'utf8');
const erc20Abi = [
    {
        "inputs": [
            { "internalType": "address", "name": "spender", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [
            { "internalType": "bool", "name": "", "type": "bool" }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "account", "type": "address" }
        ],
        "name": "balanceOf",
        "outputs": [
            { "internalType": "uint256", "name": "", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

const content = `import { DISCO_MASTER_ABI, RAFFLE_ABI } from "../shared/constants/abis";

export const MASTER_X_ABI = DISCO_MASTER_ABI;
export { RAFFLE_ABI };
export const DAILY_APP_ABI = ${abi};

export const ERC20_ABI = ${JSON.stringify(erc20Abi, null, 2)};

export const CONTRACTS = {
    // Master X: XP, Revenue Sharing, SBT tiers (LATEST DEPLOYED)
    MASTER_X: import.meta.env.VITE_MASTER_X_ADDRESS || "0x980770dAcE8f13E10632D3EC1410FAA4c707076c",
    // Daily App V12: Tasks, Sponsorship, Daily Claim (LATEST DEPLOYED)
    DAILY_APP: import.meta.env.VITE_V12_CONTRACT_ADDRESS || "0xfc12f4FEFf825860c5145680bde38BF222cC669A",
    // Raffle Contract (LATEST DEPLOYED)
    RAFFLE: import.meta.env.VITE_RAFFLE_ADDRESS || "0x012FAdd087540e1B51a587f420e77D007fED2a84",
    // Content CMS V2 (LATEST DEPLOYED)
    CMS: import.meta.env.VITE_CMS_CONTRACT_ADDRESS || "0x8D5ef43A69DDc9f9d4bCc6dF3DcCcDBEDa53A302",
    // Tokens
    USDC: import.meta.env.VITE_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    CREATOR_TOKEN: import.meta.env.VITE_CREATOR_TOKEN_ADDRESS || "0x8bcf8b1959aaed2c33e55edc9d0b2633f7c7c35c",
};
`;

fs.writeFileSync('Raffle_Frontend/src/lib/contracts.js', content);
console.log("SUCCESS: contracts.js updated.");
