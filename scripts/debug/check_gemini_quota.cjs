const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

// Load .env from root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
].filter(Boolean);

async function checkQuota(key, index) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const payload = {
        contents: [{ parts: [{ text: "hi" }] }]
    };

    try {
        const start = Date.now();
        const response = await axios.post(url, payload);
        const duration = Date.now() - start;
        
        if (response.status === 200) {
            console.log(`✅ Key ${index + 1}: ACTIVE (Response in ${duration}ms)`);
            return { status: 'ACTIVE', latency: duration };
        }
    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;
            
            if (status === 429) {
                console.log(`❌ Key ${index + 1}: QUOTA EXCEEDED (429)`);
                return { status: 'QUOTA_EXCEEDED' };
            } else if (status === 401 || status === 403) {
                console.log(`🚫 Key ${index + 1}: INVALID/EXPIRED (${status})`);
                return { status: 'INVALID' };
            } else {
                console.log(`⚠️ Key ${index + 1}: ERROR ${status}`);
                return { status: `ERROR_${status}` };
            }
        } else {
            console.log(`⚠️ Key ${index + 1}: NETWORK ERROR (${error.message})`);
            return { status: 'NETWORK_ERROR' };
        }
    }
}

async function run() {
    console.log("=== GEMINI API QUOTA AUDIT ===");
    console.log(`Total keys found: ${API_KEYS.length}\n`);
    
    for (let i = 0; i < API_KEYS.length; i++) {
        await checkQuota(API_KEYS[i], i);
    }
    console.log("\nAudit Complete.");
}

run();
