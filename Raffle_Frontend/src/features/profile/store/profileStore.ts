import { create } from 'zustand';

/**
 * Profile Store for managing global user state.
 * [v3.60.0] Modular Feature-Based Architecture
 */
interface ProfileState {
    profileData: unknown;
    isLoading: boolean;
    error: unknown;
    setProfileData: (_data: unknown) => void;
    setLoading: (_loading: boolean) => void;
    setError: (_err: unknown) => void;
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
