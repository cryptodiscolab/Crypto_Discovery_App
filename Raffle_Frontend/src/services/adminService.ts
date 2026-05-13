import { supabase } from '../lib/supabaseClient';

class AdminService {
    // -----------------------------------------
    // Raffle Management
    // -----------------------------------------
    
    async fetchRecentRaffles(limit = 50) {
        const { data, error } = await supabase
            .from('raffles')
            .select('*')
            .order('id', { ascending: false })
            .limit(limit);
            
        if (error) throw error;
        return data;
    }

    async fetchRecentTickets(limit = 10) {
        const { data, error } = await supabase
            .from('raffle_tickets')
            .select('raffle_id, wallet_address, ticket_count, created_at')
            .order('created_at', { ascending: false })
            .limit(limit);
            
        if (error) throw error;
        return data;
    }

    async fetchRaffleLeaderboard() {
        const res = await fetch('/api/raffle/leaderboard');
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to fetch leaderboard');
        return data.data;
    }

    async announceWinner(raffleId: number | string) {
        const res = await fetch('/api/raffle/announce-winner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'announce-winner', raffle_id: raffleId })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to announce winner');
        return data;
    }

    async syncAdminRaffle(payload: any) {
        const res = await fetch('/api/admin/system/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to sync raffle');
        return data;
    }
}

export const adminService = new AdminService();
