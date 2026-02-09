'use client';

import { useQuery } from '@tanstack/react-query';

interface NeynarUser {
    fid: number;
    custody_address: string;
    verifications: string[];
}

export function useSocialGuard(address: string | undefined) {
    return useQuery({
        queryKey: ['farcaster-check', address],
        queryFn: async () => {
            if (!address) return null;

            const response = await fetch(
                `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address}`,
                {
                    headers: {
                        'api_key': process.env.NEXT_PUBLIC_NEYNAR_API_KEY || '',
                    },
                }
            );

            if (response.status === 404) {
                return null; // Handle 404 as "No Farcaster account found"
            }

            if (!response.ok) {
                throw new Error('Neynar API failure');
            }

            const data = await response.json();
            const normalizedAddress = address.toLowerCase();
            const userList = data[normalizedAddress] || [];
            return userList.length > 0 ? userList[0] : null;
        },
        enabled: !!address,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
        gcTime: 1000 * 60 * 30, // Keep in memory for 30 minutes
    });
}
