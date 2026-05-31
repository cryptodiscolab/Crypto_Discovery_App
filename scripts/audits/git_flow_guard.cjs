#!/usr/bin/env node
'use strict';

const { execSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

const PROTECTED_BRANCHES = new Set(['main', 'master', 'develop']);
const ALLOWED_BRANCH_PATTERN = /^(feature\/[a-z0-9][a-z0-9._-]*|bugfix\/(?:[0-9]+[a-z0-9._-]*|[a-z0-9][a-z0-9._-]*))$/i;
const VALID_BASE_BRANCHES = new Set(['main', 'develop']);

function run(command) {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function fail(message, details = []) {
  console.error(`\n[GitFlowGuard] BLOCKED: ${message}`);
  for (const detail of details) console.error(`- ${detail}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[GitFlowGuard] OK: ${message}`);
}

function getCurrentBranch() {
  const branch = run('git rev-parse --abbrev-ref HEAD');
  return branch === 'HEAD' ? '' : branch;
}

function assertWorkingBranch(branch) {
  if (!branch) {
    ok('Detached HEAD detected; local branch-name guard skipped.');
    return;
  }

  if (PROTECTED_BRANCHES.has(branch)) {
    fail(`direct commits on ${branch} are prohibited`, [
      'Create a working branch first: git switch -c feature/nama-fitur',
      'Bug fixes must use: git switch -c bugfix/123-short-description',
      'All changes must enter develop/main through a reviewed PR.'
    ]);
  }

  if (!ALLOWED_BRANCH_PATTERN.test(branch)) {
    fail(`branch "${branch}" does not match the strict strategy`, [
      'Allowed: feature/nama-fitur',
      'Allowed: bugfix/123-short-description',
      'Use lowercase kebab-case or snake_case after the slash.'
    ]);
  }

  ok(`branch "${branch}" follows strict Git Flow.`);
}

function readGithubEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return null;
  try {
    return JSON.parse(readFileSync(eventPath, 'utf8'));
  } catch {
    return null;
  }
}

function assertPullRequest() {
  const eventName = process.env.GITHUB_EVENT_NAME || '';
  if (eventName === 'push') {
    const ref = (process.env.GITHUB_REF_NAME || '').trim();
    if (PROTECTED_BRANCHES.has(ref)) {
      fail(`direct push to ${ref} is prohibited`, [
        'Enable GitHub branch protection/rulesets for main and develop.',
        'Require the Strict Git Flow / Required Tests status check before merge.'
      ]);
    }
    ok(`push event on ${ref || 'unknown'} is not a protected direct push.`);
    return;
  }

  if (!eventName.startsWith('pull_request') && eventName !== 'merge_group') {
    ok(`event "${eventName || 'local'}" has no PR branch guard.`);
    return;
  }

  const event = readGithubEvent();
  const base = process.env.GITHUB_BASE_REF || event?.pull_request?.base?.ref || '';
  const head = process.env.GITHUB_HEAD_REF || event?.pull_request?.head?.ref || '';

  if (!VALID_BASE_BRANCHES.has(base)) {
    fail(`PR base "${base}" is not allowed`, [
      'PRs may target only develop or main.',
      'Feature work should normally target develop first.'
    ]);
  }

  if (PROTECTED_BRANCHES.has(head)) {
    fail(`PR head "${head}" cannot be a protected branch`, [
      'Open PRs from feature/* or bugfix/* branches only.'
    ]);
  }

  if (!ALLOWED_BRANCH_PATTERN.test(head)) {
    fail(`PR head "${head}" does not match feature/* or bugfix/*`, [
      'Allowed: feature/nama-fitur',
      'Allowed: bugfix/123-short-description'
    ]);
  }

  ok(`PR ${head} -> ${base} follows strict Git Flow.`);
}

const args = new Set(process.argv.slice(2));

if (args.has('--ci-pr')) {
  assertPullRequest();
} else {
  assertWorkingBranch(getCurrentBranch());
}
