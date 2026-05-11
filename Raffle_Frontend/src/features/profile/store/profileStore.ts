import { create } from 'zustand';

/**
 * Profile Store for managing global user state.
 * [v3.60.0] Modular Feature-Based Architecture
 */
interface ProfileState {
    profileData: any;
    isLoading: boolean;
    error: any;
    setProfileData: (data: any) => void;
    setLoading: (loading: boolean) => void;
    setError: (err: any) => void;
    reset: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
    profileData: null,
    isLoading: false,
    error: null,

    setProfileData: (data) => set({ profileData: data }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (err) => set({ error: err }),

    reset: () => set({ profileData: null, isLoading: false, error: null })
}));
