import { create } from 'zustand';

/**
 * Profile Store for managing global user state.
 * [v3.60.0] Modular Feature-Based Architecture
 */
export const useProfileStore = create((set) => ({
    profileData: null,
    isLoading: false,
    error: null,

    setProfileData: (data) => set({ profileData: data }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (err) => set({ error: err }),

    reset: () => set({ profileData: null, isLoading: false, error: null })
}));
