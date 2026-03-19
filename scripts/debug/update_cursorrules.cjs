const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), '.cursorrules');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Version Markers
content = content.replace('Protocol Version: 3.27.0', 'Protocol Version: 3.36.0');
content = content.replace('OpenClaw:3.24.0', 'OpenClaw:3.36.0');

// 2. Inject Section 8.6
const section85 = '### 8.5 ZERO HARDCODE SECRETS MANDATE (CRITICAL - from gemini.md)';
const section86 = `
### 8.6 Anti-Hallucination & Parity Lockdown (v3.36.0)
- **BLACKLISTED ADDRESSES**: Agents are STRICTLY PROHIBITED from using \`0x1ED8B135...\` (Legacy MasterX) or \`0x87a3d120...\` (Legacy DailyApp). Use of these handles triggers a Protocol Breach Level-1.
- **PARITY MANDATE**: Every address MUST be cross-referenced with \`.agents/WORKSPACE_MAP.md\` Registry before use. If an address is missing from the Registry, logic implementation MUST pause.
- **SYNC MANDATE**: \`node scripts/audits/check_sync_status.cjs\` MUST be executed before any code implementation that involves contract logic or environment variables.
`;

if (content.includes(section85) && !content.includes('### 8.6 Anti-Hallucination')) {
    content = content.replace(section85, section85 + section86);
}

// 3. Inject Section 38 (Append)
const section38 = `
## 38. ECOSYSTEM ANTI-HALLUCINATION & SYNC MANDATE (v3.36.0)
- **ANTI-HALLUCINATION LOCKDOWN**: Agents are FORBIDDEN from using any contract address not explicitly documented in the official WORKSPACE_MAP.md registry. If an address is not found, DO NOT invent one; search the repository or ask the user.
- **PRE-FLIGHT SYNC MANDATE**: Before performing any task related to .env, Smart Contracts, or Deployments, agents MUST run \`node scripts/audits/check_sync_status.cjs\`. Any verdict other than ALL SYSTEMS SYNCHRONIZED blocks progress.
- **ZERO-TRUST CONFIG**: Verify environment variable parity (Local vs Vercel) before and after any change. Traceability is mandatory.
`;

if (!content.includes('## 38. ECOSYSTEM ANTI-HALLUCINATION')) {
    content += section38;
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ .cursorrules updated successfully to v3.36.0');
