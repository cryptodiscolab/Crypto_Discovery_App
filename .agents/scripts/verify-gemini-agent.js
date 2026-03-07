import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function verifyGemini() {
    console.log('🤖 Verifying Gemini 2.0 Flash Engine...');

    if (!GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY not found in .env');
        return;
    }

    try {
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
            contents: [{
                parts: [{ text: "Task Type: CLAW\n\nDescription: Siapa kamu dan apa keahlianmu dalam coding?" }]
            }],
            generationConfig: {
                maxOutputTokens: 512,
                temperature: 0.2
            }
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const output = response.data.candidates[0].content.parts[0].text;
        console.log('✅ Gemini Response Received:');
        console.log('----------------------------');
        console.log(output);
        console.log('----------------------------');
        console.log('🚀 Universal Free Brain is ONLINE and 100% FREE.');

    } catch (error) {
        console.error('❌ Gemini Verification Failed:', error.response?.data || error.message);
    }
}

verifyGemini();
