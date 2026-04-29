const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { createPublicClient, http, formatEther } = require('viem');
const { baseSepolia } = require('viem/chains');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const MASTER_X_ADDRESS = process.env.MASTER_X_ADDRESS || process.env.VITE_MASTER_X_ADDRESS_SEPOLIA;
const DAILY_APP_ADDRESS = process.env.DAILY_APP_ADDRESS || process.env.VITE_V12_CONTRACT_ADDRESS_SEPOLIA;
const RAFFLE_ADDRESS = process.env.VITE_RAFFLE_ADDRESS_SEPOLIA || process.env.RAFFLE_ADDRESS_SEPOLIA;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

const DATA_FILE = path.join(__dirname, '../../.agents/tools/ncc/ecosystem-data.json');
const HTML_FILE = path.join(__dirname, '../../.agents/tools/ncc/index.html');

async function generateMap() {
    console.log("🚀 [NCC] Generating Ecosystem Data Map...");
    
    const data = {
        timestamp: new Date().toISOString(),
        status: "HEALTHY",
        alerts: [],
        layers: {
            environment: { status: "OK", nodes: [] },
            database: { status: "OK", nodes: [] },
            contracts: { status: "OK", nodes: [] },
            api: { status: "OK", nodes: [] },
            knowledge: { status: "OK", nodes: [] }
        },
        relationships: []
    };

    // 1. Environment Layer
    const envFiles = ['.env', '.env.example', '.env.local', '.env.vercel.production'];
    envFiles.forEach(file => {
        const filePath = path.join(__dirname, '../../', file);
        const exists = fs.existsSync(filePath);
        data.layers.environment.nodes.push({
            id: file,
            status: exists ? "GREEN" : (file === '.env' ? "RED" : "YELLOW"),
            path: file
        });
        if (!exists && file === '.env') {
            data.layers.environment.status = "CRITICAL";
            data.alerts.push({ level: "RED", msg: `Missing mandatory file: ${file}`, area: "Security" });
        }
    });

    // 2. Database Layer
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        try {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
            const tables = [
                { name: 'user_profiles', cat: 'User' },
                { name: 'user_task_claims', cat: 'Task' },
                { name: 'daily_tasks', cat: 'Task' },
                { name: 'agent_vault', cat: 'Cognitive' },
                { name: 'point_settings', cat: 'Economy' },
                { name: 'system_settings', cat: 'Admin' }
            ];
            for (const table of tables) {
                const { count, error } = await supabase.from(table.name).select('*', { count: 'exact', head: true });
                data.layers.database.nodes.push({
                    id: table.name,
                    status: error ? "RED" : "GREEN",
                    rows: count || 0,
                    category: table.cat,
                    error: error ? error.message : null
                });
                if (error) {
                    data.layers.database.status = "DEGRADED";
                    data.alerts.push({ level: "RED", msg: `DB Error on ${table.name}: ${error.message}`, area: "Data" });
                }
                data.relationships.push({ from: ".env", to: table.name, label: "config" });
            }
        } catch (e) {
            data.layers.database.status = "CRITICAL";
            data.alerts.push({ level: "RED", msg: `Supabase Connection Failed: ${e.message}`, area: "Infrastructure" });
        }
    }

    // 3. Contracts & ABIs
    const artifactsDir = path.join(__dirname, '../../artifacts/contracts');
    if (fs.existsSync(artifactsDir)) {
        const scanContracts = (dir) => {
            const items = fs.readdirSync(dir);
            items.forEach(item => {
                const fullPath = path.join(dir, item);
                if (fs.lstatSync(fullPath).isDirectory()) {
                    scanContracts(fullPath);
                } else if (item.endsWith('.json') && !item.endsWith('.dbg.json')) {
                    data.layers.contracts.nodes.push({ id: item, status: "GREEN" });
                    data.relationships.push({ from: item, to: "Logic Layer" });
                }
            });
        };
        scanContracts(artifactsDir);
    } else {
        data.layers.contracts.status = "DEGRADED";
        data.alerts.push({ level: "YELLOW", msg: "Hardhat artifacts not found. Run 'npx hardhat compile'?", area: "Build" });
    }


    // 3. Contracts Layer (On-chain Audit)
    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL)
    });

    const DAILY_APP_ABI = [
        { inputs: [{ type: "uint8", name: "" }], name: "nftConfigs", outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bool" }], stateMutability: "view", type: "function" },
        { inputs: [{ type: "address", name: "" }], name: "userStats", outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint8" }, { type: "uint256" }, { type: "uint256" }, { type: "bool" }], stateMutability: "view", type: "function" },
        { inputs: [{ type: "address", name: "" }], name: "unsyncedPoints", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }
    ];

    const MASTER_X_ABI = [
        { inputs: [{ type: "address", name: "" }], name: "users", outputs: [{ type: "uint256", name: "points" }, { type: "uint64", name: "lastClaimTimestamp" }, { type: "uint32", name: "referralCount" }, { type: "uint8", name: "tier" }, { type: "bool", name: "isVerified" }, { type: "address", name: "referrer" }, { type: "uint32", name: "lastUpdateSeasonId" }], stateMutability: "view", type: "function" },
        { inputs: [{ type: "uint8", name: "" }], name: "tierMinXP", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
        { inputs: [], name: "totalSBTPoolBalance", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
        { inputs: [], name: "lastDistributeTimestamp", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }
    ];

    const RAFFLE_ABI = [
        { inputs: [{ type: "uint256", name: "raffleId" }], name: "cancelRaffle", outputs: [], stateMutability: "nonpayable", type: "function" },
        { inputs: [], name: "currentRaffleId", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }
    ];

    data.layers.contracts.nodes.push({ id: "DailyApp_Contract", status: DAILY_APP_ADDRESS ? "GREEN" : "RED", address: DAILY_APP_ADDRESS });
    data.layers.contracts.nodes.push({ id: "MasterX_Contract", status: MASTER_X_ADDRESS ? "GREEN" : "RED", address: MASTER_X_ADDRESS });
    data.layers.contracts.nodes.push({ id: "Raffle_Contract", status: RAFFLE_ADDRESS ? "GREEN" : "RED", address: RAFFLE_ADDRESS });

    if (DAILY_APP_ADDRESS && MASTER_X_ADDRESS && RAFFLE_ADDRESS) {
        try {
            console.log("🔍 [NCC] Auditing SBT & XP Lifecycle...");
            
            // 4a. SBT Mining Pool & Rewards
            const poolBalance = await publicClient.readContract({
                address: MASTER_X_ADDRESS,
                abi: MASTER_X_ABI,
                functionName: 'totalSBTPoolBalance'
            }).catch(() => 0n);

            const lastDist = await publicClient.readContract({
                address: MASTER_X_ADDRESS,
                abi: MASTER_X_ABI,
                functionName: 'lastDistributeTimestamp'
            }).catch(() => 0n);

            data.layers.api.nodes.push({ 
                id: "SBT_Mining_Pool", 
                status: poolBalance > 0n ? "GREEN" : "YELLOW",
                value: `${formatEther(poolBalance)} ETH`,
                last_dist: lastDist > 0n ? new Date(Number(lastDist) * 1000).toLocaleDateString() : 'None'
            });
            data.relationships.push({ from: "MasterX_Contract", to: "SBT_Mining_Pool", label: "funds" });

            // 4b. XP Mining Flow (DailyApp -> MasterX)
            const tierNames = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
            
            // Audit Tier Thresholds from MasterX & DailyApp
            const tierAudit = await Promise.all(tierNames.map(async (_, i) => {
                const masterXP = await publicClient.readContract({
                    address: MASTER_X_ADDRESS, abi: MASTER_X_ABI, functionName: 'tierMinXP', args: [i + 1]
                }).catch(() => 0n);

                const dailyConfig = await publicClient.readContract({
                    address: DAILY_APP_ADDRESS, abi: DAILY_APP_ABI, functionName: 'nftConfigs', args: [i + 1]
                }).catch(() => [0n, 0n, 0n, 0n, 0n, 0n, false]);

                return { 
                    tier: tierNames[i], 
                    masterXP, 
                    dailyXP: dailyConfig[0], 
                    isOpen: dailyConfig[6] 
                };
            }));

            tierAudit.forEach((audit) => {
                const isSynced = audit.masterXP === audit.dailyXP && audit.isOpen;
                
                data.layers.api.nodes.push({
                    id: `SBT_Tier_${audit.tier}`,
                    status: isSynced ? "GREEN" : (audit.isOpen ? "YELLOW" : "RED"),
                    req_xp: audit.masterXP.toString(),
                    msg: isSynced ? "Active & Synced" : (audit.isOpen ? "XP Drift Detected" : "Tier Closed in DailyApp")
                });
                data.relationships.push({ from: "MasterX_Contract", to: `SBT_Tier_${audit.tier}`, label: "rule" });
                data.relationships.push({ from: "DailyApp_Contract", to: `SBT_Tier_${audit.tier}`, label: "mint" });

                if (!isSynced) {
                    data.layers.api.status = "DEGRADED";
                    data.alerts.push({ level: "YELLOW", msg: `Tier ${audit.tier} out of sync or closed!`, area: "Economy" });
                }
            });

            // 4c. Real-time XP & Referral Parity
            if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
                const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
                const { data: topUsers } = await supabase.from('user_profiles').select('wallet_address, total_xp, referral_count').order('total_xp', { ascending: false }).limit(3);
                
                if (topUsers && topUsers.length > 0) {
                    for (const user of topUsers) {
                        try {
                            const masterStats = await publicClient.readContract({
                                address: MASTER_X_ADDRESS,
                                abi: MASTER_X_ABI,
                                functionName: 'users',
                                args: [user.wallet_address]
                            });

                            const dailyUnsynced = await publicClient.readContract({
                                address: DAILY_APP_ADDRESS,
                                abi: DAILY_APP_ABI,
                                functionName: 'unsyncedPoints',
                                args: [user.wallet_address]
                            }).catch(() => 0n);

                            const onChainTotalXP = Number(masterStats[0]) + Number(dailyUnsynced);
                            const drift = Math.abs(onChainTotalXP - user.total_xp);
                            const refDrift = Math.abs(Number(masterStats[2]) - user.referral_count);

                            data.layers.api.nodes.push({
                                id: `Flow_User_${user.wallet_address.substring(0,6)}`,
                                status: drift < 100 && refDrift === 0 ? "GREEN" : "YELLOW",
                                value: `${user.total_xp} XP`,
                                drift: drift,
                                ref_status: refDrift === 0 ? "OK" : `Ref Drift: ${refDrift}`,
                                msg: `SBT Level: ${tierNames[masterStats[3] - 1] || 'NONE'}`
                            });
                            data.relationships.push({ from: "SBT_Mining_Pool", to: `Flow_User_${user.wallet_address.substring(0,6)}`, label: "yield" });
                            data.relationships.push({ from: "DailyApp_Contract", to: `Flow_User_${user.wallet_address.substring(0,6)}`, label: "mining" });
                        } catch (err) {
                            console.warn(`Parity check failed for ${user.wallet_address}:`, err.message);
                        }
                    }
                }

                // 4d. Referral Network Aggregate
                const { count: refCount } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true }).not('referred_by', 'is', null);
                data.layers.api.nodes.push({ 
                    id: "Referral_System", 
                    status: "GREEN",
                    total_referrals: refCount || 0
                });
                data.relationships.push({ from: "user_profiles", to: "Referral_System", label: "graph" });
                data.relationships.push({ from: "Referral_System", to: "MasterX_Contract", label: "accounting" });
            }

            // 4e. Raffle Functional Audit (Refund Protocol V2.1)
            try {
                const count = await publicClient.readContract({
                    address: RAFFLE_ADDRESS,
                    abi: RAFFLE_ABI,
                    functionName: 'currentRaffleId'
                });

                // Check for cancelRaffle existence (V2.1 check)
                let refundStatus = "GREEN";
                let refundMsg = `Protocol V2.1 Active (${count} Raffles)`;
                
                try {
                    await publicClient.simulateContract({
                        address: RAFFLE_ADDRESS,
                        abi: RAFFLE_ABI,
                        functionName: 'cancelRaffle',
                        args: [999999n],
                        account: '0x0000000000000000000000000000000000000000'
                    });
                } catch (err) {
                    // If it reverts but the function is found, it's V2.1
                    if (err.message.includes('reverted') || err.message.includes('Ownable')) {
                         refundStatus = "GREEN";
                         refundMsg = `Protocol V2.1 Active (${count} Raffles)`;
                    } else if (err.message.includes('not found') || err.message.includes('is not a function')) {
                        refundStatus = "RED";
                        refundMsg = "Protocol V2.1 MISSING (Old Contract Detected)";
                        data.alerts.push({ level: "RED", msg: "Raffle Contract Outdated: cancelRaffle function missing!", area: "Security" });
                    }
                }

                data.layers.api.nodes.push({ 
                    id: "Raffle_Moderation_Sync", 
                    status: refundStatus,
                    msg: refundMsg
                });
                data.relationships.push({ from: "Raffle_Contract", to: "Raffle_Moderation_Sync", label: "moderation" });

            } catch (e) {
                console.warn("Raffle audit failed:", e.message);
                data.layers.api.nodes.push({ id: "Raffle_Moderation_Sync", status: "RED", msg: "Raffle Audit Failed" });
            }

        } catch (e) {
            data.layers.api.status = "DEGRADED";
            data.alerts.push({ level: "YELLOW", msg: `Ecosystem Audit Incomplete: ${e.message}`, area: "Blockchain" });
        }
    }

    // 5. API & Knowledge Layer
    const apiDir = path.join(__dirname, '../../api');
    if (fs.existsSync(apiDir)) {
        const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));
        files.forEach(file => {
            data.layers.api.nodes.push({ id: file, status: "GREEN" });
            data.relationships.push({ from: "Supabase", to: file, label: "fetch" });
        });
    }

    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        try {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
            const { data: vault } = await supabase.from('agent_vault').select('id, category, hash').limit(5);
            (vault || []).forEach(v => {
                data.layers.knowledge.nodes.push({ 
                    id: v.id.split('/').pop(), 
                    status: "GREEN", 
                    category: v.category, 
                    fullId: v.id 
                });
                data.relationships.push({ from: v.id.split('/').pop(), to: "Knowledge_Base", label: "cached" });
            });
        } catch (e) {}
    }

    // 6. Mermaid Graph Enhancement (Visualizing Errors)
    const safeId = (id) => id.replace(/[^a-zA-Z0-9]/g, '_');

    // Graph Generation
    let graphDefinition = "graph TD\n";
    graphDefinition += "    classDef green fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff,glow:0 0 10px #10b98133\n";
    graphDefinition += "    classDef amber fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff\n";
    graphDefinition += "    classDef red fill:#ef4444,stroke:#dc2626,stroke-width:2px,color:#fff,glow:0 0 15px #ef444466\n";

    // Nodes and Classes
    Object.keys(data.layers).forEach(layerName => {
        data.layers[layerName].nodes.forEach(node => {
            const sid = safeId(node.id);
            graphDefinition += `    ${sid}["${node.id}"]\n`;
            if (node.status === 'GREEN') graphDefinition += `    class ${sid} green\n`;
            else if (node.status === 'RED') graphDefinition += `    class ${sid} red\n`;
            else graphDefinition += `    class ${sid} amber\n`;
        });
    });

    // Relationships
    data.relationships.forEach(rel => {
        if (!rel.from || !rel.to) return;
        const fromSid = safeId(rel.from);
        const toSid = safeId(rel.to);
        const label = rel.label ? `|"${rel.label}"|` : '';
        graphDefinition += `    ${fromSid} -->${label} ${toSid}\n`;
    });

    data.graphDefinition = graphDefinition;

    // Overall Status
    if (data.alerts.some(a => a.level === "RED")) data.status = "CRITICAL";
    else if (data.alerts.some(a => a.level === "YELLOW")) data.status = "DEGRADED";

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    
    // Surgical Injection into HTML for local-first viewing (CORS bypass)
    if (fs.existsSync(HTML_FILE)) {
        let html = fs.readFileSync(HTML_FILE, 'utf8');
        const startTag = '<script id="ncc-data-payload" type="application/json">';
        const endTag = '</script>';
        const regex = new RegExp(`${startTag}[\\s\\S]*?${endTag}`);
        const newHtml = html.replace(regex, `${startTag}${JSON.stringify(data)}${endTag}`);
        fs.writeFileSync(HTML_FILE, newHtml);
        console.log(`💉 Data injected into index.html for local-first viewing.`);
    }

    // Summary Notification
    console.log(`\n======================================================`);
    console.log(`📡 NEXUS COMMAND CENTER: ${data.status}`);
    console.log(`======================================================`);
    if (data.alerts.length > 0) {
        console.log(`⚠️ PRIORITY TASKS DETECTED:`);
        data.alerts.forEach(a => {
            const icon = a.level === "RED" ? "🔴" : "🟡";
            console.log(`  ${icon} [${a.area}] ${a.msg}`);
        });
    } else {
        console.log(`✅ All systems healthy. No priority tasks found.`);
    }
    console.log(`======================================================\n`);
    
    return data;
}

if (require.main === module) {
    generateMap().catch(console.error);
}

module.exports = { generateMap };
