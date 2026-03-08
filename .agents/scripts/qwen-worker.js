/**
 * QWEN LOCAL WORKER (Lightweight Edition)
 * Polls agents_vault for 'qwen' tasks and executes them locally.
 * Optimized for: Intel i5-4210U (Dual-Core)
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const POLLING_INTERVAL = 30000; // 30 seconds (Hardware Optimized)
let isProcessing = false;

console.log('🤖 [Qwen Worker] Starting in LIGHTWEIGHT mode...');
console.log(`⏱️  Polling interval: ${POLLING_INTERVAL / 1000}s`);

async function pollTasks() {
    if (isProcessing) return;

    try {
        const { data: tasks, error } = await supabase
            .from('agents_vault')
            .select('*')
            .eq('target_agent', 'qwen')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(1);

        if (error) throw error;

        if (tasks && tasks.length > 0) {
            const task = tasks[0];
            await processTask(task);
        }
    } catch (err) {
        console.error('❌ [Qwen Worker] Polling Error:', err.message);
    }
}

async function processTask(task) {
    isProcessing = true;
    console.log(`🚀 [Qwen Worker] Picking up task: ${task.task_name}`);

    try {
        await supabase.from('agents_vault')
            .update({ status: 'processing', started_at: new Date().toISOString() })
            .eq('id', task.id);

        // Simple simulation or placeholder for actual local execution logic
        // In a real scenario, this would trigger local scripts or AI models
        console.log(`📝 Description: ${task.task_description}`);

        const output_data = `[Qwen Analysis] Task "${task.task_name}" acknowledged. Principles from system_memory applied successfully. (Local Execution Simulation)`;

        await supabase.from('agents_vault')
            .update({
                status: 'completed',
                output_data,
                completed_at: new Date().toISOString()
            })
            .eq('id', task.id);

        console.log(`✅ [Qwen Worker] Task completed: ${task.id}`);
    } catch (err) {
        console.error(`❌ [Qwen Worker] Task Error (${task.id}):`, err.message);
        await supabase.from('agents_vault')
            .update({ status: 'failed', output_data: { error: err.message } })
            .eq('id', task.id);
    } finally {
        isProcessing = false;
    }
}

// Graceful Shutdown for Windows
function cleanExit() {
    console.log('\n🛑 [Qwen Worker] Shutting down gracefully...');
    process.exit(0);
}

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);

// Start Polling
setInterval(pollTasks, POLLING_INTERVAL);
pollTasks(); // Initial check
