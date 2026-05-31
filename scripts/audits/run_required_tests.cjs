#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

const suites = [
  {
    name: 'Root secret scan',
    command: npmCmd,
    args: ['run', 'gitleaks-check'],
    cwd: '.'
  },
  {
    name: 'Smart contract compile',
    command: npmCmd,
    args: ['run', 'compile:contracts'],
    cwd: '.'
  },
  {
    name: 'Smart contract tests',
    command: npxCmd,
    args: ['hardhat', 'test'],
    cwd: '.'
  },
  {
    name: 'Frontend route and ABI checks',
    command: npmCmd,
    args: ['run', 'audit-checks'],
    cwd: 'Raffle_Frontend'
  },
  {
    name: 'Frontend lint',
    command: npmCmd,
    args: ['run', 'lint'],
    cwd: 'Raffle_Frontend'
  },
  {
    name: 'Frontend production build',
    command: npmCmd,
    args: ['run', 'build'],
    cwd: 'Raffle_Frontend',
    env: { NODE_OPTIONS: '--max-old-space-size=4096' }
  }
];

function runSuite(suite) {
  console.log(`\n[RequiredTests] ${suite.name}`);
  console.log(`[RequiredTests] cwd=${suite.cwd} cmd=${suite.command} ${suite.args.join(' ')}`);

  const result = spawnSync(suite.command, suite.args, {
    cwd: suite.cwd,
    stdio: 'inherit',
    shell: isWindows,
    env: { ...process.env, ...(suite.env || {}) }
  });

  if (result.error) {
    console.error(`[RequiredTests] ERROR: ${result.error.message}`);
    return false;
  }

  if (result.status !== 0) {
    console.error(`[RequiredTests] FAILED: ${suite.name} exited with ${result.status}`);
    return false;
  }

  console.log(`[RequiredTests] PASS: ${suite.name}`);
  return true;
}

console.log('[RequiredTests] Strict pre-merge suite started.');
console.log('[RequiredTests] Agents must run this before coding for baseline, and before PR/merge for regression safety.');

const failed = suites.filter((suite) => !runSuite(suite));

if (failed.length > 0) {
  console.error('\n[RequiredTests] BLOCKED: required suite failed.');
  for (const suite of failed) console.error(`- ${suite.name}`);
  process.exit(1);
}

console.log('\n[RequiredTests] PASS: all required checks completed.');
