import { useQuery } from '@tanstack/react-query';
import { userService } from '../../../services/userService';

/**
 * Custom hooks for profile-related queries.
 * [v3.60.0] Modular Feature-Based Architecture
 */

export const useProfile = (address) => {
    return useQuery({
        queryKey: ['profile', address],
        queryFn: () => userService.getProfile(address),
        enabled: !!address,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useActivityLogs = (address, category) => {
    return useQuery({
        queryKey: ['activity-logs', address, category],
        queryFn: () => userService.getActivityLogs(address, category),
        enabled: !!address,
        staleTime: 1000 * 30, // 30 seconds
    });
};

export const useReputation = (address) => {
    return useQuery({
        queryKey: ['reputation', address],
        queryFn: () => userService.getReputationStatus(address),
        enabled: !!address,
    });
};
