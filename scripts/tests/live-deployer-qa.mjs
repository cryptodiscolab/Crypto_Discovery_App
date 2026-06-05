import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { Contract, Interface, JsonRpcProvider, Wallet, formatEther, parseEther } from 'ethers';

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

const must = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const rawPrivateKey = (process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.VITE_DEPLOYER_PRIVATE_KEY || '').trim();
const privateKey = rawPrivateKey && !rawPrivateKey.startsWith('0x') ? `0x${rawPrivateKey}` : rawPrivateKey;
if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('DEPLOYER_PRIVATE_KEY/PRIVATE_KEY is required');

const APP_URL = (process.env.LIVE_APP_URL || 'https://crypto-discovery-app.vercel.app').replace(/\/$/, '');
const provider = new JsonRpcProvider('https://sepolia.base.org', 84532, { staticNetwork: true });
const wallet = new Wallet(privateKey, provider);
const walletAddress = await wallet.getAddress();
const supabase = createClient(must('SUPABASE_URL'), must('SUPABASE_SERVICE_ROLE_KEY'));

const envFirst = (...names) => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`${names[0]} is required`);
};

const DAILY_APP = envFirst('VITE_DAILY_APP_ADDRESS_SEPOLIA', 'VITE_DAILY_APP_V16_ADDRESS', 'DAILY_APP_ADDRESS_SEPOLIA', 'DAILY_APP_ADDRESS');
const RAFFLE = envFirst('VITE_RAFFLE_ADDRESS_SEPOLIA', 'RAFFLE_ADDRESS_SEPOLIA', 'VITE_RAFFLE_ADDRESS', 'RAFFLE_ADDRESS');
const MASTER_X = envFirst('VITE_MASTER_X_ADDRESS_SEPOLIA', 'MASTER_X_ADDRESS_SEPOLIA', 'VITE_MASTER_X_ADDRESS', 'MASTER_X_ADDRESS');

const DAILY_APP_ABI = [
  'function userStats(address user) view returns (uint256 points,uint256 totalTasksCompleted,uint256 referralCount,uint8 currentTier,uint256 tasksForReferralProgress,uint256 lastDailyBonusClaim,bool isBlacklisted)'
];

const MASTER_X_ABI = [
  'function getTicketPriceInETH() view returns (uint256)'
];

const RAFFLE_ABI = [
  'function currentRaffleId() view returns (uint256)',
  'function surchargeBP() view returns (uint256)',
  'function airnode() view returns (address)',
  'function airnodeRrp() view returns (address)',
  'function sponsorWallet() view returns (address)',
  'function createSponsorshipRaffle(uint256 winnerCount,uint256 maxTickets,uint256 durationDays,string metadataURI) payable',
  'function buyTickets(uint256 raffleId,uint256 ticketCount) payable',
  'function cancelRaffle(uint256 raffleId)',
  'function drawWinner(uint256 raffleId)',
  'function getUserTickets(uint256 raffleId,address user) view returns (uint256)',
  'function getRaffleInfo(uint256 raffleId) view returns (tuple(uint256 raffleId,uint256 totalTickets,uint256 maxTickets,uint256 targetPrizePool,uint256 prizePool,address[] participants,address[] winners,uint256 winnerCount,uint256 randomNumber,bool isActive,bool isFinalized,address sponsor,string metadataURI,uint256 endTime,uint256 prizePerWinner,uint256 totalTicketRevenue))',
  'event RaffleCreated(uint256 indexed raffleId,uint256 timestamp)',
  'event TicketPurchased(address indexed user,uint256 indexed raffleId,uint256 count)',
  'event RaffleCancelled(uint256 indexed raffleId,address indexed sponsor,uint256 refundedAmount)',
  'event QRNGRequested(bytes32 indexed requestId,uint256 indexed raffleId)'
];

const dailyApp = new Contract(DAILY_APP, DAILY_APP_ABI, provider);
const masterX = new Contract(MASTER_X, MASTER_X_ABI, provider);
const raffle = new Contract(RAFFLE, RAFFLE_ABI, wallet);
const raffleRead = new Contract(RAFFLE, RAFFLE_ABI, provider);
const raffleIface = new Interface(RAFFLE_ABI);

function stringifySafe(value) {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

function log(payload) {
  console.log(stringifySafe(payload));
}

async function apiPost(pathname, body) {
  const response = await fetch(`${APP_URL}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text.slice(0, 500) };
  }
  return { status: response.status, ok: response.ok, body: parsed };
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

async function createRaffle(label, deposit) {
  const metadata = `ipfs://qa-live-${label}-${Date.now()}`;
  const tx = await raffle.createSponsorshipRaffle(1, 1, 1, metadata, { value: deposit });
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error(`createSponsorshipRaffle failed: ${tx.hash}`);
  const created = getEvent(receipt, 'RaffleCreated');
  const raffleId = created ? Number(created.args.raffleId) : Number(await raffleRead.currentRaffleId());
  return { raffleId, txHash: tx.hash, metadata, eventFound: !!created };
}

async function sign(message) {
  return wallet.signMessage(message);
}

const balance = await provider.getBalance(walletAddress);
const beforeStats = await dailyApp.userStats(walletAddress);
const deposit = parseEther('0.0001');
const ticketPrice = await masterX.getTicketPriceInETH();
const surchargeBP = await raffleRead.surchargeBP();
const ticketCost = ticketPrice + ((ticketPrice * surchargeBP) / 10000n);

log({
  phase: 'preflight',
  api: APP_URL,
  wallet: walletAddress,
  chainId: Number((await provider.getNetwork()).chainId),
  balanceETH: formatEther(balance),
  depositETH: formatEther(deposit),
  ticketCostETH: formatEther(ticketCost),
  beforePoints: beforeStats[0].toString(),
  beforeTier: Number(beforeStats[3])
});

const created = await createRaffle('create-buy', deposit);
const createMessage = `Create Sponsorship Raffle\nRaffle ID: ${created.raffleId}\nSponsor: ${walletAddress.toLowerCase()}\nTime: ${new Date().toISOString()}`;
const syncCreate = await apiPost('/api/user-bundle?action=sync-ugc-raffle', {
  action: 'sync-ugc-raffle',
  wallet: walletAddress,
  signature: await sign(createMessage),
  message: createMessage,
  payload: {
    raffle_id: created.raffleId,
    depositETH: formatEther(deposit),
    end_time: Math.floor(Date.now() / 1000) + 86400,
    max_tickets: 1,
    metadata_uri: created.metadata,
    winnerCount: 1,
    txHash: created.txHash,
    extra_metadata: {
      title: `Live QA Raffle ${created.raffleId}`,
      description: 'Automated live deployer QA',
      category: 'QA'
    }
  }
});
log({ phase: 'create-raffle-sync', raffleId: created.raffleId, txHash: created.txHash, eventFound: created.eventFound, api: syncCreate });
if (!syncCreate.ok) throw new Error(`sync-ugc-raffle failed for ${created.raffleId}`);

const approveMessage = `Approve Raffle\nRaffle ID: ${created.raffleId}\nAdmin: ${walletAddress.toLowerCase()}\nTime: ${new Date().toISOString()}`;
const approve = await apiPost('/api/user-bundle?action=approve-raffle', {
  action: 'approve-raffle',
  wallet: walletAddress,
  signature: await sign(approveMessage),
  message: approveMessage,
  raffle_id: created.raffleId
});
log({ phase: 'approve-raffle', raffleId: created.raffleId, api: approve });
if (!approve.ok) throw new Error(`approve-raffle failed for ${created.raffleId}`);

const buyTx = await raffle.buyTickets(created.raffleId, 1, { value: ticketCost });
const buyReceipt = await buyTx.wait();
if (buyReceipt.status !== 1) throw new Error(`buyTickets failed: ${buyTx.hash}`);
const tickets = await raffleRead.getUserTickets(created.raffleId, walletAddress);
const buyMessage = `Claim XP for Raffle Purchase\nRaffle ID: ${created.raffleId}\nAmount: 1\nUser: ${walletAddress.toLowerCase()}\nTime: ${new Date().toISOString()}`;
const buyTaskId = `raffle_buy_${created.raffleId}_${buyTx.hash}`;
const buySync = await apiPost('/api/tasks/verify', {
  wallet_address: walletAddress,
  signature: await sign(buyMessage),
  message: buyMessage,
  task_id: buyTaskId,
  xp_reward: 0
});
const buyReplay = await apiPost('/api/tasks/verify', {
  wallet_address: walletAddress,
  signature: await sign(buyMessage),
  message: buyMessage,
  task_id: buyTaskId,
  xp_reward: 0
});
log({
  phase: 'buy-ticket-sync',
  raffleId: created.raffleId,
  txHash: buyTx.hash,
  eventFound: !!getEvent(buyReceipt, 'TicketPurchased'),
  tickets: tickets.toString(),
  api: buySync,
  replay: buyReplay
});
if (!buySync.ok || !buyReplay.ok) throw new Error(`buy ticket sync/replay failed for ${created.raffleId}`);

const cancelled = await createRaffle('cancel', deposit);
const cancelTx = await raffle.cancelRaffle(cancelled.raffleId);
const cancelReceipt = await cancelTx.wait();
if (cancelReceipt.status !== 1) throw new Error(`cancelRaffle failed: ${cancelTx.hash}`);
const cancelMessage = `Reject Raffle\nRaffle ID: ${cancelled.raffleId}\nReason: Live QA cancellation\nAdmin: ${walletAddress.toLowerCase()}\nTime: ${new Date().toISOString()}`;
const reject = await apiPost('/api/user-bundle?action=reject-raffle', {
  action: 'reject-raffle',
  wallet: walletAddress,
  signature: await sign(cancelMessage),
  message: cancelMessage,
  raffle_id: cancelled.raffleId,
  reason: 'Live QA cancellation',
  txHash: cancelTx.hash
});
log({
  phase: 'reject-raffle-sync',
  raffleId: cancelled.raffleId,
  txHash: cancelTx.hash,
  eventFound: !!getEvent(cancelReceipt, 'RaffleCancelled'),
  api: reject
});
if (!reject.ok) throw new Error(`reject-raffle failed for ${cancelled.raffleId}`);

let drawResult;
try {
  const airnode = await raffleRead.airnode();
  const airnodeRrp = await raffleRead.airnodeRrp();
  const sponsorWallet = await raffleRead.sponsorWallet();
  if (airnode === '0x0000000000000000000000000000000000000000') {
    drawResult = { skipped: true, reason: 'Airnode is not configured' };
  } else if (await provider.getCode(airnodeRrp) === '0x') {
    drawResult = {
      skipped: true,
      reason: 'AirnodeRrp has no bytecode on Base Sepolia; raffle must be redeployed with a valid RRP address before QRNG draw.',
      airnodeRrp,
      sponsorWallet
    };
  } else {
    const drawTx = await raffle.drawWinner(created.raffleId);
    const drawReceipt = await drawTx.wait();
    drawResult = { txHash: drawTx.hash, status: drawReceipt.status, eventFound: !!getEvent(drawReceipt, 'QRNGRequested') };
  }
} catch (error) {
  drawResult = { skipped: true, reason: error instanceof Error ? error.message : String(error) };
}

const { data: raffleRows } = await supabase
  .from('raffles')
  .select('id,is_active,creator_address,sponsor_address,prize_pool,max_tickets,winner_count,cancellation_tx,rejection_reason')
  .in('id', [created.raffleId, cancelled.raffleId])
  .order('id', { ascending: true });
const { data: claims } = await supabase
  .from('user_task_claims')
  .select('task_id,xp_earned,target_id')
  .in('task_id', [`raffle_create_${created.raffleId}`, buyTaskId])
  .order('task_id', { ascending: true });
const afterStats = await dailyApp.userStats(walletAddress);

log({
  phase: 'final',
  drawResult,
  dbRaffles: raffleRows,
  dbClaims: claims,
  afterPoints: afterStats[0].toString(),
  afterTier: Number(afterStats[3]),
  xpDelta: (afterStats[0] - beforeStats[0]).toString()
});
