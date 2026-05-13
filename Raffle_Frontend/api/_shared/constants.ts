import { createPublicClient, http, fallback } from 'viem';
import { base, baseSepolia } from 'viem/chains';

// 1. ENVIRONMENT VALIDATION
export const getEnv = (key: string, fallbackVal: string = ''): string => (process.env[key] || fallbackVal).trim();

export const SUPABASE_URL = getEnv('VITE_SUPABASE_URL', getEnv('NEXT_PUBLIC_SUPABASE_URL', getEnv('SUPABASE_URL')));
export const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY', getEnv('SUPABASE_SECRET_KEY'));

export const CHAIN_ID = getEnv('VITE_CHAIN_ID', getEnv('NEXT_PUBLIC_CHAIN_ID', '84532'));
export const IS_MAINNET = CHAIN_ID === '8453';
/** @alias IS_MAINNET — lowercase alias for bundle compatibility */
export const isMainnet = IS_MAINNET;

export const RPC_URL = IS_MAINNET 
    ? getEnv('VITE_BASE_MAINNET_RPC_URL', getEnv('VITE_RPC_URL', 'https://mainnet.base.org'))
    : getEnv('VITE_BASE_SEPOLIA_RPC_URL', 'https://sepolia.base.org');

export const VIEM_CHAIN = IS_MAINNET ? base : baseSepolia;

// RPC Client singleton — used by all serverless bundles with robust fallback
export const rpcClient = createPublicClient({
    chain: VIEM_CHAIN,
    transport: fallback([
        http(RPC_URL),
        http(IS_MAINNET ? 'https://mainnet.base.org' : 'https://sepolia.base.org'),
        http(IS_MAINNET ? 'https://base.llamarpc.com' : 'https://base-sepolia.publicnode.com'),
    ], { rank: true }),
});

// 2. ZERO-HARDCODE ADDRESS RESOLVER
export const getContractAddr = (key: string): `0x${string}` => {
    const envKey = IS_MAINNET ? `VITE_${key}_ADDRESS` : `VITE_${key}_ADDRESS_SEPOLIA`;
    const addr = getEnv(envKey);
    if (!addr || !addr.startsWith('0x')) {
        console.error(`[Zero-Hardcode] Missing address for ${key} on ${IS_MAINNET ? 'Mainnet' : 'Sepolia'}`);
        return '0x0000000000000000000000000000000000000000';
    }
    return addr as `0x${string}`;
};

export const DAILY_APP_ADDRESS = IS_MAINNET
    ? getEnv('VITE_DAILY_APP_ADDRESS', getEnv('VITE_V12_CONTRACT_ADDRESS', ''))
    : getEnv('VITE_DAILY_APP_ADDRESS_SEPOLIA', getEnv('VITE_V12_CONTRACT_ADDRESS_SEPOLIA', getEnv('DAILY_APP_ADDRESS', '')));

export const RAFFLE_ADDRESS = IS_MAINNET
    ? getEnv('VITE_RAFFLE_ADDRESS', '')
    : getEnv('VITE_RAFFLE_ADDRESS_SEPOLIA', '');

// 3. ABIs (Moved from hardcode in bundle files)
export const RAFFLE_ABI = [
    {
        "inputs": [{ "internalType": "uint256", "name": "raffleId", "type": "uint256" }],
        "name": "getRaffleInfo",
        "outputs": [
            {
                "components": [
                    { "internalType": "uint256", "name": "raffleId", "type": "uint256" },
                    { "internalType": "uint256", "name": "totalTickets", "type": "uint256" },
                    { "internalType": "uint256", "name": "maxTickets", "type": "uint256" },
                    { "internalType": "uint256", "name": "targetPrizePool", "type": "uint256" },
                    { "internalType": "uint256", "name": "prizePool", "type": "uint256" },
                    { "internalType": "address[]", "name": "participants", "type": "address[]" },
                    { "internalType": "address[]", "name": "winners", "type": "address[]" },
                    { "internalType": "uint256", "name": "winnerCount", "type": "uint256" },
                    { "internalType": "uint256", "name": "randomNumber", "type": "uint256" },
                    { "internalType": "bool", "name": "isActive", "type": "bool" },
                    { "internalType": "bool", "name": "isFinalized", "type": "bool" },
                    { "internalType": "address", "name": "sponsor", "type": "address" },
                    { "internalType": "string", "name": "metadataURI", "type": "string" },
                    { "internalType": "uint256", "name": "endTime", "type": "uint256" },
                    { "internalType": "uint256", "name": "prizePerWinner", "type": "uint256" }
                ],
                "internalType": "struct NFT_Raffle_V2.RaffleInfo",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

export const DAILY_APP_USER_STATS_ABI = [
    {
        "inputs": [{ "name": "", "type": "address" }],
        "name": "userStats",
        "outputs": [
            { "name": "points", "type": "uint256" },
            { "name": "totalTasksCompleted", "type": "uint256" },
            { "name": "referralCount", "type": "uint256" },
            { "name": "currentTier", "type": "uint8" },
            { "name": "tasksForReferralProgress", "type": "uint256" },
            { "name": "lastDailyBonusClaim", "type": "uint256" },
            { "name": "isBlacklisted", "type": "bool" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

export const TASK_IDS = {
    REFERRAL_INVITE: getEnv('REFERRAL_INVITE_TASK_ID', '77e123f5-0ded-4ca1-af04-e8b6924823e2'),
    DAILY_CLAIM_STREAK: getEnv('DAILY_CLAIM_STREAK_TASK_ID', '288596d8-b5a9-4faf-bde0-0dd28aaba902'),
    DAILY_CLAIM_REWARD: getEnv('DAILY_CLAIM_REWARD_TASK_ID', '885535d2-4c5c-4a80-9af5-36666192c244')
};

export const PROFILE_LIMITS = {
    MAX_NAME_LEN: parseInt(getEnv('MAX_NAME_LEN', '50')),
    MAX_BIO_LEN: parseInt(getEnv('MAX_BIO_LEN', '160')),
    MAX_USERNAME_LEN: parseInt(getEnv('MAX_USERNAME_LEN', '30')),
    MAX_AVATAR_BYTES: parseInt(getEnv('MAX_AVATAR_BYTES', '1048576')) 
};

export const MASTER_ADMINS = getEnv('VITE_ADMIN_WALLETS', getEnv('VITE_ADMIN_ADDRESS', getEnv('ADMIN_ADDRESS', ''))).toLowerCase().split(',').filter(Boolean);

export const SAFE_MULTISIG = getEnv('VITE_SAFE_MULTISIG', getEnv('SAFE_MULTISIG', ''));
if (!SAFE_MULTISIG) console.warn('[Zero-Hardcode] SAFE_MULTISIG is empty — set VITE_SAFE_MULTISIG or SAFE_MULTISIG env var');

export const NEYNAR_API_KEY = getEnv('NEYNAR_API_KEY');
export const WALLET_BOT_SIGNER = getEnv('WALLET_BOT_SIGNER', getEnv('WALLET_PRIVATE_KEY', getEnv('ADMIN_PRIVATE_KEY', getEnv('PRIVATE_KEY'))));
export const TELEGRAM_BOT_TOKEN = getEnv('TELEGRAM_BOT_TOKEN');
export const TELEGRAM_CHAT_ID = getEnv('TELEGRAM_CHAT_ID');

export const USDC_ADDRESS = getEnv('VITE_USDC_ADDRESS', getEnv('USDC_ADDRESS', ''));
if (!USDC_ADDRESS) console.warn('[Zero-Hardcode] USDC_ADDRESS is empty — set VITE_USDC_ADDRESS env var');

export const MASTER_X_ADDRESS = IS_MAINNET
    ? getEnv('VITE_MASTER_X_ADDRESS', '')
    : getEnv('VITE_MASTER_X_ADDRESS_SEPOLIA', '');

export const MASTER_X_ABI = [
    { name: 'diamondWeight', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'platinumWeight', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'goldWeight', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'silverWeight', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'bronzeWeight', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

export const ERC20_ABI = [
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' }
        ],
        name: 'Transfer',
        type: 'event'
    }
] as const;

export const UGC_PLATFORM_LINK_RULES = {
    farcaster:  { pattern: /warpcast\.com/i,            label: 'warpcast.com' },
    twitter:    { pattern: /(twitter\.com|x\.com)/i,   label: 'x.com or twitter.com' },
    tiktok:     { pattern: /tiktok\.com/i,              label: 'tiktok.com' },
    instagram:  { pattern: /instagram\.com/i,           label: 'instagram.com' },
    onchain:    { pattern: /.*/,                        label: 'any URL' }
};

export const VALID_ACTION_TYPES = new Set([
    'follow', 'like', 'recast', 'repost', 'quote', 'reply', 'comment', 'duet', 'transaction'
]);

export const MASTER_X_EVENT_ABI = [
    { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'points', type: 'uint256' }, { indexed: false, name: 'reason', type: 'string' }], name: 'PointsAwarded', type: 'event' },
    { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'oldTier', type: 'uint8' }, { indexed: false, name: 'newTier', type: 'uint8' }, { indexed: false, name: 'xpBurned', type: 'uint256' }, { indexed: false, name: 'feePaid', type: 'uint256' }], name: 'TierUpgraded', type: 'event' },
    { anonymous: false, inputs: [{ indexed: true, name: 'oldSeasonId', type: 'uint256' }, { indexed: true, name: 'newSeasonId', type: 'uint256' }], name: 'SeasonReset', type: 'event' }
] as const;

export const DAILY_APP_EVENT_ABI = [
    { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'taskId', type: 'uint256' }, { indexed: false, name: 'reward', type: 'uint256' }, { indexed: false, name: 'timestamp', type: 'uint256' }], name: 'TaskCompleted', type: 'event' },
    { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: true, name: 'token', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }, { indexed: false, name: 'timestamp', type: 'uint256' }], name: 'RewardsClaimed', type: 'event' }
] as const;

export const RAFFLE_EVENT_ABI = [
    { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: true, name: 'raffleId', type: 'uint256' }, { indexed: false, name: 'count', type: 'uint256' }], name: 'TicketPurchased', type: 'event' },
    { anonymous: false, inputs: [{ indexed: true, name: 'raffleId', type: 'uint256' }, { indexed: false, name: 'timestamp', type: 'uint256' }], name: 'RaffleCreated', type: 'event' },
    { anonymous: false, inputs: [{ indexed: true, name: 'raffleId', type: 'uint256' }, { indexed: true, name: 'winner', type: 'address' }, { indexed: false, name: 'prize', type: 'uint256' }], name: 'RaffleWinner', type: 'event' }
] as const;


// ERROR SANITIZATION — Never expose internal errors to clients
export function sanitizeError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV === 'development') return msg;
    // Allow known safe user-facing messages through
    const safePatterns = ['not found', 'unauthorized', 'forbidden', 'invalid', 'expired', 'already claimed', 'insufficient', 'not eligible', 'cooldown', 'limit reached', 'feature disabled'];
    const lower = msg.toLowerCase();
    if (safePatterns.some(p => lower.includes(p))) return msg;
    console.error('[API Error]', msg);
    return 'An unexpected error occurred. Please try again.';
}
