import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useReadContract } from 'wagmi';
import { ABIS, CONTRACTS } from '../../../lib/contracts';
import { raffleService } from '../../../services/raffleService';
import { Raffle } from '../../../types';

export const RAFFLE_QUERY_KEYS = {
    activeIds: ['raffle', 'activeIds'] as const,
    metadata: (id: string | number) => ['raffle', 'metadata', id] as const,
};

const RAFFLE_ADDRESS = CONTRACTS.RAFFLE as `0x${string}`;

export interface RaffleListResult {
    raffleIds: number[];
    count: number;
    totalOnChain: number;
    isLoading: boolean;
    refetch: () => void;
}

export function useRaffleList(): RaffleListResult {
    // Fetch Active Raffle IDs from Supabase
    const dbQuery = useQuery({
        queryKey: RAFFLE_QUERY_KEYS.activeIds,
        queryFn: () => raffleService.getActiveRaffleIds(),
        staleTime: 1000 * 60 * 2, // 2 minutes cache
    });

    // Fetch Total Raffle Count from Blockchain
    const contractQuery = useReadContract({
        address: RAFFLE_ADDRESS,
        abi: ABIS.RAFFLE,
        functionName: 'currentRaffleId',
    });

    return {
        raffleIds: dbQuery.data || [],
        count: (dbQuery.data || []).length,
        totalOnChain: contractQuery.data ? Number(contractQuery.data) : 0,
        isLoading: dbQuery.isLoading || contractQuery.isLoading,
        refetch: dbQuery.refetch
    };
}

export interface RaffleInfoResult {
    raffle: Raffle | null;
    isLoading: boolean;
    refetch: () => void;
}

export function useRaffleInfo(raffleId: string | number): RaffleInfoResult {
    // 1. Fetch On-Chain Raffle State
    const { data: chainData, isLoading: chainLoading, refetch: refetchChain } = useReadContract({
        address: RAFFLE_ADDRESS,
        abi: ABIS.RAFFLE,
        functionName: 'getRaffleInfo',
        args: [BigInt(raffleId || 0)],
        query: {
            enabled: !!raffleId,
        }
    });

    // 2. Fetch Off-Chain Metadata from Supabase
    const { data: dbData, isLoading: dbLoading, refetch: refetchDb } = useQuery({
        queryKey: RAFFLE_QUERY_KEYS.metadata(raffleId),
        queryFn: () => raffleService.getRaffleMetadata(raffleId),
        enabled: !!raffleId,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });

    const isLoading = chainLoading || dbLoading;

    if (!chainData || isLoading) return { raffle: null, isLoading };

    // Merge on-chain truth with off-chain rich metadata
    return {
        raffle: {
            id: Number(chainData.raffleId),
            totalTickets: Number(chainData.totalTickets),
            maxTickets: Number(chainData.maxTickets),
            targetPrizePool: chainData.targetPrizePool,
            prizePool: chainData.prizePool,
            participants: chainData.participants,
            winners: chainData.winners,
            winnerCount: Number(chainData.winnerCount),
            randomNumber: chainData.randomNumber,
            isActive: chainData.isActive,
            isFinalized: chainData.isFinalized,
            sponsor: chainData.sponsor,
            metadataURI: chainData.metadataURI,
            endTime: Number(chainData.endTime),
            prizePerWinner: chainData.prizePerWinner,
            ...(dbData || {}) // Spread title, image_url, description, etc.
        },
        isLoading,
        refetch: () => {
            refetchChain();
            refetchDb();
        }
    };
}
