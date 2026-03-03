import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

// Init Supabase Admin
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AUTHORIZED_ADMINS = [
    '0x08452c1bdaa6acd11f6ccf5268d16e2ac29c204b',
    '0x455df75735d2a18c26f0afdefa93217b60369fe5'
].map(a => a.toLowerCase());

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { address, signature, message } = req.body;

        // 1. Verify Signature (Zero-Trust)
        const valid = await verifyMessage({
            address: address,
            message: message,
            signature: signature,
        });

        if (!valid) return res.status(401).json({ error: 'Invalid signature!' });

        const cleanAddress = address.toLowerCase();
        if (!AUTHORIZED_ADMINS.includes(cleanAddress)) {
            return res.status(403).json({ error: 'Unauthorized: Admin only' });
        }

        // 2. Aggregate Economy Data
        // A. Total Revenue from Listing Fees (from audit logs)
        const { data: auditLogs } = await supabaseAdmin
            .from('admin_audit_logs')
            .select('action, details')
            .in('action', ['SPONSOR_APPROVE', 'DEPLOY_BATCH_TASK']);

        // Assuming fixed platform fee for now if not in details
        // In real app, we'd grab this from the transaction or a specific payments table
        const totalListingRevenue = auditLogs?.length * 1.0 || 0;

        // B. Total XP Distributed (for liability tracking)
        const { data: claims } = await supabaseAdmin
            .from('user_task_claims')
            .select('xp_earned');

        const totalXpDistributed = claims?.reduce((sum, c) => sum + (c.xp_earned || 0), 0) || 0;

        // C. Active Sponsorships Pool
        const { data: activeSponsorships } = await supabaseAdmin
            .from('daily_tasks')
            .select('xp_reward')
            .eq('is_active', true);

        const currentPoolLiability = activeSponsorships?.length || 0;

        // 3. Return Metrics
        return res.status(200).json({
            success: true,
            metrics: {
                totalRevenueUSDC: totalListingRevenue.toFixed(2),
                operationalBuffer: (totalListingRevenue * 0.3).toFixed(2), // 30% for gas/hosting
                netProfit: (totalListingRevenue * 0.7).toFixed(2),
                communityXp: totalXpDistributed,
                activeCampaigns: activeSponsorships?.length || 0
            }
        });

    } catch (error) {
        console.error(`[API] Economy Stats Error:`, error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
