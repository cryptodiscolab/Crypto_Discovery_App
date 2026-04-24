const { spawn } = require('child_process');
const path = require('path');

const scripts = [
    { name: 'Monitor Server', path: 'scripts/debug/monitor-server.cjs' },
    { name: 'Qwen Worker', path: '.agents/scripts/qwen-worker.js' },
    { name: 'OpenClaw Worker', path: '.agents/scripts/openclaw-worker.js' }
];

console.log('🚀 Starting Nexus Agent Ecosystem...');

scripts.forEach(script => {
    const fullPath = path.join(__dirname, '../../', script.path);
    console.log(`📡 Launching ${script.name}...`);
    
    const child = spawn('node', [fullPath], {
        stdio: 'inherit',
        shell: true
    });

    child.on('error', (err) => {
        console.error(`❌ Failed to start ${script.name}:`, err.message);
    });
});

console.log('✅ All agents initiated. Terminal is live at http://localhost:4000');
