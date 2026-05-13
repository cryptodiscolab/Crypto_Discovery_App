import axios from 'axios';

/**
 * Service to handle all User-related API interactions.
 * [v3.60.0] Modular Feature-Based Architecture
 */
export const userService = {
    /**
     * Get user profile details from the bundle
     */
    getProfile: async (address: string) => {
        const { data } = await axios.get(`/api/user-bundle?action=get-profile&wallet=${address}`);
        return data?.data || data;
    },

    /**
     * Get activity logs for a specific user and category
     */
    getActivityLogs: async (address: string, category = 'ALL') => {
        const { data } = await axios.get(`/api/user-bundle?action=get-activity-logs&wallet=${address}&category=${category}`);
        return data;
    },

    /**
     * Sync UGC Mission metadata after contract creation
     */
    syncUgcMission: async (payload: any) => {
        const { data } = await axios.post('/api/user-bundle', {
            action: 'sync-ugc-mission',
            ...payload
        });
        return data;
    },

    /**
     * Get user reputation audit status
     */
    getReputationStatus: async (address: string) => {
        const { data } = await axios.get(`/api/user-bundle?action=check-reputation&wallet=${address}`);
        return data?.reputation || data;
    },

    /**
     * Sync Farcaster Identity
     */
    syncFarcaster: async (payload: { address: string; signature: string; message: string }) => {
        const { data } = await axios.post('/api/user-bundle?action=fc-sync', payload);
        return data;
    },

    /**
     * Update User Profile (display name, bio, etc.)
     */
    updateProfile: async (payload: { wallet: string; signature: string; message: string; payload: any }) => {
        const { data } = await axios.post('/api/user-bundle?action=update-profile', payload);
        return data;
    }
};
