import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';

export type PendingSyncAction =
    | 'raffle_buy'
    | 'raffle_claim'
    | 'raffle_create'
    | 'raffle_reject'
    | 'daily_claim'
    | 'pool_claim'
    | 'sbt_upgrade'
    | 'sbt_mint'
    | 'mission_create'
    | 'campaign_join';

export interface PendingSyncJob {
    id: number;
    action_type: PendingSyncAction;
    tx_hash: string | null;
    chain_id: number | null;
    status: 'pending' | 'resolved' | 'failed' | 'abandoned';
    retry_count: number;
    created_at: string;
    last_attempted_at: string | null;
    error_message: string | null;
}

interface RecordOptions {
    actionType: PendingSyncAction;
    txHash?: string | null;
    chainId?: number | null;
    contractAddress?: string | null;
    payload?: Record<string, unknown> | null;
    errorMessage?: string | null;
}

/**
 * usePendingSyncRecovery
 *
 * Provides helpers for the chain-success/backend-failure recovery ledger.
 * Components should call `recordFailure(...)` whenever a transaction confirms
 * on-chain but the subsequent backend sync fetch fails. The reconciliation
 * cron will retry these jobs server-side; the UI can also surface the list
 * via `pendingJobs` to show "sync pending" indicators.
 */
export function usePendingSyncRecovery() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [pendingJobs, setPendingJobs] = useState<PendingSyncJob[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (!address) {
            setPendingJobs([]);
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch(`/api/user-bundle?action=get-pending-syncs&wallet=${address.toLowerCase()}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data?.success && Array.isArray(data.jobs)) {
                setPendingJobs(data.jobs);
            }
        } catch (err) {
            console.warn('[PendingSync] refresh failed:', err);
        } finally {
            setIsLoading(false);
        }
    }, [address]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    /**
     * Record a backend-sync failure that occurred AFTER the on-chain tx already succeeded.
     * Returns the inserted job id, or null if the recording itself failed.
     */
    const recordFailure = useCallback(async (opts: RecordOptions): Promise<number | null> => {
        if (!address) return null;
        try {
            const timestamp = new Date().toISOString();
            const message = `Record Pending Sync\nAction: ${opts.actionType}\nTx: ${opts.txHash || 'none'}\nWallet: ${address}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const res = await fetch('/api/user-bundle', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    action: 'record-pending-sync',
                    wallet: address,
                    signature,
                    message,
                    action_type: opts.actionType,
                    tx_hash: opts.txHash || null,
                    chain_id: opts.chainId || null,
                    contract_address: opts.contractAddress || null,
                    payload: opts.payload || null,
                    error_message: opts.errorMessage || null
                })
            });
            if (!res.ok) return null;
            const data = await res.json();
            if (data?.success && data?.job_id) {
                refresh().catch(() => {});
                return data.job_id as number;
            }
            return null;
        } catch (err) {
            console.warn('[PendingSync] recordFailure failed:', err);
            return null;
        }
    }, [address, signMessageAsync, refresh]);

    return {
        pendingJobs,
        hasPending: pendingJobs.length > 0,
        isLoading,
        recordFailure,
        refresh
    };
}
