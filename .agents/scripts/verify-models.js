import axios from 'axios';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const configPath = path.join(process.cwd(), '.agents', 'config', 'nexus-routing.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function checkGemini() {
    const key = process.env.GEMINI_API_KEY;
    try {
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        console.log('✅ Gemini API: Reachable');
        return true;
    } catch (error) {
        console.error('❌ Gemini API: Unreachable', error.message);
        return false;
    }
}

async function checkLocalModel(endpoint, modelName) {
    try {
        const response = await axios.get(`${endpoint}/api/tags`);
        const models = response.data.models || [];
        const exists = models.some(m => m.name.toLowerCase().includes(modelName.toLowerCase()));
        if (exists) {
            console.log(`✅ ${modelName} (Ollama): Found at ${endpoint}`);
            return true;
        } else {
            console.log(`⚠️ ${modelName} (Ollama): Endpoint reachable but model not found at ${endpoint}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ ${modelName} (Ollama): Unreachable at ${endpoint}`);
        return false;
    }
}

async function verifyAll() {
    console.log('🔍 Starting Multi-LLM Verification...');
    console.log('-----------------------------------');

    const geminiOk = await checkGemini();

    let ollamaStatus = {};
    for (const entry of config.routing_config.priority_order) {
        if (entry.provider === 'ollama') {
            const ok = await checkLocalModel(entry.endpoint, entry.model);
            ollamaStatus[entry.model] = ok;
        }
    }

    console.log('-----------------------------------');
    console.log('Final Summary:');
    console.log(`- Default Model: ${config.routing_config.default_model}`);
    console.log(`- Gemini Status: ${geminiOk ? 'ONLINE' : 'OFFLINE'}`);
    config.routing_config.priority_order.forEach(m => {
        if (m.provider === 'ollama') {
            console.log(`- ${m.model} Status: ${ollamaStatus[m.model] ? 'ONLINE' : 'OFFLINE'}`);
        }
    });
}

verifyAll();
