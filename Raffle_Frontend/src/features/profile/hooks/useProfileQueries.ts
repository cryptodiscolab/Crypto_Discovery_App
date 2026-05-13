import { useQuery } from '@tanstack/react-query';
import { userService } from '../../../services/userService';

/**
 * Custom hooks for profile-related queries.
 * [v3.60.0] Modular Feature-Based Architecture
 */

export const useProfile = (address: string | undefined) => {
    return useQuery({
        queryKey: ['profile', address],
        queryFn: () => userService.getProfile(address!),
        enabled: !!address,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useActivityLogs = (address: string | undefined, category?: string) => {
    return useQuery({
        queryKey: ['activity-logs', address, category],
        queryFn: () => userService.getActivityLogs(address!, category),
        enabled: !!address,
        staleTime: 0, // Always refetch on mount/category change
        refetchOnWindowFocus: true,
    });
};

export const useReputation = (address: string | undefined) => {
    return useQuery({
        queryKey: ['reputation', address],
        queryFn: () => userService.getReputationStatus(address!),
        enabled: !!address,
    });
};
