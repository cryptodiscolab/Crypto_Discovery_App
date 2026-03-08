import axios from 'axios';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const configPath = path.join(process.cwd(), '.agents', 'config', 'nexus-routing.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const prompt = "Explain 'Zero Riba' in one sentence.";

async function callGemini(model, forceFail = false) {
    if (forceFail) throw new Error("Simulated Quota Exceeded / Timeout");
    const key = process.env.GEMINI_API_KEY;
    const modelName = model.startsWith('models/') ? model : `models/${model}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${key}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    const response = await axios.post(url, payload);
    return response.data.candidates[0].content.parts[0].text;
}

async function callOllama(endpoint, model, forceFail = false) {
    if (forceFail) throw new Error(`Simulated Local Failure for ${model}`);
    const url = `${endpoint}/api/generate`;
    const payload = { model, prompt, stream: false };
    const response = await axios.post(url, payload);
    return response.data.response;
}

async function runTest(simulateGeminiFail = false, simulateQwenFail = false) {
    console.log(`\n🚀 Starting Fallback Test (Gemini Fail: ${simulateGeminiFail}, Qwen Fail: ${simulateQwenFail})`);
    console.log(`📝 Prompt: "${prompt}"`);
    console.log('-----------------------------------');

    let currentPriority = 0;
    const priorities = config.routing_config.priority_order;

    while (currentPriority < priorities.length) {
        const entry = priorities[currentPriority];
        console.log(`🔄 Attempting [${entry.provider}] using ${entry.model}...`);

        try {
            let result;
            if (entry.provider === 'google') {
                result = await callGemini(entry.model, simulateGeminiFail);
            } else if (entry.provider === 'ollama') {
                const failThis = (entry.model.includes('qwen') && simulateQwenFail);
                result = await callOllama(entry.endpoint, entry.model, failThis);
            }

            console.log(`✅ SUCCESS [${entry.model}]: ${result.trim()}`);
            return;
        } catch (error) {
            console.error(`❌ FAILED [${entry.model}]: ${error.message}`);
            currentPriority++;
            if (currentPriority < priorities.length) {
                console.log(`📡 Falling back to priority ${currentPriority + 1}...`);
            }
        }
    }

    console.log('💀 CRITICAL: All models failed.');
}

async function main() {
    // Test 1: Normal Flow (Gemini should work)
    await runTest(false, false);

    // Test 2: Gemini Fallback to Qwen
    await runTest(true, false);

    // Test 3: Gemini & Qwen Fallback to DeepSeek
    await runTest(true, true);
}

main();
