import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const key = process.env.GEMINI_API_KEY;

async function processPendingCloudTasks() {
    const { data: tasks } = await supabase
        .from('agents_vault')
        .select('*')
        .in('target_agent', ['claw', 'deepseek'])
        .eq('status', 'pending');

    if (!tasks || tasks.length === 0) {
        console.log('No pending cloud tasks found.');
        return;
    }

    console.log(`🧠 Processing ${tasks.length} Cloud Tasks...`);

    for (const task of tasks) {
        try {
            console.log(`🤖 [Nexus] Calling Gemini for ${task.target_agent}: ${task.task_name}...`);
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`, {
                contents: [{ parts: [{ text: `Task: ${task.task_name}\n\nDescription: ${task.task_description}` }] }]
            });

            const output = response.data.candidates[0].content.parts[0].text;
            await supabase.from('agents_vault').update({ status: 'completed', output_data: { result: output } }).eq('id', task.id);
            console.log(`✅ Completed: ${task.task_name}`);
        } catch (e) {
            console.error(`❌ Failed: ${task.task_name}`, e.message);
        }
    }
}

processPendingCloudTasks();
