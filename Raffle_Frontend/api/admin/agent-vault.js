import { createClient } from '@supabase/supabase-js';

// Menggunakan SERVICE_ROLE_KEY karena ini akses tingkat sistem (internal agent)
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // PENTING: API ini bisa diproteksi lebih lanjut dengan kunci khusus Agent
    // const agentToken = req.headers['x-agent-key'];
    // if (agentToken !== process.env.INTERNAL_AGENT_SECRET) return res.status(403).json({ error: 'Unauthorized Vault Access' });

    try {
        const { action, payload } = req.body;

        if (action === 'GET_BRAIN') {
            const { file_path } = payload;
            const { data, error } = await supabaseAdmin
                .from('agent_vault')
                .select('content, version')
                .eq('file_path', file_path)
                .single();

            if (error) throw error;
            return res.status(200).json({ success: true, data });
        }

        if (action === 'SYNC_BRAIN') {
            const { file_path, content, category } = payload;
            const { data, error } = await supabaseAdmin
                .from('agent_vault')
                .upsert({
                    file_path,
                    content,
                    category,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'file_path' })
                .select();

            if (error) throw error;
            return res.status(200).json({ success: true, message: 'Vault Synced', data });
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (error) {
        console.error(`[Agent Vault] Error:`, error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
