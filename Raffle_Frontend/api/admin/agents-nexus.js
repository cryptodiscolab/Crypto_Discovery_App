import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Loads .cursorrules and SKILL.md to provide shared context/principles for sub-agents.
 */
async function getSystemMemory() {
    try {
        const rootPath = path.resolve(process.cwd(), '..'); // From api/admin/ to root
        const cursorrulesPath = path.join(rootPath, '.cursorrules');
        const skillPath = path.join(rootPath, '.agents', 'skills', 'ecosystem-sentinel', 'SKILL.md');

        let memory = "### SYSTEM RULES & PRINCIPLES (MANDATORY)\n";

        if (fs.existsSync(cursorrulesPath)) {
            const rules = fs.readFileSync(cursorrulesPath, 'utf8');
            memory += `\n--- .cursorrules ---\n${rules}\n`;
        }

        if (fs.existsSync(skillPath)) {
            const skill = fs.readFileSync(skillPath, 'utf8');
            memory += `\n--- SKILL.md (Hardware & Performance) ---\n${skill}\n`;
        }

        return memory;
    } catch (error) {
        console.warn('⚠️ [Nexus] Failed to load system memory:', error.message);
        return "";
    }
}

/**
 * AGENT NEXUS DISPATCHER
 * Routes tasks to specialized sub-agents (OpenClaw, Qwen, DeepSeek).
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const {
        wallet_address,
        signature,
        message,
        task_name,
        task_description,
        target_agent,
        input_data = {}
    } = req.body;

    try {
        // 1. Security: Verify Admin Signature
        const valid = await verifyMessage({ address: wallet_address, message, signature });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        // 2. Authorization: Check if Admin
        const { data: isAdmin } = await supabaseAdmin.rpc('is_admin_wallet', { wallet: wallet_address });
        if (!isAdmin) return res.status(403).json({ error: 'Unauthorized: Admin only' });

        // Load System Principles
        const systemMemory = await getSystemMemory();

        // 3. Create Task in agents_vault
        const { data: task, error: taskError } = await supabaseAdmin
            .from('agents_vault')
            .insert({
                task_name,
                task_description,
                target_agent,
                status: (target_agent === 'qwen' ? 'pending' : 'processing'),
                input_data: { ...input_data, system_memory: systemMemory },
                requested_by_wallet: wallet_address.toLowerCase()
            })
            .select()
            .single();

        if (taskError) throw taskError;

        // 4. Handle Cloud Agents (Claw & DeepSeek)
        if (target_agent === 'claw' || target_agent === 'deepseek') {
            processCloudAgent(task, systemMemory);
        }

        // 5. Return Response
        return res.status(200).json({
            success: true,
            message: `Task dispatched to ${target_agent} with System Memory enabled.`,
            task_id: task.id
        });

    } catch (error) {
        console.error('[AgentsNexus Error]', error);
        return res.status(500).json({ error: error.message });
    }
}

/**
 * Internal logic for Cloud Agents (FREE & UNLIMITED)
 */
async function processCloudAgent(task, systemMemory) {
    let output_data = {};
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
        console.error('❌ [Nexus] CRITICAL: GEMINI_API_KEY is missing.');
        output_data = { error: 'Nexus Engine Configuration Error' };
        await supabaseAdmin.from('agents_vault').update({ status: 'failed', output_data }).eq('id', task.id);
        return;
    }

    const MODELS = [
        'gemini-2.0-flash',
        'gemini-1.5-flash-latest'
    ];

    const prompt = `${systemMemory}\n\n### CURRENT TASK\nAgent: ${task.target_agent.toUpperCase()}\nTask: ${task.task_name}\nDescription: ${task.task_description}`;

    for (const modelId of MODELS) {
        try {
            console.log(`🤖 [Nexus] Dispatched with System Memory to: ${modelId}`);
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`, {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 }
            });

            output_data = response.data.candidates[0].content.parts[0].text;
            console.log(`✅ [Nexus] Task completed by ${modelId}`);
            break;

        } catch (error) {
            console.warn(`⚠️ [Nexus] ${modelId} failed. Trying fallback...`);
            output_data = { error: error.message };
        }
    }

    await supabaseAdmin.from('agents_vault')
        .update({ status: (output_data.error ? 'failed' : 'completed'), output_data })
        .eq('id', task.id);
}
