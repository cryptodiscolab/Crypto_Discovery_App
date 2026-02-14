import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { cleanWallet } from '../utils/cleanWallet';

/**
 * Senior Architecture Hook: zero-latency identity management.
 * Adheres to Anti-Riba and hardware optimization principles.
 */
export const useFarcaster = () => {
    const [profileData, setProfileData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const abortControllerRef = useRef(null);

    // Cache Key Generator
    const getStorageKey = (address) => `fc_cache_${address?.toLowerCase()}`;

    const clearCache = useCallback((address) => {
        if (!address) return;
        localStorage.removeItem(getStorageKey(address));
        setProfileData(null);
    }, []);

    const syncUser = useCallback(async (address, forceRefresh = false) => {
        if (!address) return null;
        const wallet = cleanWallet(address);
        const storageKey = getStorageKey(wallet);

        // 1. Zero-Latency: Load from Local Storage immediately
        if (!forceRefresh) {
            const cached = localStorage.getItem(storageKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                setProfileData(parsed);
                // Return immediately for UI responsiveness
                // We could do a background check, but let's keep it lean for low-spec hardware
                if (Date.now() - new Date(parsed.last_sync).getTime() < 3600000) return parsed;
            }
        }

        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        setIsLoading(true);
        setError(null);

        try {
            // 2. Database First (Leaner than full sync)
            if (!forceRefresh) {
                const { data: dbProfile } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('address', wallet)
                    .maybeSingle();

                if (dbProfile) {
                    setProfileData(dbProfile);
                    localStorage.setItem(storageKey, JSON.stringify(dbProfile));
                    setIsLoading(false);
                    return dbProfile;
                }
            }

            // 3. Neynar SDK Sync (Via Backend Bridge)
            const response = await fetch('/api/farcaster/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: wallet }),
                signal: abortControllerRef.current.signal
            });

            const result = await response.json();
            if (!response.ok) {
                console.error("[Sync Hook] Server Error Response:", result);
                throw new Error(result.error || 'Identity Sync Failed');
            }

            const finalProfile = result.profile;
            setProfileData(finalProfile);
            localStorage.setItem(storageKey, JSON.stringify(finalProfile));
            return finalProfile;

        } catch (err) {
            if (err.name === 'AbortError') return null;
            setError(err.message);
            return null;
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, []);

    return {
        user: profileData, // Alias for ProfilePage.jsx
        profileData,
        isLoading,
        error,
        syncUser,
        clearCache,
        trustScore: Number(profileData?.neynar_score || 0)
    };
};

