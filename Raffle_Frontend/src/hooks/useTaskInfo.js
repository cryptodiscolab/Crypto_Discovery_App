import { useReadContract } from 'wagmi';
import { CONTRACTS, DAILY_APP_ABI } from '../lib/contracts';
import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';

export function useTaskInfo(taskId) {
    const [dbMetadata, setDbMetadata] = useState(null);
    const { data: task, isLoading: isContractLoading } = useReadContract({
        address: CONTRACTS.DAILY_APP,
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
                if (data) setDbMetadata(data);
            } catch (err) {
                console.warn('[useTaskInfo] DB fetch failed:', err.message);
            }
        };
        fetchMetadata();
    }, [taskId]);

    if (!task || isContractLoading) return { task: null, isLoading: isContractLoading };

    // Standard mapping from Contract Tuple to Task Object
    return {
        task: {
            id: Number(taskId),
            baseReward: Number(task[0]),
            isActive: task[1],
            cooldown: Number(task[2]),
            minTier: Number(task[3] || 0),
            title: task[4],
            link: task[5],
            createdAt: Number(task[6]),
            requiresVerification: task[7],
            sponsorshipId: Number(task[8]),
            // Hybrid Metadata (v3.41.2 Hardening)
            platform: dbMetadata?.platform || (task[4].toLowerCase().includes('twitter') ? 'twitter' : 'farcaster'),
            action_type: dbMetadata?.action_type || (task[4].toLowerCase().includes('follow') ? 'follow' : 'like'),
            isBaseSocialRequired: dbMetadata?.is_base_social_required || false
        },
        isLoading: isContractLoading
    };
}
