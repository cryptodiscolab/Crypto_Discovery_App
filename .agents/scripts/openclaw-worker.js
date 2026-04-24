/**
 * OPENCLAW LOCAL WORKER (Ollama Edition)
 * Polls agents_vault for 'openclaw' tasks and executes them using the local OpenClaw Ollama model.
 * Version: 3.13.0
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

const POLLING_INTERVAL = 30000; 
let isProcessing = false;

console.log('🛡️ [OpenClaw Worker] Starting in OLLAMA mode (v3.13.0)...');
console.log('🎯 Target Model: OpenClaw');

async function sendHeartbeat() {
    try {
        await supabase.from('system_settings')
            .upsert({ 
                key: 'heartbeat_openclaw', 
                value: new Date().toISOString() 
            }, { onConflict: 'key' });
    } catch (err) {
        console.error('❌ [Heartbeat] Fail:', err.message);
    }
}

// Initial heartbeat and interval
sendHeartbeat();
setInterval(sendHeartbeat, 45000); // Every 45s

async function callOllama(prompt) {
    const url = 'http://localhost:11434/api/generate';
    const payload = {
        model: 'OpenClaw',
        prompt: prompt,
        stream: false,
        options: {
            num_thread: 2 // Optimized for Dual-Core i5-4210U
        },
        timeout: 120000 // 120s for deep security auditing
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
            .in('target_agent', ['openclaw', 'claw'])
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(1);

        if (error) throw error;

        if (tasks && tasks.length > 0) {
            const task = tasks[0];
            await processTask(task);
        }
    } catch (err) {
        console.error('❌ [OpenClaw Worker] Polling Error:', err.message);
    }
}

async function processTask(task) {
    isProcessing = true;
    console.log(`🚀 [OpenClaw Worker] Auditing task: ${task.task_name}`);

    try {
        await supabase.from('agents_vault')
            .update({ status: 'processing', started_at: new Date().toISOString() })
            .eq('id', task.id);

        console.log(`🔍 Performing Security Audit with OpenClaw...`);
        const output_data = await callOllama(task.task_description);

        await supabase.from('agents_vault')
            .update({
                status: 'completed',
                output_data,
                completed_at: new Date().toISOString()
            })
            .eq('id', task.id);

        console.log(`✅ [OpenClaw Worker] Audit completed: ${task.id}`);
    } catch (err) {
        console.error(`❌ [OpenClaw Worker] Audit Error (${task.id}):`, err.message);
        await supabase.from('agents_vault')
            .update({ status: 'failed', output_data: { error: err.message } })
            .eq('id', task.id);
    } finally {
        isProcessing = false;
    }
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

setInterval(pollTasks, POLLING_INTERVAL);
pollTasks();
