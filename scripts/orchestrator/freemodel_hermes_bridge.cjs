#!/usr/bin/env node

/**
 * Freemodel/Hermes bridge for Nexus Orchestron.
 *
 * Uses an OpenAI-compatible chat completions endpoint with key rotation and
 * lightweight local caching to preserve provider limits.
 */
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: false });

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const baseUrl = normalizeBaseUrl(
  process.env.HERMES_FREEMODEL_BASE_URL ||
  process.env.FREEMODEL_BASE_URL ||
  'https://freeaiapikey.com/v1'
);
const model = process.env.HERMES_FREEMODEL_MODEL || process.env.FREEMODEL_MODEL || 'gpt-5-mini';
const timeoutMs = Number(process.env.HERMES_FREEMODEL_TIMEOUT_MS || 90000);
const cacheTtlMs = Number(process.env.HERMES_FREEMODEL_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
const cacheDir = path.join(rootDir, 'scratch', 'orchestron-freemodel-cache');

const apiKeys = [...new Set([
  process.env.FREEMODEL_API_KEY,
  process.env.FREEMODEL_API_KEY_2,
  process.env.AICLAIR_FREEMODEL_API_KEY,
  process.env.NEST_FREEMODEL_API_KEY,
].filter(Boolean))];

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function buildPrompt(userTask) {
  const identity = readIfExists(path.join(rootDir, '.gemini', 'GEMINI.md'));
  const workspaceMap = readIfExists(path.join(rootDir, '.agents', 'WORKSPACE_MAP.md'));

  return [
    identity,
    workspaceMap ? `### PROJECT ARCHITECTURE MAP\n${workspaceMap}` : '',
    `### TASK OBJECTIVE\n${userTask}`,
  ].filter(Boolean).join('\n\n');
}

function cachePathFor(prompt) {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ baseUrl, model, prompt }))
    .digest('hex');
  return path.join(cacheDir, `${hash}.json`);
}

function readCache(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const cached = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (Date.now() - cached.createdAt > cacheTtlMs) return null;
  return cached.content;
}

function writeCache(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ createdAt: Date.now(), content }, null, 2), 'utf8');
}

async function callProvider(apiKey, prompt) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a senior software engineering sub-agent for Nexus Orchestron. Be concise, concrete, and cite file paths when useful.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error?.message || text || response.statusText;
    const error = new Error(`${response.status} ${message}`);
    error.status = response.status;
    throw error;
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Provider returned no assistant message content.');
  return content.trim();
}

async function main() {
  const task = process.argv.slice(2).join(' ').trim();
  if (!task) {
    console.log('Usage: npm run orchestrate-freemodel -- "your task"');
    process.exit(0);
  }

  if (process.env.HERMES_FREEMODEL_DRY_RUN === '1' || process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({
      provider: baseUrl,
      model,
      keyCount: apiKeys.length,
      cacheDir: path.relative(rootDir, cacheDir),
      timeoutMs,
      cacheTtlMs,
    }, null, 2));
    return;
  }

  if (apiKeys.length === 0) {
    console.error('No Freemodel API keys found. Set FREEMODEL_API_KEY and FREEMODEL_API_KEY_2 in .env.');
    process.exit(1);
  }

  const prompt = buildPrompt(task);
  const cacheFile = cachePathFor(prompt);
  const cached = readCache(cacheFile);
  if (cached) {
    process.stderr.write('[freemodel] cache hit; provider request skipped.\n');
    process.stdout.write(cached);
    return;
  }

  for (let index = 0; index < apiKeys.length; index += 1) {
    try {
      process.stderr.write(`[freemodel] trying key ${index + 1}/${apiKeys.length} with model ${model}\n`);
      const content = await callProvider(apiKeys[index], prompt);
      writeCache(cacheFile, content);
      process.stdout.write(content);
      return;
    } catch (error) {
      const retryable = error.status === 429 || error.status >= 500;
      process.stderr.write(`[freemodel] key ${index + 1} failed: ${error.message}\n`);
      if (!retryable && error.status !== 401 && error.status !== 403) break;
    }
  }

  console.error('All Freemodel keys/providers failed or quota was exhausted.');
  process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
