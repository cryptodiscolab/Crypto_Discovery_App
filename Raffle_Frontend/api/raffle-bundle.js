import { createClient } from '@supabase/supabase-js';
import { verifyMessage, createPublicClient, http } from 'viem';
import { baseSepolia, base } from 'viem/chains';

const supabaseAdmin = createClient(
    (process.env.VITE_SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
);

const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TELEGRAM_CHAT_ID = (process.env.TELEGRAM_CHAT_ID || '').trim();

// 1. DYNAMIC NETWORK SWITCHER (MAINNET SECURE)
const CHAIN_ID = (process.env.VITE_CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || '84532').trim();
const isMainnet = CHAIN_ID === '8453';
const RPC_URL = (isMainnet ? process.env.VITE_RPC_URL : process.env.VITE_BASE_SEPOLIA_RPC_URL) || 'https://sepolia.base.org';

const publicClient = createPublicClient({
    chain: isMainnet ? base : baseSepolia,
    transport: http(RPC_URL)
});

const RAFFLE_ABI = [
    {
        "inputs": [{ "internalType": "uint256", "name": "raffleId", "type": "uint256" }],
        "name": "getRaffleInfo",
        "outputs": [
            {
                "components": [
                    { "internalType": "uint256", "name": "raffleId", "type": "uint256" },
                    { "internalType": "uint256", "name": "totalTickets", "type": "uint256" },
                    { "internalType": "uint256", "name": "maxTickets", "type": "uint256" },
                    { "internalType": "uint256", "name": "targetPrizePool", "type": "uint256" },
                    { "internalType": "uint256", "name": "prizePool", "type": "uint256" },
                    { "internalType": "address[]", "name": "participants", "type": "address[]" },
                    { "internalType": "address[]", "name": "winners", "type": "address[]" },
                    { "internalType": "uint256", "name": "winnerCount", "type": "uint256" },
                    { "internalType": "uint256", "name": "randomNumber", "type": "uint256" },
                    { "internalType": "bool", "name": "isActive", "type": "bool" },
                    { "internalType": "bool", "name": "isFinalized", "type": "bool" },
                    { "internalType": "address", "name": "sponsor", "type": "address" },
                    { "internalType": "string", "name": "metadataURI", "type": "string" },
                    { "internalType": "uint256", "name": "endTime", "type": "uint256" },
                    { "internalType": "uint256", "name": "prizePerWinner", "type": "uint256" }
                ],
                "internalType": "struct NFT_Raffle_V2.RaffleInfo",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];


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

// -----------------------------------------------------------------------------
// FEATURE FLAGS & PHASED ROLLOUT (MAINNET SAFEGUARD)
// -----------------------------------------------------------------------------

async function checkFeatureGuard(featureKey, res) {
    if (!isMainnet) return true; // Bypass restriction if still on Sepolia Testnet
    
    try {
        const { data } = await supabaseAdmin
            .from('system_settings')
            .select('value')
            .eq('key', 'active_features')
            .maybeSingle();
        
        const activeFeatures = data?.value || {};
        if (activeFeatures[featureKey] !== true) {
            console.warn(`[Feature Guard] BLOCKED: Attempt to access disabled feature '${featureKey}' on Mainnet.`);
            res.status(403).json({ error: `Feature [${featureKey}] is currently disabled for Phased Rollout. Please wait for the next phase.` });
            return false;
        }
        return true; 
    } catch (e) {
        console.error(`[Feature Guard] Failed to verify ${featureKey}`, e.message);
        res.status(500).json({ error: "Feature Guard verification failed" });
        return false;
    }
}

export default async function handler(req, res) {
    const action = req.body?.action || req.query?.action;

    // Guard UGC/Raffle actions
    if (['claim-prize'].includes(action)) {
        const allowed = await checkFeatureGuard('ugc_payment', res);
        if (!allowed) return;
    }

    switch (action) {
        case 'claim-prize':
            await handleClaimPrize(req, res);
            break;
        case 'leaderboard':
            await handleLeaderboard(req, res);
            break;
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

        // [Hardening v3.56.7] Message Integrity Check
        if (!message.includes(`Raffle ID: ${raffle_id}`)) {
            throw new Error(`[Security] Message mismatch. Expected Raffle ID: ${raffle_id}`);
        }

        const normalizedWallet = wallet_address.toLowerCase();

        // ─── 1.1 On-Chain Winner Verification (Hardening v3.55.0) ──────────────
        try {
            const raffleInfo = await publicClient.readContract({
                address: process.env.VITE_RAFFLE_ADDRESS_SEPOLIA,
                abi: RAFFLE_ABI,
                functionName: 'getRaffleInfo',
                args: [BigInt(raffle_id)]
            });

            const winners = (raffleInfo.winners || []).map(w => w.toLowerCase());
            if (!winners.includes(normalizedWallet)) {
                return res.status(403).json({ error: `[Security] User ${normalizedWallet} is not a registered winner for Raffle #${raffle_id} on-chain.` });
            }
        } catch (onChainErr) {
            console.error('[handleClaimPrize] On-chain verification failed:', onChainErr.message);
            return res.status(500).json({ error: `Blockchain verification failed: ${onChainErr.message}` });
        }

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
            .maybeSingle();

        const xpAwarded = setting?.points_value || 0; // Default to 0 if not set, enforcing config-driven rewards

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
