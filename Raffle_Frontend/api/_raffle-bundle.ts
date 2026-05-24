/* eslint-disable @typescript-eslint/no-explicit-any */
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { withMiddleware } from './_shared/middleware.js';
import { verifyMessage } from 'viem';
import {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    rpcClient,
    RAFFLE_ADDRESS,
    RAFFLE_ABI,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    TELEGRAM_API_URL,
    ZERO_ADDRESS,
    DISCO_APP_URL,
    isMainnet,
    sanitizeError,
    MASTER_ADMINS
} from './_shared/constants.js';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function isAuthorizedAdmin(walletAddress: string): Promise<boolean> {
    if (!walletAddress) return false;
    const clean = walletAddress.toLowerCase();
    if (MASTER_ADMINS.includes(clean)) return true;

    const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('is_admin')
        .eq('wallet_address', clean)
        .maybeSingle();

    if (error || !data) return false;
    return !!data.is_admin;
}

// ─── Telegram Notification Helper ────────────────────────────────────────────
async function notifyTelegramWinner(walletAddress: string, raffleId: string, xpAwarded: number) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    try {
        const short = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
        const text = `🏆 *NFT Raffle Winner Claim!*\n\n` +
            `Wallet: \`${short}\`\n` +
            `Raffle ID: #${raffleId}\n` +
            `XP Bonus: +${xpAwarded} XP\n\n` +
            `🎉 Prize claimed successfully on-chain.`;

        await fetch(`${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text,
                parse_mode: 'Markdown'
            })
        });
    } catch (e: any) {
        console.warn('[Raffle] Telegram notify failed:', e.message);
    }
}

// -----------------------------------------------------------------------------
// FEATURE GUARDS
// -----------------------------------------------------------------------------
async function checkFeatureGuard(featureKey: string, res: VercelResponse): Promise<boolean> {
    if (!isMainnet) return true;
    
    try {
        const { data } = await supabaseAdmin
            .from('system_settings')
            .select('value')
            .eq('key', 'active_features')
            .maybeSingle();
        
        const activeFeatures = data?.value || {};
        if (activeFeatures[featureKey] !== true) {
            res.status(403).json({ error: `Feature [${featureKey}] is currently disabled.` });
            return false;
        }
        return true; 
    } catch (e: any) {
        console.error(`[Feature Guard] Failed to verify ${featureKey}`, e.message);
        res.status(500).json({ error: "Feature Guard verification failed" });
        return false;
    }
}

// -----------------------------------------------------------------------------
// MAIN HANDLER
// -----------------------------------------------------------------------------
async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.body?.action || req.query?.action;

    if (['claim-prize'].includes(action)) {
        if (!(await checkFeatureGuard('ugc_payment', res))) return;
    }

    switch (action) {
        case 'claim-prize': await handleClaimPrize(req, res); break;
        case 'leaderboard': await handleLeaderboard(req, res); break;
        case 'announce-winner': await handleAnnounceWinner(req, res); break;
        case 'campaign-join': await handleCampaignJoin(req, res); break;
        default:
            return res.status(400).json({ error: `Invalid action: ${action}` });
    }
}

async function handleAnnounceWinner(req: VercelRequest, res: VercelResponse) {
    const { raffle_id, wallet_address, signature, message } = req.body;
    if (!raffle_id || !wallet_address || !signature || !message) {
        return res.status(400).json({ error: 'Missing required authorization fields' });
    }

    try {
        const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid || !(await isAuthorizedAdmin(wallet_address))) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Replay protection: verify message details
        const lowerMsg = String(message).toLowerCase();
        if (!lowerMsg.includes('announce winner') || !lowerMsg.includes(`raffle #${raffle_id}`)) {
            return res.status(400).json({ error: 'Invalid message structure' });
        }

        // Timestamp expiration (replay protection)
        const isoMatch = message.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/);
        if (!isoMatch) return res.status(401).json({ error: 'Missing timestamp in signature message' });
        const messageTime = new Date(isoMatch[0]).getTime();
        if (Math.abs(Date.now() - messageTime) / (1000 * 60) > 5) {
            return res.status(401).json({ error: 'Signature expired (max 5 min old)' });
        }
        const raffleInfo: any = await rpcClient.readContract({
            address: RAFFLE_ADDRESS as `0x${string}`,
            abi: RAFFLE_ABI,
            functionName: 'getRaffleInfo',
            args: [BigInt(raffle_id)]
        });

        if (!raffleInfo.isFinalized) return res.status(400).json({ error: 'Raffle is not finalized' });

        const winners = (raffleInfo.winners || []).filter((w: string) => w !== ZERO_ADDRESS);
        if (winners.length === 0) return res.status(400).json({ error: 'No winners found' });

        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            const winnersList = winners.map((w: string) => `• \`${w.slice(0, 6)}...${w.slice(-4)}\``).join('\n');
            const prizeETH = (Number(raffleInfo.prizePool) / 1e18).toFixed(4);
            
            const text = `🎉 *RAFFLE #${raffle_id} FINALIZED!* 🎉\n\n` +
                `量子サイコロが振られ、当選者が決定しました！ \n\n` +
                `💰 *Total Prize:* ${prizeETH} ETH\n` +
                `🏆 *Winners:*\n${winnersList}\n\n` +
                `🔗 Status & Claim: \n${DISCO_APP_URL}/raffles`;

            await fetch(`${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text,
                    parse_mode: 'Markdown'
                })
            });
        }

        return res.status(200).json({ success: true, message: 'Announcement sent' });
    } catch (error: any) {
        return res.status(500).json({ error: sanitizeError(error) });
    }
}

async function handleClaimPrize(req: VercelRequest, res: VercelResponse) {
    const { wallet_address, signature, message, raffle_id, tx_hash } = req.body;
    if (!wallet_address || !signature || !message || !raffle_id) return res.status(400).json({ error: 'Missing required fields' });

    try {
        const valid = await verifyMessage({ address: wallet_address as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        if (!message.includes(`Raffle ID: ${raffle_id}`)) throw new Error(`Message mismatch for Raffle ID: ${raffle_id}`);

        const normalizedWallet = wallet_address.toLowerCase();

        // Verify tx_hash on-chain if provided (data integrity check)
        let txVerified = false;
        if (tx_hash) {
            try {
                const receipt = await rpcClient.getTransactionReceipt({ hash: tx_hash as `0x${string}` });
                txVerified = receipt?.status === 'success' && receipt.from.toLowerCase() === normalizedWallet;
            } catch {
                // tx_hash verification is best-effort — claim still proceeds based on winner array check
            }
        }

        // Read raffle info to verify winner AND get prize amount
        let prizePerWinner = 0;
        try {
            const raffleInfo: any = await rpcClient.readContract({
                address: RAFFLE_ADDRESS as `0x${string}`,
                abi: RAFFLE_ABI,
                functionName: 'getRaffleInfo',
                args: [BigInt(raffle_id)]
            });

            const winners = (raffleInfo.winners || []).map((w: string) => w.toLowerCase());
            if (!winners.includes(normalizedWallet)) {
                return res.status(403).json({ error: `Not a registered winner for Raffle #${raffle_id}` });
            }
            // Extract prize per winner (field index 14 in RaffleInfo struct)
            prizePerWinner = Number(raffleInfo.prizePerWinner || raffleInfo[14] || 0) / 1e18;
        } catch (onChainErr: any) {
            return res.status(500).json({ error: sanitizeError(onChainErr) });
        }

        const { count } = await supabaseAdmin
            .from('user_task_claims')
            .select('id', { count: 'exact', head: true })
            .eq('wallet_address', normalizedWallet)
            .eq('task_id', `raffle_win_${raffle_id}`);

        if (count && count > 0) return res.status(200).json({ success: true, alreadyClaimed: true });

        const { data: setting } = await supabaseAdmin.from('point_settings').select('points_value').eq('activity_key', 'raffle_win').maybeSingle();
        const xpAwarded = setting?.points_value || 0;

        const { error: claimError } = await supabaseAdmin
            .from('user_task_claims')
            .insert({
                wallet_address: normalizedWallet,
                task_id: `raffle_win_${raffle_id}`,
                xp_earned: xpAwarded,
                platform: 'system',
                action_type: 'raffle_win',
                target_id: `raffle_win_${raffle_id}`,
                claimed_at: new Date().toISOString()
            });

        if (claimError) {
            if (claimError.code === '23505') {
                return res.status(200).json({ success: true, alreadyClaimed: true });
            }
            throw claimError;
        }

        if (xpAwarded > 0) {
            await supabaseAdmin.rpc('fn_increment_xp', { p_wallet: normalizedWallet, p_amount: xpAwarded });
        }

        await supabaseAdmin.rpc('fn_increment_raffle_wins', { p_wallet: normalizedWallet });
        await notifyTelegramWinner(normalizedWallet, raffle_id, xpAwarded);

        // XP reward log
        await logActivity({
            wallet: normalizedWallet,
            category: 'XP',
            type: 'Raffle Win XP',
            description: `Earned ${xpAwarded} XP for winning Raffle #${raffle_id}`,
            amount: xpAwarded,
            symbol: 'XP',
            txHash: tx_hash
        });

        // Raffle-specific prize claim log with actual ETH prize amount
        await logActivity({
            wallet: normalizedWallet,
            category: 'RAFFLE',
            type: 'Prize Claim',
            description: `Claimed ${prizePerWinner.toFixed(4)} ETH prize for Raffle #${raffle_id}`,
            amount: prizePerWinner,
            symbol: 'ETH',
            txHash: tx_hash,
            metadata: { raffle_id, xp_awarded: xpAwarded, prize_eth: prizePerWinner, tx_verified: txVerified }
        });

        return res.status(200).json({ success: true, xpAwarded, prizeETH: prizePerWinner });
    } catch (error: any) {
        return res.status(500).json({ error: sanitizeError(error) });
    }
}

async function handleLeaderboard(req: VercelRequest, res: VercelResponse) {
    const { limit = '20', sort_by = 'raffle_wins' } = req.query as { limit?: string, sort_by?: string };
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
    } catch (error: any) {
        return res.status(500).json({ error: sanitizeError(error) });
    }
}

async function logActivity({ wallet, category, type, description, amount, symbol, txHash, metadata }: any) {
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
    } catch (err: any) {
        console.error('[logActivity Error]', err.message);
    }
}

// ─── Campaign Join (consolidated from campaigns.ts) ──────────────────────────
async function handleCampaignJoin(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { campaign_id, wallet, signature, message } = req.body;
    if (!campaign_id || !wallet || !signature || !message) {
        return res.status(400).json({ error: 'Missing join data' });
    }

    try {
        const valid = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
        if (!valid) return res.status(401).json({ error: 'Invalid signature' });

        const isoMatch = message.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/);
        if (!isoMatch) return res.status(401).json({ error: 'Invalid message format: Missing timestamp' });
        const messageTime = new Date(isoMatch[0]).getTime();
        if (Math.abs(Date.now() - messageTime) / (1000 * 60) > 5) return res.status(401).json({ error: 'Signature expired' });

        const { data: joinRes, error: joinErr } = await supabaseAdmin
            .rpc('fn_join_campaign_atomic', {
                p_campaign_id: campaign_id,
                p_user_address: wallet.toLowerCase()
            });

        if (joinErr) throw joinErr;
        if (joinRes && !joinRes.success) {
            return res.status(400).json({ error: joinRes.error });
        }

        return res.status(200).json({ success: true });
    } catch (error: any) {
        return res.status(500).json({ error: sanitizeError(error) });
    }
}

export default withMiddleware(handler);
