/**
 * SUPREME OPAQUE BYPASS V4 - THE PROXY CONSTANT
 * We export constants that are actually PROXIES.
 * This prevents Rollup from binding to the internal structure of the ABIs 
 * while maintaining 100% backward compatibility with existing imports.
 */

// @ts-ignore
import abisDataRaw from './abis_data.txt?raw';

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

// ADDRESS GETTERS (Keep these simple)
const getAddr = (key, envKey) => import.meta.env[envKey] || _get()[key];

export const MASTER_X_ADDRESS = getAddr('MASTER_X_ADDRESS', 'VITE_MASTER_X_ADDRESS');
export const DAILY_APP_ADDRESS = getAddr('DAILY_APP_ADDRESS', 'VITE_V12_CONTRACT_ADDRESS');
export const RAFFLE_ADDRESS = getAddr('RAFFLE_ADDRESS', 'VITE_RAFFLE_ADDRESS');
export const CMS_CONTRACT_ADDRESS = getAddr('CMS_CONTRACT_ADDRESS', 'VITE_CMS_CONTRACT_ADDRESS');
export const USDC_ADDRESS = getAddr('USDC_ADDRESS', 'VITE_USDC_ADDRESS');
export const CREATOR_TOKEN_ADDRESS = getAddr('CREATOR_TOKEN_ADDRESS', 'VITE_CREATOR_TOKEN_ADDRESS');

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

// Also provide the ABIS wrap for new code
export const ABIS = {
  DAILY_APP: DAILY_APP_ABI,
  MASTER_X: MASTER_X_ABI,
  RAFFLE: RAFFLE_ABI,
  CMS: CMS_CONTRACT_ABI,
  ERC20: ERC20_ABI
};
