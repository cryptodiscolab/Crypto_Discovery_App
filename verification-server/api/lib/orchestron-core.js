/**
 * NEXUS ORCHESTRON CORE
 * Logic for distributing tasks to specialized agents.
 * Path: verification-server/api/lib/orchestron-core.js
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AGENT_ROSTER = [
    'OrchestratorBot',
    'SyncGuardBot',
    'ResearchBot',
    'CodeBot',
    'ContractBot',
    'FrontendBot',
    'SecurityBot',
    'DatabaseBot',
    'BackendBot',
    'QABot',
    'GrowthBot',
    'DocsBot'
];

const AGENT_ALIASES = {
    all: 'ALL',
    semua: 'ALL',
    warroom: 'ALL',
    orchestron: 'OrchestratorBot',
    orchestronbot: 'OrchestratorBot',
    orchestrator: 'OrchestratorBot',
    lurah: 'OrchestratorBot',
    antigravity: 'OrchestratorBot',
    sync: 'SyncGuardBot',
    syncguard: 'SyncGuardBot',
    research: 'ResearchBot',
    code: 'CodeBot',
    contract: 'ContractBot',
    frontend: 'FrontendBot',
    security: 'SecurityBot',
    claw: 'SecurityBot',
    openclaw: 'SecurityBot',
    database: 'DatabaseBot',
    db: 'DatabaseBot',
    backend: 'BackendBot',
    deepseek: 'BackendBot',
    qa: 'QABot',
    growth: 'GrowthBot',
    docs: 'DocsBot',
    qwen: 'CodeBot'
};

function normalizeAgentName(agentName) {
    const key = String(agentName || '').trim().toLowerCase();
    if (!key) return null;
    const alias = AGENT_ALIASES[key];
    if (alias) return alias;
    return AGENT_ROSTER.find(agent => agent.toLowerCase() === key) || null;
}

function getAgentRoster() {
    return [...AGENT_ROSTER];
}

async function dispatchTask(agentName, taskName, description, requesterId = 'telegram_admin', options = {}) {
    const targetAgent = normalizeAgentName(agentName);
    if (!targetAgent || targetAgent === 'ALL') {
        throw new Error(`Unknown target agent: ${agentName}`);
    }

    console.log(`📡 [Orchestron] Dispatching task to @${targetAgent}: ${taskName}`);
    
    // 1. Log transition to passive monitor
    await logToNexus(`Orchestron dispatching '${taskName}' to @${targetAgent}`);

    // 2. Insert into agents_vault for worker pickup
    const payload = {
        target_agent: targetAgent,
        task_name: taskName,
        task_description: description,
        status: 'pending',
        requested_by_wallet: requesterId,
        created_at: new Date().toISOString()
    };

    if (options.parentTaskId) payload.parent_task_id = options.parentTaskId;
    if (options.metadata) payload.metadata = options.metadata;

    const { data, error } = await supabase
        .from('agents_vault')
        .insert([payload])
        .select()
        .single();

    if (error) {
        console.error(`❌ [Orchestron] Dispatch Error:`, error.message);
        throw error;
    }

    return data;
}

async function dispatchOrchestrator(taskName, description, requesterId = 'telegram_admin') {
    const orchestrationPrompt = [
        'You are OrchestratorBot inside the Telegram Nexus War Room.',
        'Coordinate the specialist agents only when useful using exact [DELEGATE: AgentName -> Prompt] tags.',
        'Keep outputs short, evidence-driven, and action-oriented for Telegram.',
        'Do not repeat protocol text unless it directly changes the task.',
        '',
        `OWNER TASK: ${description}`
    ].join('\n');

    return dispatchTask('OrchestratorBot', taskName, orchestrationPrompt, requesterId, {
        metadata: { source: 'telegram_war_room', mode: 'orchestrator' }
    });
}

async function dispatchToAllAgents(taskName, description, requesterId = 'telegram_admin') {
    const parent = await dispatchOrchestrator(`[WAR ROOM] ${taskName}`, description, requesterId);
    const specialists = AGENT_ROSTER.filter(agent => agent !== 'OrchestratorBot');
    const childTasks = await Promise.all(specialists.map(agent => {
        const scopedPrompt = [
            `Parent War Room Task: ${parent.id}`,
            `Specialist role: ${agent}`,
            'Return concise findings only: max 5 bullets, include file paths or evidence if relevant.',
            'If another agent should handle part of this, name that dependency clearly.',
            '',
            `OWNER TASK: ${description}`
        ].join('\n');

        return dispatchTask(agent, `[WAR ROOM] ${taskName}`, scopedPrompt, requesterId, {
            parentTaskId: parent.id,
            metadata: { source: 'telegram_war_room', mode: 'all_agents', parent_task_id: parent.id }
        });
    }));

    return { parent, children: childTasks };
}

async function logToNexus(message) {
    // We log to a specific settings key or a dedicated log table that Nexus Monitor reads
    const logEntry = {
        timestamp: new Date().toISOString(),
        message: message,
        level: 'info'
    };
    
    // For now, let's append to a 'nexus_logs' array in system_settings or similar
    // Implementation depends on how Nexus Monitor reads data
    console.log(`📝 [Nexus Log]: ${message}`);
}

async function getAgentStatus(agentName) {
    const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', `heartbeat_${agentName.toLowerCase()}`)
        .maybeSingle(); // v3.42.2: heartbeat row may not exist if agent never ran
    
    if (!data) return 'OFFLINE';
    
    const lastSeen = new Date(data.value);
    const now = new Date();
    const diffSeconds = (now - lastSeen) / 1000;
    
    return diffSeconds < 60 ? 'ONLINE' : 'OFFLINE';
}

module.exports = {
    dispatchTask,
    dispatchOrchestrator,
    dispatchToAllAgents,
    getAgentStatus,
    getAgentRoster,
    normalizeAgentName,
    logToNexus
};
