'use client';

import { useQuery } from '@tanstack/react-query';

interface NeynarUser {
    fid: number;
    custody_address: string;
    verifications: string[];
}

/**
 * Hook untuk memverifikasi identitas Farcaster user.
 * ✅ AMAN: Neynar API Key dipanggil via server-side API Route,
 *    bukan langsung dari browser (Fix V-01).
 */
export function useSocialGuard(address: string | undefined) {
    return useQuery({
        queryKey: ['farcaster-check', address?.toLowerCase()],
        queryFn: async () => {
            if (!address) return null;

            // ✅ Panggil API Route internal (server-side), bukan Neynar langsung
            const res = await fetch(`/api/farcaster-check?address=${address.toLowerCase()}`);

            if (res.status === 404) return null;

            if (!res.ok) {
                throw new Error('Farcaster check failed');
            }

            return res.json() as Promise<NeynarUser | null>;
        },
        enabled: !!address,
        staleTime: 1000 * 60 * 5,   // Cache 5 menit
        gcTime: 1000 * 60 * 30,     // Tetap di memory 30 menit
    });
}
