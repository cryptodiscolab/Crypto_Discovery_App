import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../../../services/adminService';
import toast from 'react-hot-toast';

export const ADMIN_QUERY_KEYS = {
    raffles: ['admin', 'raffles'],
    tickets: ['admin', 'tickets', 'recent'],
    leaderboard: ['admin', 'raffle', 'leaderboard'],
};

export function useAdminRaffleQueries() {
    const queryClient = useQueryClient();

    // 1. Fetch Raffles
    const rafflesQuery = useQuery({
        queryKey: ADMIN_QUERY_KEYS.raffles,
        queryFn: () => adminService.fetchRecentRaffles(50),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // 2. Fetch Recent Tickets
    const ticketsQuery = useQuery({
        queryKey: ADMIN_QUERY_KEYS.tickets,
        queryFn: () => adminService.fetchRecentTickets(10),
        staleTime: 1000 * 60, // 1 minute
    });

    // 3. Fetch Winners Leaderboard
    const leaderboardQuery = useQuery({
        queryKey: ADMIN_QUERY_KEYS.leaderboard,
        queryFn: () => adminService.fetchRaffleLeaderboard(),
        staleTime: 1000 * 60 * 5,
    });

    // Mutations
    const announceMutation = useMutation({
        mutationFn: (raffleId: number | string) => adminService.announceWinner(raffleId),
        onSuccess: () => {
            toast.success('Announcement sent to Telegram!');
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to announce winner');
        }
    });

    const syncRaffleMutation = useMutation({
        mutationFn: (payload: any) => adminService.syncAdminRaffle(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.raffles });
            toast.success('Raffle synced to DB successfully!');
        },
        onError: (err) => {
            console.warn('DB Sync failed:', err.message);
            // Don't toast error here because on-chain might have succeeded
        }
    });

    return {
        raffles: rafflesQuery.data || [],
        isLoadingRaffles: rafflesQuery.isLoading,
        refetchRaffles: rafflesQuery.refetch,
        
        recentTickets: ticketsQuery.data || [],
        isLoadingTickets: ticketsQuery.isLoading,
        refetchTickets: ticketsQuery.refetch,
        
        winners: leaderboardQuery.data || [],
        isLoadingWinners: leaderboardQuery.isLoading,
        refetchWinners: leaderboardQuery.refetch,
        
        announceWinner: announceMutation.mutateAsync,
        isAnnouncing: announceMutation.isPending,
        
        syncRaffle: syncRaffleMutation.mutateAsync,
    };
}
