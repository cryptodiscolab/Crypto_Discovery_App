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
                    .eq('wallet_address', wallet)
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

            // --- PARSING LOGIC UPDATE (Handle Raw Neynar Structure) ---
            // Response format: { "0x...": [ { fid: ... } ] }
            // or sometimes wrapped in { result: ... } depending on the proxy.
            // We try to find the array by looking for the address key.

            let userObj = null;
            const addressKey = wallet.toLowerCase();

            // Case A: Direct Raw Response { "0x...": [...] }
            if (result[addressKey] && Array.isArray(result[addressKey])) {
                userObj = result[addressKey][0];
            }
            // Case B: Previously assumed structure { profile: ... }
            else if (result.profile) {
                userObj = result.profile;
            }

            if (!userObj) {
                console.warn("[Sync Hook] keys found:", Object.keys(result));
                throw new Error("No Farcaster profile found for this address.");
            }

            // --- MAPPING LOGIC ---
            // Map Neynar keys to our Supabase Schema
            const finalProfile = {
                wallet_address: wallet,
                fid: userObj.fid,
                username: userObj.username,
                display_name: userObj.display_name,
                pfp_url: userObj.pfp_url,
                bio: userObj.profile?.bio?.text || '',
                follower_count: userObj.follower_count || 0,
                following_count: userObj.following_count || 0,
                verifications: userObj.verifications || [],
                active_status: userObj.active_status || 'active',
                neynar_score: userObj.score || userObj.experimental?.neynar_user_score || 0,
                power_badge: (userObj.follower_count > 500), // Simple logic for badge
                last_login_at: new Date().toISOString()
            };

            // 4. UPSERT TO SUPABASE (With RLS Header)
            // Use the centralized authenticated client factory
            const { createAuthenticatedClient } = await import('@/lib/supabaseClient_enhanced');
            const authClient = createAuthenticatedClient(wallet);

            const { error: upsertError } = await authClient
                .from('user_profiles')
                .upsert(finalProfile, { onConflict: 'wallet_address' });

            if (upsertError) {
                console.error("[Sync Hook] DB Upsert Error:", upsertError);
                // Log details for debugging RLS issues
                console.debug("[Sync Hook] Payload:", finalProfile);
                console.debug("[Sync Hook] Wallet Code:", wallet);
            }

            setProfileData(finalProfile);
            localStorage.setItem(storageKey, JSON.stringify(finalProfile));
            return finalProfile;

        } catch (err) {
            if (err.name === 'AbortError') return null;
            setError(err.message);
            console.error("[Sync Hook] Process Error:", err);
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

