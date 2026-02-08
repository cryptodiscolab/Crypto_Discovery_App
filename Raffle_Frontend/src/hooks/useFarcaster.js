import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Senior Architecture: Transparent Identity Management Hook.
 * Guaranteed zero-RIBA, honest data attribution, and Sybil-aware.
 */
export const useFarcaster = () => {
    const [profileData, setProfileData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isSybilDetected, setIsSybilDetected] = useState(false);

    const abortControllerRef = useRef(null);

    // Hardware-aware cleanup (Project IDX Optimization)
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, []);

    /**
     * isEligible: Transparent anti-bot filter (OpenRank aware).
     */
    const isEligible = useCallback((profile = profileData) => {
        if (!profile) return false;
        // Hardened Logic: Use DB trust_score if synced, otherwise calculate local estimate
        // Priority: internal_trust_score > (PowerBadge bonus + follower weight + rank weight)
        const score = profile.internal_trust_score ??
            ((profile.power_badge ? 50 : 0) +
                (Math.min(profile.follower_count / 100, 20)) +
                (profile.rank_score * 100));

        return score >= 50;
    }, [profileData]);

    const syncUser = useCallback(async (address, forceRefresh = false) => {
        if (!address) return null;

        const normalizedAddress = address.trim().toLowerCase();

        // 1. Concurrency Prevention
        if (isLoading && !forceRefresh) return null;

        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        setIsLoading(true);
        setError(null);
        setIsSybilDetected(false);

        try {
            // 2. Efficient Local Fetch (Primary Protocol)
            if (!forceRefresh) {
                const { data: localProfile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('wallet_address', normalizedAddress)
                    .single();

                if (localProfile) {
                    setProfileData(localProfile);

                    // 5-minute cooldown for sync (Bulletproof Rate Limit)
                    const lastSync = new Date(localProfile.last_sync).getTime();
                    const now = Date.now();
                    const COOLDOWN = 5 * 60 * 1000;

                    if (now - lastSync < COOLDOWN) {
                        setIsLoading(false);
                        return localProfile;
                    }
                }
            }

            // 3. Bulletproof API Call (NATIVE FETCH)
            const response = await fetch('/api/farcaster/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: normalizedAddress }),
                signal: abortControllerRef.current.signal
            });

            const result = await response.json();

            if (!response.ok) {
                // Sybil Attack Coverage
                if (response.status === 403 && result.isSybil) {
                    setIsSybilDetected(true);
                    throw new Error(result.error);
                }
                // Rate Limit Check
                if (response.status === 429) {
                    throw new Error(result.error);
                }
                throw new Error(result.error || 'Identity Sync Failed');
            }

            const finalProfile = result.profile;
            setProfileData(finalProfile);
            return finalProfile;

        } catch (err) {
            if (err.name === 'AbortError') return null;

            console.error('[Principal Hook] Logic Failure:', err.message);
            setError(err.message);
            return null;
        } finally {
            // GUARANTEE: Loading state ALWAYS resets
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [isLoading]);

    return {
        profileData,
        isLoading,
        error,
        isSybilDetected,
        syncUser,
        isEligible,
        trustScore: profileData?.internal_trust_score || 0,
        metadata: {
            rank: profileData?.rank_score || 0,
            verifications: profileData?.verified_addresses || [],
            bio: profileData?.bio || ''
        }
    };
};
