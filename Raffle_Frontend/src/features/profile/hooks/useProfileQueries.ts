import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabaseClient';
import { userService } from '../../../services/userService';

/**
 * Custom hooks for profile-related queries.
 * [v3.60.0] Modular Feature-Based Architecture
 */

export const useProfile = (address: string | undefined) => {
    const queryClient = useQueryClient();
    const query = useQuery({
        queryKey: ['profile', address],
        queryFn: () => userService.getProfile(address!),
        enabled: !!address,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    useEffect(() => {
        if (!address) return;

        const cleanAddress = address.toLowerCase();
        const channel = supabase
            .channel(`profile-live-${cleanAddress}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'user_profiles',
                filter: `wallet_address=eq.${cleanAddress}`,
            }, () => {
                queryClient.invalidateQueries({ queryKey: ['profile', address] });
            })
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [address, queryClient]);

    return query;
};

export const useActivityLogs = (address: string | undefined, category?: string) => {
    const queryClient = useQueryClient();
    const query = useQuery({
        queryKey: ['activity-logs', address, category],
        queryFn: () => userService.getActivityLogs(address!, category),
        enabled: !!address,
        staleTime: 0, // Always refetch on mount/category change
        refetchOnWindowFocus: true,
    });

    useEffect(() => {
        if (!address) return;

        const cleanAddress = address.toLowerCase();
        const invalidateActivityLogs = () => {
            queryClient.invalidateQueries({ queryKey: ['activity-logs', address] });
        };

        const channel = supabase
            .channel(`activity-live-${cleanAddress}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'user_activity_logs',
                filter: `wallet_address=eq.${cleanAddress}`,
            }, invalidateActivityLogs)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'user_task_claims',
                filter: `wallet_address=eq.${cleanAddress}`,
            }, invalidateActivityLogs)
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [address, queryClient]);

    return query;
};

export const useReputation = (address: string | undefined) => {
    return useQuery({
        queryKey: ['reputation', address],
        queryFn: () => userService.getReputationStatus(address!),
        enabled: !!address,
    });
};
