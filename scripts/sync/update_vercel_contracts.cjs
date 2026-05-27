/**
 * Update Vercel env vars for new contract addresses (MasterX + Raffle)
 * Uses Clean-Pipe Sync Protocol (spawnSync + stdin)
 */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const CWD = path.join(__dirname, '..', '..', 'Raffle_Frontend');
const ENVS = [
    ['VITE_MASTER_X_ADDRESS',           '0x1b573DdD9a1679505ae64498564523222c758EC2'],
    ['VITE_MASTER_X_ADDRESS_SEPOLIA',   '0x1b573DdD9a1679505ae64498564523222c758EC2'],
    ['MASTER_X_ADDRESS',                '0x1b573DdD9a1679505ae64498564523222c758EC2'],
    ['MASTER_X_ADDRESS_SEPOLIA',        '0x1b573DdD9a1679505ae64498564523222c758EC2'],
    ['NEXT_PUBLIC_MASTER_X_ADDRESS',    '0x1b573DdD9a1679505ae64498564523222c758EC2'],
    ['VITE_RAFFLE_ADDRESS',             '0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7'],
    ['VITE_RAFFLE_ADDRESS_SEPOLIA',     '0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7'],
    ['RAFFLE_ADDRESS',                  '0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7'],
    ['RAFFLE_ADDRESS_SEPOLIA',          '0xaE8fe1d4D566D438a7ac410c4bE23daD94Fe85B7'],
];

const TARGETS = ['production', 'preview', 'development'];

let ok = 0, fail = 0;

for (const [key, val] of ENVS) {
    // 1. Remove existing (per environment, pipe 'y' to confirm)
    for (const target of TARGETS) {
        spawnSync('vercel', ['env', 'rm', key, target], {
            cwd: CWD, shell: true, encoding: 'utf8',
            input: 'y\n', timeout: 10000,
        });
    }

    // 2. Add new value per environment (CLI only accepts one target at a time)
    let added = 0;
    for (const target of TARGETS) {
        const r = spawnSync('vercel', ['env', 'add', key, target], {
            cwd: CWD, shell: true, encoding: 'utf8',
            input: val + '\n', timeout: 15000,
        });
        const out = (r.stdout || '') + (r.stderr || '');
        if (r.status === 0 || out.includes('Added')) added++;
    }
    if (added > 0) {
        console.log(`✅ ${key} = ${val.slice(0,10)}... (${added}/${TARGETS.length} envs)`);
        ok++;
    } else {
        console.error(`❌ ${key}: failed all environments`);
        fail++;
    }
}

console.log(`\n=== Done: ${ok} ✅  ${fail} ❌ ===`);
if (fail === 0) console.log('All contract addresses updated. Run: vercel redeploy <url>');
