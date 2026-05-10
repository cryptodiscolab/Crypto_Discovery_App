import { supabase } from '../lib/supabaseClient';

class RaffleService {
    // -----------------------------------------
    // Raffle Discovery & Data
    // -----------------------------------------

    async getActiveRaffleIds() {
        const { data, error } = await supabase
            .from('raffles')
            .select('id')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data?.map(r => r.id) || [];
    }

    async getRaffleMetadata(raffleId) {
        if (!raffleId) return null;
        
        const { data, error } = await supabase
            .from('raffles')
            .select('*')
            .eq('id', raffleId)
            .maybeSingle();

        if (error) throw error;
        return data;
    }
}

export const raffleService = new RaffleService();
