import { useQuery } from '@tanstack/react-query';

/**
 * Hook to verify Farcaster identity.
 * Calls internal API proxy to keep Neynar key secure on server.
 */
export function useSocialGuard(address) {
    return useQuery({
        queryKey: ['farcaster-check', address?.toLowerCase()],
        queryFn: async () => {
            if (!address) return null;

            const res = await fetch(`/api/farcaster/check?address=${address.toLowerCase()}`);

            if (res.status === 404) return null;

            if (!res.ok) {
                throw new Error('Farcaster check failed');
            }

            return res.json();
        },
        enabled: !!address,
        staleTime: 1000 * 60 * 5,   // 5 min cache
        cacheTime: 1000 * 60 * 30,  // 30 min in memory
    });
}
