require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Initialize Supabase Client with Service Role for secure modifications
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ CRITICAL: Supabase URL or Service Role Key is missing in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("==========================================");
console.log("🤖 NEXUS ORCHESTRON: Multi-Agent Hub");
console.log("==========================================");

/**
 * Executes a shell command synchronously and returns the result
 */
function runCommand(command, args = [], options = {}) {
    console.log(`\n⏳ Running: ${command} ${args.join(' ')}`);
    const result = spawnSync(command, args, { shell: true, encoding: 'utf8', ...options });
    
    if (result.error) {
        console.error(`❌ Execution Failed: ${result.error.message}`);
        return { success: false, output: result.error.message };
    }

    const output = (result.stdout || '') + (result.stderr || '');
    const success = result.status === 0;
    
    if (success) {
         console.log(`✅ Success`);
    } else {
         console.log(`❌ Failed (Status ${result.status})`);
    }

    return { success, output };
}

/**
 * Report finding to Supabase `nexus_agent_reports`
 */
async function reportToNexus(agentRole, errorType, message, targetFile = null) {
     console.log(`\n📡 Reporting to Nexus [${agentRole}]: ${errorType}`);
     
     // First check if an OPEN report for this exact message already exists to avoid spam
     const { data: existing } = await supabase
        .from('nexus_agent_reports')
        .select('id')
        .eq('status', 'OPEN')
        .eq('agent_role', agentRole)
        .eq('error_type', errorType)
        .ilike('message', `%${message.substring(0, 100)}%`)
        .limit(1);

     if (existing && existing.length > 0) {
         console.log(`   └─ ℹ️  Report already exists and is OPEN. Skipping duplicate.`);
         return;
     }

     const { error } = await supabase
        .from('nexus_agent_reports')
        .insert([{
            agent_role: agentRole,
            error_type: errorType,
            message: message,
            target_file: targetFile,
            status: 'OPEN'
        }]);

     if (error) {
         console.error(`   └─ ❌ Failed to report: ${error.message}`);
     } else {
         console.log(`   └─ ✅ Report successfully logged to Nexus Vault.`);
     }
}

/**
 * Resolve OPEN findings in Supabase `nexus_agent_reports`
 */
async function resolveNexusReports(agentRole, errorType, targetFile = null) {
     let query = supabase
        .from('nexus_agent_reports')
        .update({ status: 'RESOLVED' })
        .eq('status', 'OPEN')
        .eq('agent_role', agentRole)
        .eq('error_type', errorType);

     if (targetFile) {
         query = query.eq('target_file', targetFile);
     }

     const { error, data } = await query.select('id');

     if (error) {
         console.error(`   └─ ❌ Failed to resolve reports: ${error.message}`);
     } else if (data && data.length > 0) {
         console.log(`   └─ 🔄 Automatically RESOLVED ${data.length} previously OPEN reports for [${agentRole}]: ${errorType} (${targetFile || 'System'})`);
     }
}


async function runQwenPhase() {
    console.log("\n==========================================");
    console.log("🧠 PHASE 1: Qwen (Syntax & Linter)");
    console.log("==========================================");
    
    // 1. Backend Syntax Checks
    const apiFiles = [
        'Raffle_Frontend/api/user-bundle.js', 
        'Raffle_Frontend/api/admin-bundle.js', 
        'Raffle_Frontend/api/tasks-bundle.js', 
        'verification-server/api/webhook/telegram.js',
        'verification-server/api/cron/lurah-ekosistem.js'
    ];
    for(const file of apiFiles) {
        const fullPath = path.join(__dirname, '../../', file);
        if (fs.existsSync(fullPath)) {
            const res = runCommand('node', ['-c', file]);
            if (!res.success) {
                await reportToNexus('Qwen', 'SYNTAX', `Syntax Error in ${file}:\n${res.output}`, file);
            } else {
                await resolveNexusReports('Qwen', 'SYNTAX', file);
            }
        } else {
            console.log(`⚠️  File not found for syntax check: ${file}`);
        }
    }

    // 2. Frontend Linter
    const lintPath = path.join(__dirname, '../../Raffle_Frontend');
    if (fs.existsSync(lintPath)) {
       const res = runCommand('npm', ['run', 'lint'], { cwd: lintPath });
       if (!res.success) {
           await reportToNexus('Qwen', 'LINT', `Linter Errors found:\n${res.output.substring(0, 1000)}... (truncated)`, 'Raffle_Frontend');
       } else {
           await resolveNexusReports('Qwen', 'LINT', 'Raffle_Frontend');
       }
    } else {
        // Fallback to absolute path or root command if structure differs
        const res = runCommand('npm', ['run', 'lint']);
        if (!res.success) {
            // Check if it's missing script or actual lint error
            if (!res.output.includes('Missing script')) {
                 await reportToNexus('Qwen', 'LINT', `Linter Errors found:\n${res.output.substring(0, 1000)}...`, 'Root');
            }
        }
    }
}

async function runOpenClawPhase() {
    console.log("\n==========================================");
    console.log("🦅 PHASE 2: OpenClaw (Security & Leaks)");
    console.log("==========================================");

    // Gitleaks Audit
    const res = runCommand('npm', ['run', 'gitleaks-check']);
    if (!res.success) {
         if (!res.output.includes('Missing script')) {
            await reportToNexus('OpenClaw', 'SECURITY', `Secret leaks detected:\n${res.output.substring(0, 1000)}...`, 'Repository');
         } else {
             console.log("ℹ️ gitleaks-check script not found in package.json. Skipping.");
         }
    } else {
        await resolveNexusReports('OpenClaw', 'SECURITY', 'Repository');
    }
}

async function runDeepSeekPhase() {
    console.log("\n==========================================");
    console.log("🕵️‍♂️ PHASE 3: DeepSeek (DB Sync & ABIs)");
    console.log("==========================================");

    // Run the main check sync status script
    const syncScript = 'scripts/audits/check_sync_status.cjs';
    if (fs.existsSync(path.join(__dirname, '../../', syncScript))) {
        const res = runCommand('node', [syncScript]);
        if (!res.success || res.output.includes('❌') || res.output.includes('DEGRADED')) {
             await reportToNexus('DeepSeek', 'DATA_SYNC', `Synchronization Audit failed or degraded:\n${res.output.substring(0, 1000)}...`, syncScript);
        } else {
             await resolveNexusReports('DeepSeek', 'DATA_SYNC', syncScript);
        }
    }

    // Run the Verify DB Sync script
    const dbSyncScript = 'scripts/audits/verify-db-sync.cjs';
    if (fs.existsSync(path.join(__dirname, '../../', dbSyncScript))) {
        const res = runCommand('node', [dbSyncScript]);
        if (!res.success || res.output.includes('❌ FAIL')) {
             await reportToNexus('DeepSeek', 'DB_SCHEMA', `Database Schema Validation failed:\n${res.output.substring(0, 1000)}...`, dbSyncScript);
        } else {
             await resolveNexusReports('DeepSeek', 'DB_SCHEMA', dbSyncScript);
        }
    }
}

async function checkVercelDeployment() {
    console.log("\n==========================================");
    console.log("☁️  PHASE 4: Vercel Cloud Integrity");
    console.log("==========================================");
    
    const vercelToken = process.env.VERCEL_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;

    if (!vercelToken) {
        console.log("ℹ️ VERCEL_TOKEN not found. Skipping active cloud deployment check.");
        return;
    }

    try {
        console.log("⏳ Fetching latest deployment status from Vercel...");
        const url = projectId 
            ? `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1`
            : `https://api.vercel.com/v6/deployments?limit=1`;
            
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${vercelToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.deployments && data.deployments.length > 0) {
                const latest = data.deployments[0];
                console.log(`   └─ Latest Status: ${latest.state} (${latest.name})`);
                
                if (latest.state === 'ERROR' || latest.state === 'CANCELED') {
                     await reportToNexus('Sentinel', 'CLOUD_BUILD', `Vercel deployment failed with state: ${latest.state}`, `Deployment: ${latest.uid}`);
                }
            }
        } else {
             console.error(`❌ Failed to fetch Vercel status: ${response.statusText}`);
        }
    } catch (e) {
        console.error(`❌ Error checking Vercel: ${e.message}`);
    }
}

async function executeAll() {
    const startTime = Date.now();
    
    await runQwenPhase();
    await runOpenClawPhase();
    await runDeepSeekPhase();
    await checkVercelDeployment();

    console.log("\n==========================================");
    console.log(`🏁 Orchestron Cycle Complete (${((Date.now() - startTime)/1000).toFixed(2)}s)`);
    console.log("==========================================");
}

executeAll().catch(err => {
    console.error("Fatal Orchestron Error:", err);
    process.exit(1);
});
