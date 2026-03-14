import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

const supabaseAdmin = createClient(
    (process.env.VITE_SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
);

const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TELEGRAM_CHAT_ID = (process.env.TELEGRAM_CHAT_ID || '').trim();

// ─── Telegram Notification Helper ────────────────────────────────────────────
async function notifyTelegramWinner(walletAddress, raffleId, xpAwarded) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    try {
        const short = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
        const text = `🏆 *NFT Raffle Winner Claim!*\n\n` +
            `Wallet: \`${short}\`\n` +
            `Raffle ID: #${raffleId}\n` +
            `XP Bonus: +${xpAwarded} XP\n\n` +
            `🎉 Prize claimed successfully on-chain.`;

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text,
                parse_mode: 'Markdown'
            })
        });
    } catch (e) {
        console.warn('[Raffle] Telegram notify failed:', e.message);
    }
}

export default async function handler(req, res) {
    const action = req.body?.action || req.query?.action;

    switch (action) {
        case 'claim-prize':
            return handleClaimPrize(req, res);
        case 'leaderboard':
            return handleLeaderboard(req, res);
        default:
            return res.status(400).json({ error: `Invalid raffle action: ${action}` });
    }
}

/**
 * POST /api/raffle/claim-prize
 * Called by claimPrize() in useRaffle.js after on-chain tx.
 * Zero-Trust: Verifies signature, awards XP, increments raffle_wins, notifies Bot.
 */
async function handleClaimPrize(req, res) {
    const { wallet_address, signature, message, raffle_id, tx_hash } = req.body;

    try {
        // ─── 1. Zero-Trust Signature Verification ────────────────────────────
        if (!wallet_address || !signature || !message || !raffle_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const valid = await verifyMessage({
            address: wallet_address,
            message,
            signature
        });
        if (!valid) return res.status(401).json({ error: '[Security] Signature verification failed.' });

        const normalizedWallet = wallet_address.toLowerCase();

        // ─── 2. Anti-Cheat: Prevent claiming same raffle twice ────────────────
        const { count } = await supabaseAdmin
            .from('user_task_claims')
            .select('id', { count: 'exact', head: true })
            .eq('wallet_address', normalizedWallet)
            .eq('task_id', `raffle_win_${raffle_id}`);

        if (count > 0) {
            return res.status(200).json({
                success: true,
                alreadyClaimed: true,
                message: 'Prize already recorded for this raffle.'
            });
        }

        // ─── 3. Fetch XP reward from Ground Truth (point_settings) ───────────
        const { data: setting } = await supabaseAdmin
            .from('point_settings')
            .select('points_value')
            .eq('activity_key', 'raffle_win')
            .single();

        const xpAwarded = setting?.points_value || 1000; // Default 1000 XP for winning

        // ─── 4. Record Claim & Award XP ──────────────────────────────────────
        const { error: claimError } = await supabaseAdmin
            .from('user_task_claims')
            .insert({
                wallet_address: normalizedWallet,
                task_id: `raffle_win_${raffle_id}`,
                xp_earned: xpAwarded,
                platform: 'system',
                action_type: 'raffle_win',
                target_id: String(raffle_id),
                claimed_at: new Date().toISOString()
            });

        if (claimError && claimError.code !== '23505') throw claimError;

        // ─── 5. Increment `raffle_wins` counter ───────────────────────────────
        await supabaseAdmin.rpc('fn_increment_raffle_wins', {
            p_wallet: normalizedWallet
        });

        // ─── 6. Notify Telegram Bot ───────────────────────────────────────────
        await notifyTelegramWinner(normalizedWallet, raffle_id, xpAwarded);

        // ─── 7. Log Activity (New Feature) ───────────────────────────────────
        await logActivity({
            wallet: normalizedWallet,
            category: 'REWARD',
            type: 'NFT Raffle Win',
            description: `Claimed prize for Raffle #${raffle_id}`,
            amount: xpAwarded,
            symbol: 'XP',
            txHash: tx_hash
        });

        return res.status(200).json({
            success: true,
            xpAwarded,
            message: `Congratulations! +${xpAwarded} XP awarded for winning Raffle #${raffle_id}`
        });

    } catch (error) {
        console.error('[Raffle ClaimPrize API Error]', error);
        return res.status(500).json({ error: error.message });
    }
}

async function handleLeaderboard(req, res) {
    const { limit = 20, sort_by = 'raffle_wins' } = req.query;
    try {
        const validSortKeys = ['raffle_wins', 'total_xp', 'raffles_created'];
        const safeSort = validSortKeys.includes(sort_by) ? sort_by : 'raffle_wins';

        const { data, error } = await supabaseAdmin
            .from('v_user_full_profile')
            .select('wallet_address, display_name, pfp_url, total_xp, rank_name, raffle_wins, raffles_created, streak_count')
            .order(safeSort, { ascending: false })
            .limit(parseInt(limit));

        if (error) throw error;
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function logActivity({ wallet, category, type, description, amount, symbol, txHash, metadata }) {
    try {
        await supabaseAdmin.from('user_activity_logs').insert({
            wallet_address: wallet.toLowerCase(),
            category,
            activity_type: type,
            description,
            value_amount: amount || 0,
            value_symbol: symbol || 'XP',
            tx_hash: txHash,
            metadata: metadata || {}
        });
    } catch (err) {
        console.error('[logActivity Error]', err.message);
    }
}
