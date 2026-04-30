#!/usr/bin/env node

/**
 * 🤖 GEMINI AGENT BRIDGE (v1.0.0)
 * Orchestrator: Antigravity
 * Sub-Agent: Official Gemini CLI
 * 
 * Tool ini memungkinkan Antigravity untuk mendelegasikan tugas ke Gemini CLI
 * dengan menyuntikkan trust workspace dan context secara otomatis.
 */

import { spawnSync, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');

// Load environment variables
dotenv.config({ path: path.resolve(rootDir, '.env') });

const API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3
].filter(Boolean);

function orchestrate(prompt) {
  console.log(`\n[🧠 ORCHESTRATOR] Delegating to Gemini Agent...`);
  
  const command = process.platform === 'win32' ? 'gemini.cmd' : 'gemini';

  // Jika tidak ada API Key, gunakan mode default (OAuth)
  if (API_KEYS.length === 0) {
    console.log(`[*] No API Keys found in .env. Using default OAuth session.`);
    return executeCommand(command, prompt, process.env);
  }

  // Coba setiap API Key hingga berhasil
  for (let i = 0; i < API_KEYS.length; i++) {
    const currentKey = API_KEYS[i];
    console.log(`[*] Trying API Key ${i + 1}/${API_KEYS.length}...`);

    const env = { 
      ...process.env, 
      GEMINI_CLI_TRUST_WORKSPACE: 'true',
      GOOGLE_API_KEY: currentKey // Set key untuk CLI
    };

    try {
      return executeCommand(command, prompt, env);
    } catch (error) {
      const errorMsg = error.stdout || error.message || "";
      if (errorMsg.includes('Quota exceeded') || errorMsg.includes('429')) {
        console.warn(`[!] Key ${i + 1} hit rate limit/quota. Rotating...`);
        continue;
      }
      // Jika error lain, tetap lempar ke atas
      console.error(`\n[❌ ERROR] Command Execution Failed:`);
      console.error(errorMsg);
      process.exit(1);
    }
  }

  console.error(`\n[❌ ERROR] All API Keys exhausted or hit quota limits.`);
  process.exit(1);
}

function executeCommand(command, prompt, env) {
  const response = execSync(`${command} --prompt "${prompt.replace(/"/g, '\\"')}"`, {
    cwd: rootDir,
    env: env,
    encoding: 'utf-8'
  });
  return response.trim();
}

const userPrompt = process.argv.slice(2).join(' ');

if (!userPrompt) {
  console.log("Usage: node gemini_agent_bridge.js \"your prompt\"");
  process.exit(0);
}

const response = orchestrate(userPrompt);
console.log(`\n[🤖 GEMINI AGENT RESPONSE]:\n`);
console.log(response);
console.log(`\n[✅ DELEGATION COMPLETE]`);
