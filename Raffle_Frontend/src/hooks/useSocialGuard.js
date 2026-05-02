import { useQuery } from '@tanstack/react-query';

/**
 * Hook to verify social identity (Farcaster & Twitter).
 * Calls internal verification-server API.
 */
export function useSocialGuard(address) {
    return useQuery({
        queryKey: ['social-guard', address?.toLowerCase()],
        queryFn: async () => {
            if (!address) return null;

            // DEV-MODE BYPASS: Auto-verify mock admin wallet
            if (import.meta.env.DEV && address.toLowerCase() === '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266') {
                return {
                    farcaster: { username: 'nexus_admin', fid: 1, verified: true },
                    twitter: { username: 'nexus_dev', verified: true },
                    isVerified: true
                };
            }

            // [FIX v3.56.5] Call the new unified endpoint in user-bundle.js
            const res = await fetch(`/api/user/social-status?address=${address.toLowerCase()}`);
            if (!res.ok) {
                console.warn('[useSocialGuard] Failed to fetch social status');
                return { isVerified: false };
            }
            return await res.json();
        },
        enabled: !!address,
        staleTime: 1000 * 60 * 5,   // 5 min cache
        cacheTime: 1000 * 60 * 30,  // 30 min in memory
    });
}
