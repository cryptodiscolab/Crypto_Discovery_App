import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { Contract, Interface, JsonRpcProvider, Wallet, formatEther } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

for (const relative of ['.env', '.env.local', 'Raffle_Frontend/.env', 'Raffle_Frontend/.env.local']) {
  loadEnvFile(path.join(repoRoot, relative));
}

const envFirst = (...names) => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`${names[0]} is required`);
};

const rawPrivateKey = (process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.VITE_DEPLOYER_PRIVATE_KEY || '').trim();
const privateKey = rawPrivateKey && !rawPrivateKey.startsWith('0x') ? `0x${rawPrivateKey}` : rawPrivateKey;
if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('DEPLOYER_PRIVATE_KEY/PRIVATE_KEY is required');

const APP_URL = (process.env.LIVE_APP_URL || 'https://crypto-discovery-app.vercel.app').replace(/\/$/, '');
const RAFFLE = envFirst('VITE_RAFFLE_ADDRESS_SEPOLIA', 'RAFFLE_ADDRESS_SEPOLIA', 'VITE_RAFFLE_ADDRESS', 'RAFFLE_ADDRESS');
const DAILY_APP = envFirst('VITE_DAILY_APP_ADDRESS_SEPOLIA', 'VITE_DAILY_APP_V16_ADDRESS', 'DAILY_APP_ADDRESS_SEPOLIA', 'DAILY_APP_ADDRESS');
const SUPABASE_URL = envFirst('SUPABASE_URL', 'VITE_SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = envFirst('SUPABASE_SERVICE_ROLE_KEY');
const raffleId = Number(process.env.RESUME_RAFFLE_ID || process.argv[2] || 0);
if (!Number.isInteger(raffleId) || raffleId <= 0) throw new Error('Pass raffle id as argv[2] or RESUME_RAFFLE_ID');

const provider = new JsonRpcProvider(process.env.RPC_URL_SEPOLIA || 'https://sepolia.base.org', 84532, { staticNetwork: true });
const wallet = new Wallet(privateKey, provider);
const walletAddress = await wallet.getAddress();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const RAFFLE_ABI = [
  'function drawWinner(uint256 raffleId)',
  'function claimRafflePrize(uint256 raffleId)',
  'function hasUserClaimed(uint256 raffleId,address user) view returns (bool)',
  'function getRaffleInfo(uint256 raffleId) view returns (tuple(uint256 raffleId,uint256 totalTickets,uint256 maxTickets,uint256 targetPrizePool,uint256 prizePool,address[] participants,address[] winners,uint256 winnerCount,uint256 randomNumber,bool isActive,bool isFinalized,address sponsor,string metadataURI,uint256 endTime,uint256 prizePerWinner,uint256 totalTicketRevenue))',
  'event QRNGRequested(bytes32 indexed requestId,uint256 indexed raffleId)',
  'event QRNGFulfilled(bytes32 indexed requestId,uint256 randomNumber)',
  'event RaffleWinner(uint256 indexed raffleId,address indexed winner,uint256 prize)'
];

const DAILY_APP_ABI = [
  'function userStats(address user) view returns (uint256 points,uint256 totalTasksCompleted,uint256 referralCount,uint8 currentTier,uint256 tasksForReferralProgress,uint256 lastDailyBonusClaim,bool isBlacklisted)'
];

const raffle = new Contract(RAFFLE, RAFFLE_ABI, wallet);
const raffleRead = new Contract(RAFFLE, RAFFLE_ABI, provider);
const dailyApp = new Contract(DAILY_APP, DAILY_APP_ABI, provider);
const raffleIface = new Interface(RAFFLE_ABI);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function stringifySafe(value) {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

function log(payload) {
  console.log(stringifySafe(payload));
}

function normalizeRaffleInfo(info) {
  return {
    totalTickets: BigInt(info.totalTickets ?? info[1] ?? 0n),
    isActive: Boolean(info.isActive ?? info[9]),
    isFinalized: Boolean(info.isFinalized ?? info[10]),
    winners: Array.from(info.winners ?? info[6] ?? []).map((winner) => String(winner).toLowerCase()),
    prizePool: BigInt(info.prizePool ?? info[4] ?? 0n),
    prizePerWinner: BigInt(info.prizePerWinner ?? info[14] ?? 0n),
    randomNumber: BigInt(info.randomNumber ?? info[8] ?? 0n)
  };
}

function getEvent(receipt, name) {
  for (const logEntry of receipt.logs) {
    if (logEntry.address.toLowerCase() !== RAFFLE.toLowerCase()) continue;
    try {
      const parsed = raffleIface.parseLog(logEntry);
      if (parsed?.name === name) return parsed;
    } catch {
      // skip unrecognized logs
    }
  }
  return null;
}

async function requestJson(pathname, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${APP_URL}${pathname}`, options);
      const text = await response.text();
      let parsed;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = { raw: text.slice(0, 500) };
      }
      if (response.ok || parsed?.error !== 'RPC_SYNC_DELAYED') {
        return { status: response.status, ok: response.ok, body: parsed, attempt };
      }
      lastError = new Error(parsed?.message || parsed?.error || 'RPC_SYNC_DELAYED');
    } catch (error) {
      lastError = error;
    }
    await sleep(5000 * attempt);
  }
  return {
    status: 0,
    ok: false,
    body: { error: lastError instanceof Error ? lastError.message : String(lastError) },
    attempt: attempts
  };
}

async function apiPost(pathname, body) {
  return requestJson(pathname, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function apiGet(pathname, headers = {}) {
  return requestJson(pathname, { headers });
}

async function waitForFinalized(attempts = 24, intervalMs = 15000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const info = normalizeRaffleInfo(await raffleRead.getRaffleInfo(raffleId));
    log({
      phase: 'draw-poll',
      raffleId,
      attempt,
      isActive: info.isActive,
      isFinalized: info.isFinalized,
      winners: info.winners,
      prizePerWinnerETH: formatEther(info.prizePerWinner),
      randomNumber: info.randomNumber.toString()
    });
    if (info.isFinalized) return info;
    await sleep(intervalMs);
  }
  return normalizeRaffleInfo(await raffleRead.getRaffleInfo(raffleId));
}

async function sign(message) {
  return wallet.signMessage(message);
}

const qaStartedAt = new Date().toISOString();
const beforeStats = await dailyApp.userStats(walletAddress);
let info = normalizeRaffleInfo(await raffleRead.getRaffleInfo(raffleId));

log({
  phase: 'preflight',
  api: APP_URL,
  raffle: RAFFLE,
  raffleId,
  wallet: walletAddress,
  totalTickets: info.totalTickets.toString(),
  isActive: info.isActive,
  isFinalized: info.isFinalized,
  winners: info.winners,
  beforePoints: beforeStats[0].toString(),
  beforeTier: Number(beforeStats[3])
});

let drawResult = { skipped: true, reason: 'already finalized or inactive' };
if (!info.isFinalized && info.isActive) {
  const drawTx = await raffle.drawWinner(raffleId);
  const drawReceipt = await drawTx.wait();
  drawResult = {
    txHash: drawTx.hash,
    status: drawReceipt.status,
    eventFound: !!getEvent(drawReceipt, 'QRNGRequested')
  };
}

info = await waitForFinalized();

let claimResult = { skipped: true, reason: 'not finalized' };
if (info.isFinalized) {
  const cleanWallet = walletAddress.toLowerCase();
  const isWinner = info.winners.includes(cleanWallet);
  const alreadyClaimed = await raffleRead.hasUserClaimed(raffleId, walletAddress);

  if (!isWinner) {
    claimResult = { skipped: true, reason: 'wallet is not winner', winners: info.winners };
  } else if (alreadyClaimed) {
    claimResult = { skipped: true, reason: 'already claimed on-chain', winners: info.winners };
  } else {
    const claimTx = await raffle.claimRafflePrize(raffleId);
    const claimReceipt = await claimTx.wait();
    const claimMessage = `Claim NFT Raffle Prize\nRaffle ID: ${raffleId}\nWinner: ${cleanWallet}\nTime: ${new Date().toISOString()}`;
    const claimSync = await apiPost('/api/raffle?action=claim-prize', {
      wallet_address: walletAddress,
      signature: await sign(claimMessage),
      message: claimMessage,
      raffle_id: raffleId,
      tx_hash: claimTx.hash
    });

    claimResult = {
      txHash: claimTx.hash,
      status: claimReceipt.status,
      eventFound: !!getEvent(claimReceipt, 'RaffleWinner'),
      hasUserClaimed: String(await raffleRead.hasUserClaimed(raffleId, walletAddress)),
      api: claimSync
    };
  }
}

let raffleSync = { skipped: true, reason: 'CRON_SECRET not configured' };
if (process.env.CRON_SECRET?.trim()) {
  raffleSync = await apiGet('/api/raffle-sync', { authorization: `Bearer ${process.env.CRON_SECRET.trim()}` });
}

const { data: raffleRows } = await supabase
  .from('raffles')
  .select('id,is_active,is_finalized,finalized_at,claim_deadline_at,creator_address,sponsor_address,prize_pool,prize_per_winner,max_tickets,winner_count')
  .eq('id', raffleId);
const { data: claims } = await supabase
  .from('user_task_claims')
  .select('task_id,xp_earned,target_id')
  .or(`task_id.eq.raffle_create_${raffleId},task_id.like.raffle_buy_${raffleId}_%,task_id.eq.raffle_win_${raffleId}`)
  .order('task_id', { ascending: true });
const { data: activityLogs } = await supabase
  .from('user_activity_logs')
  .select('category,activity_type,value_amount,value_symbol,tx_hash,created_at,metadata')
  .eq('wallet_address', walletAddress.toLowerCase())
  .gte('created_at', qaStartedAt)
  .in('category', ['RAFFLE', 'XP', 'PURCHASE', 'SYNC'])
  .order('created_at', { ascending: true });
const afterStats = await dailyApp.userStats(walletAddress);

log({
  phase: 'final',
  raffleId,
  drawResult,
  finalInfo: {
    isFinalized: info.isFinalized,
    winners: info.winners,
    prizePoolETH: formatEther(info.prizePool),
    prizePerWinnerETH: formatEther(info.prizePerWinner)
  },
  claimResult,
  raffleSync,
  dbRaffles: raffleRows,
  dbClaims: claims,
  dbActivityLogs: activityLogs,
  afterPoints: afterStats[0].toString(),
  afterTier: Number(afterStats[3]),
  xpDelta: (afterStats[0] - beforeStats[0]).toString()
});
