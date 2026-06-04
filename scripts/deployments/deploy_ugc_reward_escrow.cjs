#!/usr/bin/env node
/* eslint-disable no-console */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ContractFactory, JsonRpcProvider, Wallet } = require('ethers');

const TARGET = 'contracts/UGCRewardEscrow.sol';

function normalizePrivateKey(value, name) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error(`${name} is required`);
  return raw.startsWith('0x') ? raw : `0x${raw}`;
}

function normalizeKey(key) {
  return key.replace(/\\/g, '/').replace(/^\.\//, '');
}

function realForKey(key) {
  return key.startsWith('@')
    ? path.join(process.cwd(), 'node_modules', key)
    : path.join(process.cwd(), key);
}

function resolveImport(importPath, fromKey) {
  if (importPath.startsWith('@')) return normalizeKey(importPath);
  return normalizeKey(path.posix.normalize(path.posix.join(path.posix.dirname(fromKey), importPath)));
}

function collectSources(target) {
  const sources = {};

  function add(key) {
    key = normalizeKey(key);
    if (sources[key]) return;
    const content = fs.readFileSync(realForKey(key), 'utf8');
    sources[key] = { content };

    const re = /import\s+(?:[^";]+\s+from\s+)?["']([^"']+)["']/g;
    let match;
    while ((match = re.exec(content))) add(resolveImport(match[1], key));
  }

  add(target);
  return sources;
}

function compileEscrow() {
  const input = {
    language: 'Solidity',
    sources: collectSources(TARGET),
    settings: {
      optimizer: { enabled: true, runs: 1 },
      viaIR: true,
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  };

  const outputRaw = execFileSync('npx', ['solc@0.8.22', '--standard-json'], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  });
  const jsonStart = outputRaw.indexOf('{');
  if (jsonStart < 0) throw new Error('solc did not return JSON output');

  const output = JSON.parse(outputRaw.slice(jsonStart));
  const errors = (output.errors || []).filter((entry) => entry.severity === 'error');
  if (errors.length) {
    for (const error of errors) console.error(error.formattedMessage || error.message);
    throw new Error('UGCRewardEscrow compile failed');
  }

  const contract = output.contracts?.[TARGET]?.UGCRewardEscrow;
  if (!contract?.abi || !contract?.evm?.bytecode?.object) {
    throw new Error('UGCRewardEscrow artifact missing from solc output');
  }

  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
  };
}

async function main() {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || process.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
  const deployer = new Wallet(normalizePrivateKey(process.env.PRIVATE_KEY, 'PRIVATE_KEY'), new JsonRpcProvider(rpcUrl));
  const authorizer = process.env.UGC_REWARD_ESCROW_AUTHORIZER
    || (process.env.WALLET_BOT_SIGNER ? new Wallet(normalizePrivateKey(process.env.WALLET_BOT_SIGNER, 'WALLET_BOT_SIGNER')).address : deployer.address);
  const admin = process.env.UGC_REWARD_ESCROW_ADMIN || deployer.address;

  const network = await deployer.provider.getNetwork();
  if (network.chainId !== 84532n) {
    throw new Error(`Refusing to deploy escrow to chain ${network.chainId}; expected Base Sepolia 84532`);
  }

  console.log(`network=${network.chainId}`);
  console.log(`deployer=${deployer.address}`);
  console.log(`admin=${admin}`);
  console.log(`authorizer=${authorizer}`);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`deployer_balance_wei=${balance.toString()}`);
  if (balance === 0n) throw new Error('Deployer has zero ETH for gas');

  const { abi, bytecode } = compileEscrow();
  const factory = new ContractFactory(abi, bytecode, deployer);
  const contract = await factory.deploy(admin, authorizer);
  const tx = contract.deploymentTransaction();
  console.log(`deploy_tx=${tx?.hash || 'pending'}`);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const receipt = tx ? await tx.wait(1) : null;

  console.log(`escrow_address=${address}`);
  console.log(`block_number=${receipt?.blockNumber || 'unknown'}`);

  const [defaultAdminRole, authorizerRole, fundManagerRole] = await Promise.all([
    contract.DEFAULT_ADMIN_ROLE(),
    contract.CLAIM_AUTHORIZER_ROLE(),
    contract.FUND_MANAGER_ROLE(),
  ]);
  const [adminOk, authorizerOk, fundManagerOk, maxWindow] = await Promise.all([
    contract.hasRole(defaultAdminRole, admin),
    contract.hasRole(authorizerRole, authorizer),
    contract.hasRole(fundManagerRole, admin),
    contract.MAX_CLAIM_WINDOW(),
  ]);

  console.log(`role_default_admin=${adminOk}`);
  console.log(`role_claim_authorizer=${authorizerOk}`);
  console.log(`role_fund_manager=${fundManagerOk}`);
  console.log(`max_claim_window=${maxWindow.toString()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
