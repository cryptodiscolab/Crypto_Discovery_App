import { useReadContract } from 'wagmi';
import { CONTRACTS, DAILY_APP_ABI } from '../lib/contracts';
import { supabase } from '../lib/supabaseClient';
import { useState, useEffect } from 'react';

export function useTaskInfo(taskId: string | number): { task: any, isLoading: boolean } {
    const [dbMetadata, setDbMetadata] = useState<any>(null);
    const { data: task, isLoading: isContractLoading } = useReadContract({
        address: CONTRACTS.DAILY_APP as any,
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
            } catch (err: any) {
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
            baseReward: Number((task as any)[0]),
            isActive: (task as any)[1],
            cooldown: Number((task as any)[2]),
            minTier: Number((task as any)[3] || 0),
            title: (task as any)[4],
            link: (task as any)[5],
            createdAt: Number((task as any)[6]),
            requiresVerification: (task as any)[7],
            sponsorshipId: Number((task as any)[8]),
            // Hybrid Metadata (v3.41.2 Hardening)
            platform: (dbMetadata as any)?.platform || ((task as any)[4].toLowerCase().includes('twitter') ? 'twitter' : 'farcaster'),
            action_type: (dbMetadata as any)?.action_type || ((task as any)[4].toLowerCase().includes('follow') ? 'follow' : 'like'),
            isBaseSocialRequired: (dbMetadata as any)?.is_base_social_required || false
        },
        isLoading: isContractLoading
    };
}
