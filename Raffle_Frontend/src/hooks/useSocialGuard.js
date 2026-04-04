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

            // Parallel check for both platforms
            const [farRes, twitRes] = await Promise.all([
                fetch(`/api/verify/farcaster/check?address=${address.toLowerCase()}`),
                fetch(`/api/verify/twitter/check?address=${address.toLowerCase()}`)
            ]);

            const farData = farRes.ok ? await farRes.json() : null;
            const twitData = twitRes.ok ? await twitRes.json() : null;

            return {
                farcaster: farData,
                twitter: twitData,
                isVerified: !!(farData?.verified || twitData?.verified)
            };
        },
        enabled: !!address,
        staleTime: 1000 * 60 * 5,   // 5 min cache
        cacheTime: 1000 * 60 * 30,  // 30 min in memory
    });
}
