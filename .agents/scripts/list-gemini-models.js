import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
const key = process.env.GEMINI_API_KEY;
axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
    .then(r => console.log(JSON.stringify(r.data.models.map(m => m.name), null, 2)))
    .catch(e => console.error(e.response?.data || e.message));
