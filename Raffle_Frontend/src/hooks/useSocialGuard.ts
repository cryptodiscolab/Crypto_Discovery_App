import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { SocialProfile } from '../types';

/**
 * Hook to verify social identity (Farcaster & Twitter).
 * Calls internal verification-server API.
 */
export function useSocialGuard(address?: string): UseQueryResult<SocialProfile | null, Error> {
    return useQuery({
        queryKey: ['social-guard', address?.toLowerCase()],
        queryFn: async (): Promise<SocialProfile | null> => {
            if (!address) return null;

            // SECURITY: DEV-only bypass — import.meta.env.DEV is false in production builds
            if (import.meta.env.DEV && import.meta.env.VITE_DEV_WALLET && address.toLowerCase() === import.meta.env.VITE_DEV_WALLET.toLowerCase()) {
                return {
                    farcaster: { username: 'nexus_admin', fid: 1, verified: true },
                    twitter: { username: 'nexus_dev', verified: true },
                    isVerified: true
                };
            }

            // [FIX v3.64.30] Corrected endpoint — was /api/user/social-status (non-existent), now correct bundle route
            const res = await fetch(`/api/user-bundle?action=social-status&address=${address.toLowerCase()}`);
            if (!res.ok) {
                console.warn('[useSocialGuard] Failed to fetch social status');
                return { isVerified: false };
            }
            return await res.json();
        },
        enabled: !!address,
        staleTime: 1000 * 60 * 5,   // 5 min cache
        gcTime: 1000 * 60 * 30,  // 30 min in memory
    });
}
