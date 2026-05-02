#!/usr/bin/env node

/**
 * 🤖 GEMINI AGENT BRIDGE (v1.3.7)
 * Orchestrator: Antigravity
 * Sub-Agent: Official Gemini CLI
 * 
 * Stable-First: Optimized for Gemini 2.5 Flash (180 Total Daily Requests).
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');

// Load environment variables
dotenv.config({ path: path.resolve(rootDir, '.env') });

const API_KEYS = [];
if (process.env.GEMINI_API_KEY) API_KEYS.push(process.env.GEMINI_API_KEY);
for (let i = 2; i <= 20; i++) {
  const key = process.env[`GEMINI_API_KEY_${i}`];
  if (key) API_KEYS.push(key);
}

function orchestrate(userTask) {
  process.stderr.write(`\n[🧠 ORCHESTRATOR] Delegating to Gemini Agent (v1.3.8 - Stable)...\n`);

  const command = process.platform === 'win32' ? 'gemini.cmd' : 'gemini';

  // --- BUILD CONTEXT ---
  let subAgentContext = '';
  const identityPath = path.join(rootDir, '.gemini', 'GEMINI.md');
  const workspaceMapPath = path.join(rootDir, '.agents', 'WORKSPACE_MAP.md');

  if (fs.existsSync(identityPath)) {
    subAgentContext += fs.readFileSync(identityPath, 'utf8') + '\n\n';
  }

  if (fs.existsSync(workspaceMapPath)) {
    subAgentContext += "### PROJECT ARCHITECTURE MAP\n";
    subAgentContext += fs.readFileSync(workspaceMapPath, 'utf8') + '\n\n';
  }

  subAgentContext += "### TASK OBJECTIVE\n";

  const tmpFilePath = path.join(rootDir, '.gemini', 'context.tmp');
  if (!fs.existsSync(path.dirname(tmpFilePath))) {
    fs.mkdirSync(path.dirname(tmpFilePath), { recursive: true });
  }
  fs.writeFileSync(tmpFilePath, subAgentContext, 'utf8');

  // High-Intelligence Priority List (v2.5+)
  const models = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-3.1-pro',
    'gemini-3.1-flash'
  ];

  if (API_KEYS.length === 0) {
    console.log(`[*] No API Keys found. Using OAuth.`);
    return executeCommand(command, tmpFilePath, userTask, process.env, models[0]);
  }

  for (let i = 0; i < API_KEYS.length; i++) {
    const currentKey = API_KEYS[i];

    const env = {
      ...process.env,
      GEMINI_CLI_TRUST_WORKSPACE: 'true',
      GOOGLE_API_KEY: currentKey
    };

    for (const model of models) {
      try {
        process.stderr.write(`[*] Key ${i + 1}/${API_KEYS.length} | Model: ${model}\n`);
        return executeCommand(command, tmpFilePath, userTask, env, model);
      } catch (error) {
        const errorMsg = error.stdout || error.message || "";
        if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('supported')) {
          continue;
        }
        if (errorMsg.includes('Quota exceeded') || errorMsg.includes('429')) {
          process.stderr.write(`    [!] Quota hit for key ${i + 1} on model ${model}.\n`);
          continue; // Try next model with same key
        }
        continue;
      }
    }
  }

  console.error(`\n[❌ ERROR] All API Keys exhausted.`);
  process.exit(1);
}

function executeCommand(command, contextFile, task, env, model) {
  const catCmd = process.platform === 'win32' ? 'type' : 'cat';
  const escapedTask = task.replace(/"/g, '\\"');
  const fullCmd = `${catCmd} "${contextFile}" | ${command} --skip-trust --model ${model} --prompt "${escapedTask}"`;

  const response = execSync(fullCmd, {
    cwd: rootDir,
    env: env,
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 10
  });
  return response.trim();
}

const userPrompt = process.argv.slice(2).join(' ');

if (!userPrompt) {
  console.log("Usage: node gemini_agent_bridge.js \"your prompt\"");
  process.exit(0);
}

const response = orchestrate(userPrompt);
process.stdout.write(response);
