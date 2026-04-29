const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../.agents/tools/ncc/ecosystem-data.json');

function monitor() {
    if (!fs.existsSync(DATA_FILE)) {
        console.log("❌ NCC Data not found. Run 'node scripts/nexus/ncc-generator.cjs' first.");
        return;
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const lastUpdated = new Date(data.timestamp);
    const now = new Date();
    const diffMins = Math.floor((now - lastUpdated) / 1000 / 60);

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log(`║  🛰️  NEXUS PULSE MONITOR v1.0                            ║`);
    console.log("╚══════════════════════════════════════════════════════════╝");
    
    const statusColor = data.status === 'HEALTHY' ? '\x1b[32m' : (data.status === 'DEGRADED' ? '\x1b[33m' : '\x1b[31m');
    const reset = '\x1b[0m';

    console.log(`  STATUS: ${statusColor}${data.status}${reset}`);
    console.log(`  PULSE:  ${diffMins} mins ago (${lastUpdated.toLocaleTimeString()})`);
    console.log(`  NODES:  Env(${data.layers.environment.nodes.length}) | DB(${data.layers.database.nodes.length}) | Logic(${data.layers.contracts.nodes.length}) | Cache(${data.layers.knowledge.nodes.length})`);
    
    if (data.alerts.length > 0) {
        console.log("\n  ⚠️  PRIORITY TASKS (RED/YELLOW):");
        data.alerts.forEach(a => {
            const levelColor = a.level === 'RED' ? '\x1b[31m' : '\x1b[33m';
            console.log(`     ${levelColor}● [${a.area}] ${a.msg}${reset}`);
        });
    } else {
        console.log("\n  ✅ ALL SYSTEMS NOMINAL");
    }
    
    console.log("\n  Dashboard: .agents/tools/ncc/index.html");
    console.log("╚══════════════════════════════════════════════════════════╝\n");
}

monitor();
