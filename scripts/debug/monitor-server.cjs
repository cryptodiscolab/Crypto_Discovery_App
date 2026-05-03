const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.MONITOR_PORT || 4000;
const ROOT = path.join(__dirname, '../../tools/nexus-monitor');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    
    // Handle Interactive Agent Commands
    if (req.method === 'POST' && urlPath === '/api/agent') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);

                if (data.prompt && data.prompt.trim() === '/audit') {
                    const { exec } = require('child_process');
                    exec('npm run orchestron', { cwd: path.join(__dirname, '../../') }, (error, stdout, stderr) => {
                        const logs = (stdout || '') + (stderr || '');
                        
                        // Intelligent parsing of the orchestron output
                        const syntaxHasError = logs.includes('Failed (Status') || logs.includes('Syntax Error');
                        const syntaxStatus = logs.includes('PHASE 1') ? (syntaxHasError ? '❌ Error Found' : '✅ Vetted') : '⚠️ Skipped';
                        
                        const secHasError = logs.includes('Secret leaks detected') || logs.includes('leaks found');
                        const secStatus = logs.includes('PHASE 2') ? (secHasError ? '❌ Leaks Detected' : '✅ Secured') : '⚠️ Skipped';
                        
                        const syncFailed = logs.includes('Synchronization Audit failed') || logs.includes('❌ FAIL');
                        const syncStatus = logs.includes('PHASE 3') ? (syncFailed ? '❌ Out of Sync' : '✅ Synced') : '⚠️ Skipped';
                        
                        const vercelFailed = logs.includes('ERROR') || logs.includes('CANCELED');
                        const vercelStatus = logs.includes('PHASE 4') ? (vercelFailed ? '❌ Broken Build' : '✅ Operational') : '⚠️ Skipped';

                        let tableHtml = `
                        <div style="margin-bottom: 8px; color: #00f2ff; font-weight: bold;">NEXUS ORCHESTRON E2E AUDIT REPORT</div>
                        <table class="nexus-table">
                            <thead>
                                <tr><th>Phase</th><th>Agent</th><th>Target</th><th>Result</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>Syntax & Linters</td><td>@qwen</td><td>API & Bundles</td><td>${syntaxStatus}</td></tr>
                                <tr><td>Hygiene & Security</td><td>@openclaw</td><td>Secret Leaks</td><td>${secStatus}</td></tr>
                                <tr><td>Data Integrity</td><td>@deepseek</td><td>Supabase vs Contracts</td><td>${syncStatus}</td></tr>
                                <tr><td>Cloud Pipeline</td><td>System</td><td>Vercel Deployment</td><td>${vercelStatus}</td></tr>
                            </tbody>
                        </table>
                        <div style="margin-top: 8px; font-size: 10px; color: #94a3b8;">Execute <code>npm run orchestron</code> manually for detailed verbose logs.</div>
                        `;
                        
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'ok', response: tableHtml }));
                    });
                    return;
                }
                
                // Direct API calls to ensure lightning fast response and low RAM limits without CLI overhead
                const envStr = fs.readFileSync(path.join(__dirname, '../../.env'), 'utf-8');
                const geminiKeyMatch = envStr.match(/GEMINI_API_KEY=(.+)/);
                const geminiKey = geminiKeyMatch ? geminiKeyMatch[1].trim() : '';

                if (data.agent === 'antigravity') {
                    const https = require('https');
                    const postData = JSON.stringify({ contents: [{ parts: [{ text: "You are Antigravity Agent. Keep response concise and in Indonesian language. Request: " + data.prompt }] }] });
                    const options = {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
                    };
                    const geminiReq = https.request(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, options, (geminiRes) => {
                        let resultBody = '';
                        geminiRes.on('data', chunk => resultBody += chunk);
                        geminiRes.on('end', () => {
                            try {
                                const json = JSON.parse(resultBody);
                                if (json.error) {
                                    // Rule 19: MULTI-LLM ROUTING & FALLBACK SYSTEM
                                    // If Gemini hits Quota (429), fallback to Local Ollama (fallback 1)
                                    if (json.error.code === 429) {
                                        const httpReq = require('http');
                                        const ollamaPostData = JSON.stringify({ model: 'qwen2.5:7b', prompt: data.prompt, stream: false });
                                        const ollamaReq = httpReq.request('http://localhost:11434/api/generate', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(ollamaPostData) }
                                        }, (ollamaRes) => {
                                            let oBody = '';
                                            ollamaRes.on('data', c => oBody += c);
                                            ollamaRes.on('end', () => {
                                                try {
                                                    const oJson = JSON.parse(oBody);
                                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                                    if (oJson.error) {
                                                        res.end(JSON.stringify({ status: 'ok', response: `[FALLBACK] Failed. Ollama Error: ${oJson.error}` }));
                                                    } else {
                                                        res.end(JSON.stringify({ status: 'ok', response: `[FALLBACK] Gemini Limit Exceeded. Qwen2.5 Responds:\n${oJson.response}` }));
                                                    }
                                                } catch(e) {
                                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                                    res.end(JSON.stringify({ status: 'ok', response: `Gemini Error: ${json.error.message}. Fallback Error: ${e.message}` }));
                                                }
                                            });
                                        });
                                        ollamaReq.on('error', () => {
                                            res.writeHead(200, { 'Content-Type': 'application/json' });
                                            res.end(JSON.stringify({ status: 'ok', response: `Gemini Quota Exceeded & Fallback Ollama Offline.\nError: ${json.error.message}` }));
                                        });
                                        ollamaReq.write(ollamaPostData);
                                        ollamaReq.end();
                                    } else {
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ status: 'ok', response: `Gemini API Error: ${json.error.message}` }));
                                    }
                                    return;
                                }
                                const answer = json.candidates[0].content.parts[0].text;
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ status: 'ok', response: answer }));
                            } catch (e) {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ status: 'ok', response: `API Error Payload: ${resultBody.substring(0, 300)}...` }));
                            }
                        });
                    });
                    geminiReq.write(postData);
                    geminiReq.end();
                } else {
                    const httpReq = require('http');
                    const modelName = data.agent === 'qwen' ? 'qwen2.5:7b' : 'gemma:latest';
                    const postData = JSON.stringify({ model: modelName, prompt: data.prompt, stream: false });
                    const ollamaReq = httpReq.request('http://localhost:11434/api/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
                    }, (ollamaRes) => {
                        let resultBody = '';
                        ollamaRes.on('data', chunk => resultBody += chunk);
                        ollamaRes.on('end', () => {
                            try {
                                const json = JSON.parse(resultBody);
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                if (json.error) {
                                    res.end(JSON.stringify({ status: 'ok', response: `Error: ${json.error}` }));
                                } else {
                                    res.end(JSON.stringify({ status: 'ok', response: json.response || "No response" }));
                                }
                            } catch(e) {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ status: 'ok', response: "Ollama Error. Have you pulled the model? " + e.message }));
                            }
                        });
                    });
                    ollamaReq.on('error', (err) => {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'ok', response: "Ollama is not running locally on port 11434." }));
                    });
                    ollamaReq.write(postData);
                    ollamaReq.end();
                }
            } catch (e) {
                res.writeHead(500);
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });
        return;
    }

    // Serve static files for Nexus Monitor
    let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
    
    // Normalize and safety check
    filePath = path.normalize(filePath);
    if (!filePath.startsWith(path.normalize(ROOT))) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.statusCode = 404;
                res.end('Not Found');
            } else {
                res.statusCode = 500;
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`[Nexus Monitor] Server running at http://localhost:${PORT}`);
    console.log(`[Nexus Monitor] Serving from: ${ROOT}`);
});
