/* eslint-disable @typescript-eslint/no-explicit-any */
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
    DISCO_APP_URL,
    NEYNAR_API_KEY,
    NEYNAR_API_URL,
    RAFFLE_ABI,
    RAFFLE_ADDRESS,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
    getEnv,
    rpcClient,
    sanitizeError
} from '../_shared/constants.js';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

type ReminderCandidate = {
    wallet_address: string;
    fid?: number | null;
    reward_type: 'ugc' | 'raffle';
    reward_id: string;
    notification_kind: 'claim_reminder';
    message: string;
    metadata: Record<string, unknown>;
};

function isAuthorizedCron(req: VercelRequest) {
    const cronSecret = getEnv('CRON_SECRET', '');
    const authHeader = String(req.headers.authorization || '');
    const isVercelCron = String(req.headers['x-vercel-cron'] || '') === '1';
    return isVercelCron || (!!cronSecret && authHeader === `Bearer ${cronSecret}`);
}

async function getProfileByWallet(wallet: string) {
    const { data } = await supabaseAdmin
        .from('user_profiles')
        .select('wallet_address, fid')
        .eq('wallet_address', wallet.toLowerCase())
        .maybeSingle();
    return data as { wallet_address: string; fid?: number | null } | null;
}

async function reserveNotification(candidate: ReminderCandidate, notificationDate: string) {
    const { error } = await (supabaseAdmin as any)
        .from('reward_claim_notifications')
        .insert({
            wallet_address: candidate.wallet_address.toLowerCase(),
            fid: candidate.fid || null,
            reward_type: candidate.reward_type,
            reward_id: candidate.reward_id,
            notification_date: notificationDate,
            notification_kind: candidate.notification_kind,
            status: 'reserved',
            metadata: candidate.metadata
        });

    if (!error) return true;
    if ((error as any).code === '23505') return false;
    throw error;
}

async function markNotificationSent(candidate: ReminderCandidate, notificationDate: string, status: 'sent' | 'failed', errorMessage?: string) {
    await (supabaseAdmin as any)
        .from('reward_claim_notifications')
        .update({
            status,
            sent_at: status === 'sent' ? new Date().toISOString() : null,
            error_message: errorMessage || null
        })
        .eq('wallet_address', candidate.wallet_address.toLowerCase())
        .eq('reward_type', candidate.reward_type)
        .eq('reward_id', candidate.reward_id)
        .eq('notification_date', notificationDate)
        .eq('notification_kind', candidate.notification_kind);
}

async function sendFarcaster(candidate: ReminderCandidate) {
    if (!candidate.fid) return { skipped: true, reason: 'missing_fid' };
    if (!NEYNAR_API_KEY || !getEnv('NEYNAR_SIGNER_UUID', '')) return { skipped: true, reason: 'neynar_not_configured' };

    const response = await fetch(NEYNAR_API_URL, {
        method: 'POST',
        headers: { api_key: NEYNAR_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
            signer_uuid: getEnv('NEYNAR_SIGNER_UUID', ''),
            text: candidate.message,
            mentions: [candidate.fid],
            mentions_positions: [0]
        })
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Neynar ${response.status}: ${body.slice(0, 200)}`);
    }
    return { sent: true };
}

async function collectUgcCandidates(nowIso: string): Promise<ReminderCandidate[]> {
    const { data: rows, error } = await supabaseAdmin
        .from('user_task_claims')
        .select('wallet_address, task_id, payout_status, payout_deadline_at, reward_amount, reward_symbol')
        .in('payout_status', ['earned_pending_onchain_claim', 'sync_failed'])
        .gt('payout_deadline_at', nowIso)
        .limit(100);

    if (error) throw error;

    const candidates: ReminderCandidate[] = [];
    for (const row of rows || []) {
        const taskId = String((row as any).task_id || '');
        if (!taskId.startsWith('ugc_campaign_')) continue;
        const wallet = String((row as any).wallet_address || '').toLowerCase();
        if (!wallet) continue;
        const profile = await getProfileByWallet(wallet);
        const campaignId = taskId.replace('ugc_campaign_', '');
        const rewardAmount = (row as any).reward_amount || 0;
        const rewardSymbol = (row as any).reward_symbol || 'USDC';
        const deadline = String((row as any).payout_deadline_at || '');
        candidates.push({
            wallet_address: wallet,
            fid: profile?.fid || null,
            reward_type: 'ugc',
            reward_id: campaignId,
            notification_kind: 'claim_reminder',
            message: `Reward reminder: ${rewardAmount} ${rewardSymbol} UGC payout is waiting. Claim before ${new Date(deadline).toUTCString()} at ${DISCO_APP_URL}/tasks`,
            metadata: { task_id: taskId, payout_deadline_at: deadline, reward_amount: rewardAmount, reward_symbol: rewardSymbol }
        });
    }
    return candidates;
}

async function collectRaffleCandidates(nowIso: string): Promise<ReminderCandidate[]> {
    if (!RAFFLE_ADDRESS || RAFFLE_ADDRESS === '[RESERVED]') return [];

    const { data: raffles, error } = await supabaseAdmin
        .from('raffles')
        .select('id, title, prize_per_winner, claim_deadline_at')
        .eq('is_finalized', true)
        .gt('claim_deadline_at', nowIso)
        .order('id', { ascending: false })
        .limit(10);

    if (error) throw error;

    const candidates: ReminderCandidate[] = [];
    for (const raffle of raffles || []) {
        const raffleId = Number((raffle as any).id);
        if (!Number.isFinite(raffleId)) continue;

        let winners: string[] = [];
        try {
            const info = await rpcClient.readContract({
                address: RAFFLE_ADDRESS as `0x${string}`,
                abi: RAFFLE_ABI,
                functionName: 'getRaffleInfo',
                args: [BigInt(raffleId)]
            }) as any;
            winners = (info.winners || info[6] || []).map((w: string) => String(w).toLowerCase()).filter((w: string) => w && w !== ZERO_ADDRESS);
        } catch {
            continue;
        }

        for (const wallet of winners.slice(0, 20)) {
            const taskId = `raffle_win_${raffleId}`;
            const { data: existingClaim } = await supabaseAdmin
                .from('user_task_claims')
                .select('task_id')
                .eq('wallet_address', wallet)
                .eq('task_id', taskId)
                .maybeSingle();
            if (existingClaim) continue;

            const profile = await getProfileByWallet(wallet);
            const deadline = String((raffle as any).claim_deadline_at || '');
            candidates.push({
                wallet_address: wallet,
                fid: profile?.fid || null,
                reward_type: 'raffle',
                reward_id: String(raffleId),
                notification_kind: 'claim_reminder',
                message: `Raffle prize reminder: ${((raffle as any).title || `Raffle #${raffleId}`)} is waiting. Claim before ${new Date(deadline).toUTCString()} at ${DISCO_APP_URL}/raffles`,
                metadata: { raffle_id: raffleId, claim_deadline_at: deadline, prize_per_winner: (raffle as any).prize_per_winner }
            });
        }
    }
    return candidates;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (!isAuthorizedCron(req)) return res.status(401).json({ error: 'Unauthorized' });

    const notificationDate = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    try {
        const [ugcCandidates, raffleCandidates] = await Promise.all([
            collectUgcCandidates(nowIso),
            collectRaffleCandidates(nowIso)
        ]);

        const candidates = [...ugcCandidates, ...raffleCandidates];
        let reserved = 0;
        let sent = 0;
        let skipped = 0;
        let failed = 0;

        for (const candidate of candidates) {
            const canSend = await reserveNotification(candidate, notificationDate);
            if (!canSend) {
                skipped += 1;
                continue;
            }
            reserved += 1;

            try {
                const result = await sendFarcaster(candidate);
                if ('sent' in result) {
                    await markNotificationSent(candidate, notificationDate, 'sent');
                    sent += 1;
                } else {
                    await markNotificationSent(candidate, notificationDate, 'failed', result.reason);
                    failed += 1;
                }
            } catch (err: unknown) {
                failed += 1;
                await markNotificationSent(candidate, notificationDate, 'failed', err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300));
            }
        }

        return res.status(200).json({
            ok: true,
            notification_date: notificationDate,
            candidates: candidates.length,
            reserved,
            sent,
            skipped,
            failed
        });
    } catch (err: unknown) {
        return res.status(500).json({ error: sanitizeError(err) });
    }
}
