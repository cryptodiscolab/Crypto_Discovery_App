import { useReadContract } from 'wagmi';
import { CONTRACTS, DAILY_APP_ABI } from '../lib/contracts';
import { supabase } from '../lib/supabaseClient';
import { useState, useEffect } from 'react';
import { Task, ContractTask } from '../types/tasks';
import { Database } from '../types/database.types';

type DailyTask = Database['public']['Tables']['daily_tasks']['Row'];

export function useTaskInfo(taskId: string | number): { task: Task | null, isLoading: boolean } {
    const [dbMetadata, setDbMetadata] = useState<DailyTask | null>(null);
    const { data: task, isLoading: isContractLoading } = useReadContract({
        address: CONTRACTS.DAILY_APP as `0x${string}`,
        abi: DAILY_APP_ABI,
        functionName: 'getTask',
        args: [BigInt(taskId)],
    });

    useEffect(() => {
        if (!taskId) return;
        const fetchMetadata = async () => {
            try {
                const { data } = await supabase
                    .from('daily_tasks')
                    .select('is_base_social_required, platform, action_type')
                    .eq('id', taskId)
                    .maybeSingle();
                if (data) setDbMetadata(data as DailyTask);
            } catch (err: unknown) {
                console.warn('[useTaskInfo] DB fetch failed:', err.message);
            }
        };
        fetchMetadata();
    }, [taskId]);

    if (!task || isContractLoading) return { task: null, isLoading: isContractLoading };

    const t = task as ContractTask;

    // Standard mapping from Contract Tuple to Task Object
    return {
        task: {
            id: Number(taskId),
            baseReward: Number(t[0]),
            isActive: t[1],
            cooldown: Number(t[2]),
            minTier: Number(t[3] || 0),
            title: t[4],
            link: t[5],
            createdAt: Number(t[6]),
            requiresVerification: t[7],
            sponsorshipId: Number(t[8]),
            // Hybrid Metadata (v3.41.2 Hardening)
            platform: dbMetadata?.platform || (t[4].toLowerCase().includes('twitter') ? 'twitter' : 'farcaster'),
            action_type: dbMetadata?.action_type || (t[4].toLowerCase().includes('follow') ? 'follow' : 'like'),
            isBaseSocialRequired: dbMetadata?.is_base_social_required || false
        },
        isLoading: isContractLoading
    };
}
