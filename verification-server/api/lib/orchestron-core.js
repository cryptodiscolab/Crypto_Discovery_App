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

async function dispatchTask(agentName, taskName, description, requesterId = 'telegram_admin') {
    console.log(`📡 [Orchestron] Dispatching task to @${agentName}: ${taskName}`);
    
    // 1. Log transition to passive monitor
    await logToNexus(`Orchestron dispatching '${taskName}' to @${agentName}`);

    // 2. Insert into agents_vault for worker pickup
    const { data, error } = await supabase
        .from('agents_vault')
        .insert([{
            target_agent: agentName.toLowerCase(),
            task_name: taskName,
            task_description: description,
            status: 'pending',
            requester_id: requesterId,
            created_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (error) {
        console.error(`❌ [Orchestron] Dispatch Error:`, error.message);
        throw error;
    }

    return data;
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
    getAgentStatus,
    logToNexus
};
