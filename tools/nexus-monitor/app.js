const chatMessages = document.getElementById('chat-messages');
const clearLogBtn = document.getElementById('clear-log');

const agents = {
    antigravity: { name: '@antigravity', role: 'Senior Staff Engineer', color: 'ag' },
    lurah: { name: '@lurah', role: 'Ecosystem Guardian', color: 'lr' },
    qwen: { name: '@qwen', role: 'Build Master', color: 'qw' },
    deepseek: { name: '@deepseek', role: 'Backend Strategist', color: 'ds' }
};

function addMessage(agentKey, text, code = null) {
    const agent = agents[agentKey] || { name: '@' + agentKey, color: 'ag' };
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${agentKey}`;

    let codeHtml = code ? `<pre><code>${code}</code></pre>` : '';

    msgDiv.innerHTML = `
        <div class="msg-header">
            <span class="msg-name">${agent.name}</span>
            <span class="msg-time">${time}</span>
        </div>
        <div class="msg-bubble">
            <div class="msg-content">${text.includes('<table') ? text : text.replace(/\n/g, '<br>')}</div>
            ${codeHtml}
        </div>
    `;

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMsg(text) {
    const msg = document.createElement('div');
    msg.className = 'system-msg';
    msg.innerText = text;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

clearLogBtn.onclick = () => {
    chatMessages.innerHTML = '';
    addSystemMsg('Intelligence Feed Reset.');
};

// Live Mode (Nexus Bridge Integration)
let lastTimestamp = 0;
let isConnected = false;

async function updateLogs() {
    try {
        const response = await fetch('nexus-activity.json?t=' + Date.now());
        if (!response.ok) throw new Error('Fetch failed');
        
        const logs = await response.json();
        
        if (!isConnected && logs.length > 0) {
            isConnected = true;
            // Clear placeholder if it exists
            const placeholder = chatMessages.querySelector('.system-msg');
            if (placeholder && placeholder.innerText.includes('Establishing connection')) {
                placeholder.remove();
            }
            addSystemMsg('✅ Nexus Bridge Connected.');
        }
        
        logs.forEach(log => {
            if (log.id > lastTimestamp) {
                addMessage(log.agent, log.message, log.code);
                lastTimestamp = log.id;
            }
        });
    } catch (err) {
        if (window.location.protocol === 'file:') {
            addSystemMsg('⚠️ Browser Security Block: Use the START_MONITOR.bat launcher to see live data.');
        } else if (!isConnected) {
            console.warn('Nexus Bridge awaiting data...', err);
        } else {
            addSystemMsg('📡 Connection Lag: Retrying link to Nexus Bridge...');
            isConnected = false;
        }
    }
    setTimeout(updateLogs, 2000); // Faster updates (2s)
}

document.addEventListener('DOMContentLoaded', () => {
    addSystemMsg('📡 Nexus Monitor: Live Data Feed Active.');
    updateLogs();
});

// Interactive Panel Setup
const commandInput = document.getElementById('command-input');
const sendCommandBtn = document.getElementById('send-command');
const agentSelector = document.getElementById('agent-selector');
const commandStatus = document.getElementById('command-status');

sendCommandBtn.addEventListener('click', async () => {
    const prompt = commandInput.value.trim();
    if (!prompt) return;

    const agent = agentSelector.value;
    
    addMessage(agent, `[EXECUTING TASK]\nPrompt: ${prompt}`);
    
    commandInput.value = '';
    sendCommandBtn.disabled = true;
    sendCommandBtn.innerText = 'WAIT...';
    commandStatus.innerText = 'Status: Forwarding to local LLM...';

    try {
        const res = await fetch('/api/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent, prompt })
        });
        
        const data = await res.json();
        
        if (data.status === 'ok') {
            commandStatus.innerText = `Status: Complete.`;
            addMessage(agent, `[RESPONSE]\n${data.response}`);
        } else {
            commandStatus.innerText = `Status: Error.`;
            addSystemMsg(`⚠️ Agent execution failed: ${data.message || 'Unknown error'}`);
        }
    } catch (err) {
        commandStatus.innerText = `Status: Network Error.`;
        addSystemMsg(`⚠️ Failed to connect to server backend: ${err.message}`);
    } finally {
        sendCommandBtn.disabled = false;
        sendCommandBtn.innerText = 'EXECUTE';
        setTimeout(() => commandStatus.innerText = 'Idle', 3000);
    }
});

commandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendCommandBtn.click();
});

const runAuditBtn = document.getElementById('run-audit-btn');
if (runAuditBtn) {
    runAuditBtn.addEventListener('click', async () => {
        addMessage('lurah', `[CRITICAL ACTION]\nMemulai End-To-End Orchestron Audit...\nPerkiraan Waktu: 20-30 detik. Harap tunggu.`);
        
        runAuditBtn.disabled = true;
        runAuditBtn.innerText = 'AUDITING...';
        commandStatus.innerText = 'Status: Executing nexus_orchestrator.cjs...';
        
        try {
            const res = await fetch('/api/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent: 'lurah', prompt: '/audit' })
            });
            
            const data = await res.json();
            
            if (data.status === 'ok') {
                commandStatus.innerText = `Status: Audit Complete.`;
                addMessage('lurah', data.response);
            } else {
                commandStatus.innerText = `Status: Audit Error.`;
                addMessage('lurah', `⚠️ Audit execution failed: ${data.message || 'Unknown error'}`);
            }
        } catch (err) {
            commandStatus.innerText = `Status: Network Error.`;
            addSystemMsg(`⚠️ Failed to connect to server for audit: ${err.message}`);
        } finally {
            runAuditBtn.disabled = false;
            runAuditBtn.innerText = 'SYSTEM AUDIT';
            setTimeout(() => commandStatus.innerText = 'Idle', 3000);
        }
    });
}
