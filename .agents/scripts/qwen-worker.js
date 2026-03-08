/**
 * QWEN LOCAL WORKER (Ollama Edition)
 * Polls agents_vault for 'qwen' tasks and executes them using local Ollama.
 * Optimized for: Intel i5-4210U (Dual-Core)
 */
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Load Routing Config
const configPath = path.join(process.cwd(), '.agents', 'config', 'nexus-routing.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const qwenEntry = config.routing_config.priority_order.find(m => m.model.includes('qwen')) || {
    endpoint: 'http://localhost:11434',
    model: 'qwen2.5-coder:1.5b'
};

const POLLING_INTERVAL = 30000; // 30 seconds (Hardware Optimized)
let isProcessing = false;

console.log('🤖 [Qwen Worker] Starting in OLLAMA mode...');
console.log(`🎯 Target Model: ${qwenEntry.model}`);
console.log(`⏱️  Polling interval: ${POLLING_INTERVAL / 1000}s`);

async function callOllama(prompt) {
    const url = `${qwenEntry.endpoint}/api/generate`;
    const payload = { 
        model: qwenEntry.model, 
        prompt: prompt, 
        stream: false,
        options: {
            num_thread: 2 // Optimized for Dual-Core i5-4210U
        }
    };
    const response = await axios.post(url, payload);
    return response.data.response;
}

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
    console.log(`🚀 [Qwen Worker] Executing task: ${task.task_name}`);

    try {
        await supabase.from('agents_vault')
            .update({ status: 'processing', started_at: new Date().toISOString() })
            .eq('id', task.id);

        console.log(`🧠 Inferencing with Ollama...`);
        const output_data = await callOllama(task.task_description);

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
