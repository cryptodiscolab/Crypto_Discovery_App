/**
 * SUPREME OPAQUE BYPASS V4 - THE PROXY CONSTANT
 * We export constants that are actually PROXIES.
 * This prevents Rollup from binding to the internal structure of the ABIs 
 * while maintaining 100% backward compatibility with existing imports.
 */

// @ts-ignore
import abisDataRaw from './abis_data.txt?raw';
import { getAddress } from 'viem';

let _cache = null;
const _get = () => {
  if (!_cache) {
    try {
      _cache = JSON.parse(abisDataRaw);
    } catch (e) {
      console.error("Critical: Failed to parse ABIs", e);
      return { ABIS: { DAILY_APP: [], MASTER_X: [], RAFFLE: [], CMS: [], CHAINLINK: [], ERC20: [] } };
    }
  }
  return _cache;
};

// Helper to create a proxy that acts like an array but only loads on access
const createAbiProxy = (name) => {
  return new Proxy([], {
    get: (target, prop) => {
      const realAbi = _get().ABIS[name] || [];
      const value = realAbi[prop];
      return typeof value === 'function' ? value.bind(realAbi) : value;
    },
    getOwnPropertyDescriptor: (target, prop) => {
      const realAbi = _get().ABIS[name] || [];
      return Object.getOwnPropertyDescriptor(realAbi, prop);
    },
    ownKeys: (target) => {
      const realAbi = _get().ABIS[name] || [];
      return Reflect.ownKeys(realAbi);
    }
  });
};

// ADDRESS SELECTION LOGIC
const chainId = parseInt(import.meta.env.VITE_CHAIN_ID || '8453');
const isSepolia = chainId === 84532;

const cleanAddr = (addr) => {
  if (!addr || typeof addr !== 'string') return undefined;
  
  let cleaned = addr.replace(/["'\s\r\n\t\0]/g, '').trim();
  
  // 🛡️ Anti-Parsing Drift: Strip any "KEY=" prefix if it accidentally leaked from .env
  if (cleaned.includes('=')) {
    const parts = cleaned.split('=');
    cleaned = parts[parts.length - 1];
  }

  // 🛡️ Reject placeholder/reserved values — fall through to Sepolia fallback
  if (!cleaned || cleaned === '[RESERVED]' || cleaned === 'undefined' || cleaned === 'null' || cleaned.length < 42) {
    return undefined;
  }

  // 🛡️ Auto-normalize EIP-55 checksum (fixes mixed-case addresses from .env)
  try {
    return getAddress(cleaned);
  } catch {
    console.warn(`[contracts] Invalid address format: ${cleaned}`);
    return undefined;
  }
};

const getAddr = (key, envKey, envKeySepolia) => {
  let addr;
  if (isSepolia && envKeySepolia) {
    addr = import.meta.env[envKeySepolia] 
      || _get().ABIS[key + '_SEPOLIA'] 
      || _get()[key + '_SEPOLIA']
      || _get()[key + '_ADDRESS_SEPOLIA']
      || _get()[key + '_CONTRACT_ADDRESS_SEPOLIA'];
  } else {
    addr = import.meta.env[envKey] 
      || _get()[key] 
      || _get()[key + '_ADDRESS'] 
      || _get()[key + '_CONTRACT_ADDRESS'];
  }
  
  const resolved = cleanAddr(addr);
  
  // 🛡️ Mainnet Fallback: If Mainnet address is [RESERVED]/missing, fall back to Sepolia for dev/preview
  if (!resolved && !isSepolia && envKeySepolia) {
    const sepoliaAddr = import.meta.env[envKeySepolia];
    const sepoliaResolved = cleanAddr(sepoliaAddr);
    if (sepoliaResolved) {
      console.warn(`[contracts] Mainnet address for ${key} is RESERVED. Using Sepolia fallback for non-production preview.`);
      return sepoliaResolved;
    }
  }
  
  return resolved;
};

export const MASTER_X_ADDRESS = getAddr('MASTER_X', 'VITE_MASTER_X_ADDRESS', 'VITE_MASTER_X_ADDRESS_SEPOLIA');
export const DAILY_APP_ADDRESS = getAddr('DAILY_APP', 'VITE_V12_CONTRACT_ADDRESS', 'VITE_V12_CONTRACT_ADDRESS_SEPOLIA');
export const RAFFLE_ADDRESS = getAddr('RAFFLE', 'VITE_RAFFLE_ADDRESS', 'VITE_RAFFLE_ADDRESS_SEPOLIA');
export const CMS_CONTRACT_ADDRESS = getAddr('CMS', 'VITE_CMS_CONTRACT_ADDRESS', 'VITE_CMS_CONTRACT_ADDRESS_SEPOLIA');
export const USDC_ADDRESS = getAddr('USDC', 'VITE_USDC_ADDRESS', 'VITE_USDC_ADDRESS_SEPOLIA');
export const CREATOR_TOKEN_ADDRESS = getAddr('CREATOR_TOKEN', 'VITE_CREATOR_TOKEN_ADDRESS');
export const PRICE_FEED_ADDRESS = cleanAddr(import.meta.env.VITE_PRICE_FEED_ADDRESS);
export const SAFE_MULTISIG = cleanAddr(import.meta.env.VITE_SAFE_MULTISIG);

// Removed purely static Admin constants to prevent them from being bundled in the frontend.

// PROXY CONSTANTS (The "Cheat Code")
export const DAILY_APP_ABI = createAbiProxy('DAILY_APP');
export const MASTER_X_ABI = createAbiProxy('MASTER_X');
export const RAFFLE_ABI = createAbiProxy('RAFFLE');
export const CMS_CONTRACT_ABI = createAbiProxy('CMS');
export const CHAINLINK_ORACLE_ABI = createAbiProxy('CHAINLINK');
export const ERC20_ABI = createAbiProxy('ERC20');

// Aliases
export const V12_ABI = DAILY_APP_ABI;
export const DISCO_MASTER_ABI = MASTER_X_ABI;

export const CONTRACTS = {
  MASTER_X: MASTER_X_ADDRESS,
  DAILY_APP: DAILY_APP_ADDRESS,
  RAFFLE: RAFFLE_ADDRESS,
  CMS: CMS_CONTRACT_ADDRESS,
  USDC: USDC_ADDRESS,
  CREATOR_TOKEN: CREATOR_TOKEN_ADDRESS
};

// 🛡️ Zero-Hardcode Constants
export const TASK_IDS = {
  REFERRAL_INVITE: '77e123f5-0ded-4ca1-af04-e8b6924823e2',
  DAILY_CLAIM_STREAK: '288596d8-b5a9-4faf-bde0-0dd28aaba902',
  DAILY_CLAIM_REWARD: '885535d2-4c5c-4a80-9af5-36666192c244',
  REFERRAL_XP: '12e123f5-0ded-4ca1-af04-e8b6924823e2',
  ONCHAIN_TASK: '885535d2-4c5c-4a80-9af5-36666192c244',
  TIER_UPGRADE: '2c1e23f5-0ded-4ca1-af04-e8b6924823e2',
  UNDERDOG_BONUS: 'underdog_bonus_multiplier_bp'
};

export const APP_CONFIG = {
  FARCASTER_REFERRAL: import.meta.env.VITE_FARCASTER_REFERRAL || 'https://farcaster.xyz/~/code/default',
  SOCIAL_INDEX_DELAY_SEC: 30,
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
  EXPLORER_URL: import.meta.env.VITE_EXPLORER_URL || 'https://sepolia.basescan.org',
  FEES: {
    // [LEGACY] These are fallback values. Use RAFFLE contract's maintenanceFeeBP and surchargeBP instead.
    SURCHARGE_BP: 500, // 5%
    RAKE_BP: 2000     // 20%
  },
  PROFILE: {
    MAX_NAME_LEN: Number(import.meta.env.VITE_MAX_NAME_LEN || 50),
    MAX_BIO_LEN: Number(import.meta.env.VITE_MAX_BIO_LEN || 160),
    MAX_USERNAME_LEN: Number(import.meta.env.VITE_MAX_USERNAME_LEN || 30),
    MAX_AVATAR_BYTES: Number(import.meta.env.VITE_MAX_AVATAR_BYTES || 1048576) // 1MB
  },
  STREAK: {
    WINDOW_MIN_HOURS: Number(import.meta.env.VITE_STREAK_WINDOW_MIN || 20),
    WINDOW_MAX_HOURS: Number(import.meta.env.VITE_STREAK_WINDOW_MAX || 48)
  }
};

// Also provide the ABIS wrap for new code
export const ABIS = {
  DAILY_APP: DAILY_APP_ABI,
  MASTER_X: MASTER_X_ABI,
  RAFFLE: RAFFLE_ABI,
  CMS: CMS_CONTRACT_ABI,
  ERC20: ERC20_ABI
};
