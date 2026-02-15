import ABIS from './abis.json';

// Standardized JSON ABIs for reliable contract interaction
// Isolated in abis.json to prevent Rollup traceVariable stack issues
export const { DISCO_MASTER_ABI, CMS_CONTRACT_ABI, RAFFLE_ABI, USDC_ABI, DISCO_TOKEN_ABI } = ABIS;

// Legacy aliases or secondary exports if needed
export const V12_ABI = DISCO_MASTER_ABI; // assuming V12 used the same ABI based on previous context
export const CHAINLINK_ORACLE_ABI = ABIS.CHAINLINK_ORACLE_ABI || [];
