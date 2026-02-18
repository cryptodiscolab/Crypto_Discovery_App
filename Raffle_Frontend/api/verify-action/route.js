import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

/**
 * POST /api/verify-action
 *
 * FIX #3: Secure write endpoint for all sensitive Supabase operations.
 * Flow: Frontend signs message → This route verifies signature → Writes to DB with SERVICE_ROLE_KEY
 *
 * Body: {
 *   action: 'claim_task' | 'update_profile',
 *   wallet: string,       // lowercase EVM address
 *   message: string,      // the exact message that was signed
 *   signature: string,    // hex signature from wagmi signMessage
 *   payload: object       // action-specific data
 * }
 */
export async function POST(req) {
    try {
        const body = await req.json();
        const { action, wallet, message, signature, payload } = body;

        // ── 1. Input validation ──────────────────────────────────────────────
        if (!action || !wallet || !message || !signature || !payload) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const normalizedWallet = wallet.toLowerCase();

        // ── 2. Cryptographic signature verification (viem) ───────────────────
        let isValid = false;
        try {
            isValid = await verifyMessage({
                address: wallet,       // viem handles checksum internally
                message,
                signature,
            });
        } catch {
            return Response.json({ error: 'Signature verification failed' }, { status: 401 });
        }

        if (!isValid) {
            return Response.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // ── 3. Verify message contains wallet address ────────────────────────
        if (!message.toLowerCase().includes(normalizedWallet)) {
            return Response.json({ error: 'Message does not match wallet' }, { status: 401 });
        }

        // ── 4. Anti-replay: validate timestamp in signed message ─────────────
        // Message format (from useVerifiedAction.js):
        //   "Crypto Disco App\nAction: ...\nWallet: 0x...\nTimestamp: 1234567890"
        const timestampMatch = message.match(/Timestamp: (\d+)/);
        if (!timestampMatch) {
            return Response.json({ error: 'Missing timestamp in message' }, { status: 401 });
        }

        const msgTimestamp = parseInt(timestampMatch[1], 10);
        const nowSeconds = Math.floor(Date.now() / 1000);
        const MAX_AGE_SECONDS = 300; // 5 minutes — signature expires after this

        if (isNaN(msgTimestamp) || nowSeconds - msgTimestamp > MAX_AGE_SECONDS) {
            return Response.json({ error: 'Signature expired — please sign again' }, { status: 401 });
        }

        // Guard against future-dated timestamps (clock skew tolerance: 30s)
        if (msgTimestamp > nowSeconds + 30) {
            return Response.json({ error: 'Timestamp is in the future' }, { status: 401 });
        }

        // ── 5. Initialize Supabase with SERVICE_ROLE_KEY (server-side only) ──
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY  // Never expose this to client
        );

        // ── 6. Route to the correct action ───────────────────────────────────
        switch (action) {
            case 'claim_task':
                return await handleClaimTask(supabase, normalizedWallet, payload);

            case 'update_profile':
                return await handleUpdateProfile(supabase, normalizedWallet, payload);

            default:
                return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }

    } catch (err) {
        console.error('[verify-action] Unhandled error:', err);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ── ACTION HANDLERS ──────────────────────────────────────────────────────────

/**
 * Claim a daily task for a wallet.
 * Checks eligibility before writing.
 */
async function handleClaimTask(supabase, wallet, payload) {
    const { task_id, xp_earned } = payload;

    if (!task_id || typeof xp_earned !== 'number' || xp_earned < 0) {
        return Response.json({ error: 'Invalid claim payload' }, { status: 400 });
    }

    // Check task exists and is active
    const { data: task, error: taskErr } = await supabase
        .from('daily_tasks')
        .select('id, is_active, xp_reward, max_claims, current_claims')
        .eq('id', task_id)
        .eq('is_active', true)
        .single();

    if (taskErr || !task) {
        return Response.json({ error: 'Task not found or inactive' }, { status: 404 });
    }

    // Check max claims not exceeded
    if (task.max_claims !== null && task.current_claims >= task.max_claims) {
        return Response.json({ error: 'Task is full' }, { status: 409 });
    }

    // Check not already claimed today
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
        .from('user_task_claims')
        .select('id')
        .eq('wallet_address', wallet)
        .eq('task_id', task_id)
        .gte('claimed_at', `${today}T00:00:00Z`)
        .maybeSingle();

    if (existing) {
        return Response.json({ error: 'Already claimed today' }, { status: 409 });
    }

    // Ensure user profile exists (upsert)
    await supabase
        .from('user_profiles')
        .upsert({ wallet_address: wallet }, { onConflict: 'wallet_address', ignoreDuplicates: true });

    // Insert claim — SERVICE_ROLE bypasses RLS
    const { error: claimErr } = await supabase
        .from('user_task_claims')
        .insert({
            wallet_address: wallet,
            task_id,
            xp_earned: task.xp_reward, // Use DB value, not client-provided
        });

    if (claimErr) {
        console.error('[claim_task] Insert error:', claimErr);
        return Response.json({ error: claimErr.message }, { status: 500 });
    }

    return Response.json({ success: true, xp_earned: task.xp_reward });
}

/**
 * Update a user's profile (display name, avatar, etc.)
 */
async function handleUpdateProfile(supabase, wallet, payload) {
    // Whitelist allowed fields — never trust client to decide what to update
    const allowedFields = ['display_name', 'avatar_url', 'bio'];
    const updates = {};

    for (const field of allowedFields) {
        if (payload[field] !== undefined) {
            updates[field] = payload[field];
        }
    }

    if (Object.keys(updates).length === 0) {
        return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('wallet_address', wallet);

    if (error) {
        console.error('[update_profile] Update error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
}
