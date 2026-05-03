const fs = require('fs');
const path = require('path');
const net = require('net');

/**
 * Utility to resolve ports from .env files and find the next available port if taken.
 * Adheres to Zero-Hardcode Mandate.
 */

const rootDir = path.join(__dirname, '../../');
const envFiles = ['.env', '.env.local'];

const env = {};

// Parse .env files
envFiles.forEach(file => {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        content.split('\n').forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                let value = match[2] || '';
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
                env[match[1]] = value.trim();
            }
        });
    }
});

/**
 * Check if a port is free
 */
function isPortFree(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err) => {
            resolve(false);
        });
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}

/**
 * Find the next available port starting from 'start'
 * and avoiding ports in 'exclude' list
 */
async function findFreePort(start, exclude = []) {
    let port = parseInt(start);
    while (!(await isPortFree(port)) || exclude.includes(port)) {
        port++;
    }
    return port;
}

async function main() {
    const preferredFe = env.VITE_PORT || '5173';
    const preferredBe = env.PORT || '3000';
    const preferredMonitor = env.MONITOR_PORT || '4000';

    const fePort = await findFreePort(preferredFe);
    const bePort = await findFreePort(preferredBe, [fePort]);
    const monitorPort = await findFreePort(preferredMonitor, [fePort, bePort]);

    // Output for Batch: SET VAR=VAL
    console.log(`SET DISCO_FE_PORT=${fePort}`);
    console.log(`SET DISCO_BE_PORT=${bePort}`);
    console.log(`SET DISCO_MONITOR_PORT=${monitorPort}`);
}

main().catch(err => {
    // Fallback if something goes wrong
    console.log(`SET DISCO_FE_PORT=5173`);
    console.log(`SET DISCO_BE_PORT=3000`);
    console.log(`SET DISCO_MONITOR_PORT=4000`);
});
