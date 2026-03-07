/**
 * AUTO-SENTINEL: Proactive Ecosystem Auditor
 * This script automates the detection of synchronization issues and 
 * triggers Multi-Agent Nexus tasks without manual intervention.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_WALLET = '0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B';

async function runAutoSentinel() {
    console.log('🛡️  Starting Proactive Protocol Enforcement...');

    try {
        // 1. PROTOCOL: SYNC VERIFICATION
        console.log('🔍 [Protocol: Sync] Running cross-module verification...');
        const syncStatus = execSync('node .agents/skills/ecosystem-sentinel/scripts/sync-check.js').toString();

        if (syncStatus.includes('❌') || syncStatus.includes('failed')) {
            console.warn('⚠️  SYNC BREACH! Triggering Emergency Audit...');
            await dispatchTask('claw', 'Sync Protocol Breach', `Kritis: Sinkronisasi antar modul gagal. Audit .env, ABI, dan Kontrak segera.\nLog:\n${syncStatus}`);
        } else {
            console.log('✅ Sync Protocol: Compliant');
        }

        // 2. PROTOCOL: SECURITY PULSE (OpenClaw)
        console.log('🔍 [Protocol: Security] Running Live API/RLS Audit...');
        await dispatchTask('claw', 'Security Protocol Pulse', 'Audit endpoint API /api/admin/* dan kebijakan RLS Supabase terhadap standar Zero-Trust.');

        // 3. PROTOCOL: STABILITY & BUILD (Qwen)
        console.log('🔍 [Protocol: Stability] Running Build Lifecycle Guard...');
        await dispatchTask('qwen', 'Build Protocol Check', 'Validasi stabilitas project dengan npm run build. Pastikan tidak ada warning kritis pada produksi.');

        // 4. PROTOCOL: VERSIONING (DeepSeek)
        console.log('🔍 [Protocol: Version] Running Content CMS Sync...');
        await dispatchTask('deepseek', 'CMS Protocol Audit', 'Audit sinkronisasi versi konten antara database dan Content CMS contract.');

    } catch (error) {
        console.error('❌ Protocol Enforcement Error:', error.message);
    }
}

async function dispatchTask(agent, name, description) {
    const { data, error } = await supabase
        .from('agents_vault')
        .insert({
            task_name: `[AUTO] ${name}`,
            task_description: description,
            target_agent: agent,
            status: 'pending',
            requested_by_wallet: ADMIN_WALLET.toLowerCase()
        })
        .select()
        .single();

    if (error) console.error(`  ❌ Failed to dispatch to ${agent}:`, error.message);
    else console.log(`  🚀 Dispatched [${name}] to ${agent} (Task ID: ${data.id})`);
}

runAutoSentinel();
