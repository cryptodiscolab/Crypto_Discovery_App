import { createContext, useContext, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useUserV12Stats } from '../../hooks/useContract';
import { getSBTThresholds, getUserStatsByFid } from '../../dailyAppLogic';

const PointsContext = createContext(null);

export function PointsProvider({ children }) {
    const { address, isConnected } = useAccount();

    const [userPoints, setUserPoints] = useState(0n); // BigInt for safety
    const [userTier, setUserTier] = useState(0);
    const [totalTasksCompleted, setTotalTasksCompleted] = useState(0);

    // Loading States
    const [isLoading, setIsLoading] = useState(false);

    const [unclaimedRewards, setUnclaimedRewards] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [sbtThresholds, setSbtThresholds] = useState([]);

    // Anti-Halu Central State
    const [fid, setFid] = useState(null);
    const [offChainPoints, setOffChainPoints] = useState(0);
    const [offChainLevel, setOffChainLevel] = useState(0);

    // ==========================================
    // REAL-TIME SYNC (SUPABASE SOURCE)
    // ==========================================
    const fetchUserData = async () => {
        if (!address) return;
        setIsLoading(true);
        try {
            // Priority: Fetch from 'user_profiles' (The Source of Truth)
            const { data, error } = await import('../../lib/supabaseClient').then(m => m.supabase)
                .from('user_profiles')
                .select('points, tier')
                .eq('wallet_address', address.toLowerCase())
                .single();

            if (data) {
                setUserPoints(BigInt(data.points || 0));
                setUserTier(data.tier || 1);
            }

            // Optional: Get total tasks count if needed
            const { count } = await import('../../lib/supabaseClient').then(m => m.supabase)
                .from('user_task_claims')
                .select('*', { count: 'exact', head: true })
                .eq('wallet_address', address.toLowerCase());

            setTotalTasksCompleted(count || 0);

        } catch (err) {
            console.error("[PointsContext] Sync Error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Public Refetcher
    const refetch = () => {
        fetchUserData();
        // checkAdminStatus(address); // Optional re-check
    };

    useEffect(() => {
        if (isConnected && address) {
            fetchUserData();
        } else {
            setUserPoints(0n);
            setUserTier(0);
            setTotalTasksCompleted(0);
        }
    }, [isConnected, address]);

    // Check admin status when wallet connects
    useEffect(() => {
        if (isConnected && address) {
            // Priority 1: Check if address is available before calling API
            checkAdminStatus(address);
        } else if (!isConnected) {
            setIsAdmin(false);
        }
    }, [isConnected, address]);

    useEffect(() => {
        const loadThresholds = async () => {
            const data = await getSBTThresholds();
            if (data && data.length > 0) {
                setSbtThresholds(data);
            }
        };
        loadThresholds();
    }, []);

    // FID and Off-Chain Stats loading removed to resolve build issues

    useEffect(() => {
        // Check for approaching deadlines every minute
        const interval = setInterval(() => {
            if (unclaimedRewards.length > 0) {
                const now = Date.now();
                unclaimedRewards.forEach(reward => {
                    if (!reward.isClaimed && reward.deadline) {
                        const timeLeft = reward.deadline - now;
                        // Notify if roughly 1 hour left (between 59m and 61m to avoid spam)
                        if (timeLeft > 59 * 60 * 1000 && timeLeft < 61 * 60 * 1000) {
                            import('react-hot-toast').then(({ default: toast }) => {
                                toast("⚠️ Reward expiry imminent! Claim within 1 hour.", { icon: '⏳' });
                            });
                        }
                    }
                });
            }
        }, 60000); // Check every minute

        return () => clearInterval(interval);
    }, [unclaimedRewards]);

    // Helper: Format milliseconds to HH:MM:SS
    const formatTimeLeft = (ms) => {
        if (ms <= 0) return "00:00:00";
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Admin verification function
    const checkAdminStatus = async (walletAddress) => {
        if (!walletAddress) return;

        // Local Check for immediate UI response (Fast Path)
        const envAdmin = import.meta.env.VITE_ADMIN_ADDRESS || '';
        const envWallets = import.meta.env.VITE_ADMIN_WALLETS || '';

        const adminList = `${envAdmin},${envWallets}`
            .split(',')
            .map(a => a.trim().toLowerCase())
            .filter(a => a.startsWith('0x'));

        // If local check confirms, set it true immediately
        if (adminList.includes(walletAddress.toLowerCase())) {
            setIsAdmin(true);
        }

        try {
            // Perform backend double-verification
            const response = await fetch('/api/admin/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ address: walletAddress }),
            });

            if (response.ok) {
                const data = await response.json();
                setIsAdmin(data.isAdmin || false);
            } else {
                console.warn('[AdminCheck] Backend verification failed with status:', response.status);
                // We keep the local state if it was already true as a fallback
            }
        } catch (error) {
            console.error('[AdminCheck] Error:', error);
        }
    };

    // Manual add points (for local optimistic updates like Daily Claim)
    const manualAddPoints = (amount) => {
        setUserPoints(prev => prev + BigInt(amount));
        setOffChainPoints(prev => prev + amount); // Sync off-chain state
    };

    const value = {
        userPoints,
        userTier,
        totalTasksCompleted,
        unclaimedRewards,
        setUnclaimedRewards, // Exposed for useRaffle to update localized state if needed
        isLoading,
        refetch,
        isConnected,
        formatTimeLeft,
        isAdmin,
        checkAdminStatus,
        manualAddPoints,
        sbtThresholds,
        fid,
        offChainPoints,
        offChainLevel
    };

    return (
        <PointsContext.Provider value={value}>
            {children}
        </PointsContext.Provider>
    );
}

export function usePoints() {
    const context = useContext(PointsContext);
    if (!context) {
        throw new Error('usePoints must be used within a PointsProvider');
    }
    return context;
}
