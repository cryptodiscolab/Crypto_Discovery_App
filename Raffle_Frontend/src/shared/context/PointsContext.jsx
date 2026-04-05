import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { getSBTThresholds } from '../../dailyAppLogic';
import { supabase } from '../../lib/supabaseClient';

const PointsContext = createContext(null);

export function PointsProvider({ children }) {
    const { address, isConnected } = useAccount();

    const [userPoints, setUserPoints] = useState(0n); // BigInt for safety
    const userPointsRef = useRef(0); // Ref for sync tracking (Number)
    const [userTier, setUserTier] = useState(0);
    const [pointsToNext, setPointsToNext] = useState(0);
    const [rankName, setRankName] = useState('Rookie');
    const [totalTasksCompleted, setTotalTasksCompleted] = useState(0);
    const [profileData, setProfileData] = useState(null);

    // Loading States
    const [isLoading, setIsLoading] = useState(false);

    const [unclaimedRewards, setUnclaimedRewards] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [sbtThresholds, setSbtThresholds] = useState([]);
    const [ecosystemSettings, setEcosystemSettings] = useState({
        daily_claim: 100,
        max_gas_price_gwei: 100,
        raffle_ticket_price_usdc: 0.15,
        sponsorship_listing_fee_usdc: 1.0,
        referral_bonus_percent: 10,
        referral_active_threshold: 500
    });

    // Anti-Halu Central State
    const [fid, setFid] = useState(null);
    const [offChainPoints, setOffChainPoints] = useState(0);
    const [offChainLevel, setOffChainLevel] = useState(0);

    // ==========================================
    // SYNC LOGS (For Admin/Debug)
    // ==========================================
    const [syncLogs, setSyncLogs] = useState(() => {
        try {
            const saved = localStorage.getItem('disco_sync_logs');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.warn('[PointsContext] Failed to load sync logs:', e);
            return [];
        }
    });

    // Persist logs to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('disco_sync_logs', JSON.stringify(syncLogs.slice(0, 50))); // Keep last 50
        } catch (e) {
            console.warn('[PointsContext] Failed to save sync logs:', e);
        }
    }, [syncLogs]);

    const addSyncLog = useCallback((type, dbXp, visualXp, prevVisualXp = null) => {
        const log = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            type, // 'manual_optimistic', 'refetch', 'forced', 'error'
            dbXp,
            visualXp,
            prevVisualXp,
            diff: visualXp - dbXp
        };
        setSyncLogs(prev => [log, ...prev].slice(0, 50));
    }, []);

    // ==========================================
    // REAL-TIME SYNC (SUPABASE SOURCE)
    // ==========================================
    const fetchUserData = useCallback(async (forced = false) => {
        if (!address) return;
        setIsLoading(true);

        try {
            // Priority: Fetch from 'v_user_full_profile' (The Consolidated View)
            const { data, error } = await supabase
                .from('v_user_full_profile')
                .select('*') // Changed to select all as per instruction
                .eq('wallet_address', address.toLowerCase())
                .maybeSingle();

            if (error) throw error;

            if (data) {
                const dbPoints = Number(data.total_xp || 0);
                const prevVisual = userPointsRef.current;

                setUserPoints(BigInt(dbPoints));
                userPointsRef.current = dbPoints; // Update ref
                setUserTier(data.tier !== undefined ? Number(data.tier) : 0);
                setRankName(data.rank_name || "Guest");
                setProfileData(data); // Full view data (streaks, last claim, etc.)

                // Log the sync with prev context
                addSyncLog(forced ? 'forced' : 'refetch', dbPoints, dbPoints, prevVisual);
            }

            // Optional: Get total tasks count if needed
            const { count } = await supabase
                .from('user_task_claims')
                .select('*', { count: 'exact', head: true })
                .eq('wallet_address', address.toLowerCase());

            setTotalTasksCompleted(count || 0);

        } catch (err) {
            console.error("[PointsContext] Sync Error:", err);
            addSyncLog('error', 0, userPointsRef.current);
        } finally {
            setIsLoading(false);
        }
    }, [address, addSyncLog]);

    // Public Refetcher
    const refetch = () => {
        fetchUserData();
        // checkAdminStatus(address); // Optional re-check
    };

    const fetchEcosystemSettings = useCallback(async () => {
        try {
            const response = await fetch('/api/user-bundle?action=get-point-settings');
            const data = await response.json();
            if (data.success) {
                setEcosystemSettings(prev => ({ ...prev, ...data.settings }));
            }
        } catch (err) {
            console.error('[PointsContext] Failed to fetch settings:', err);
        }
    }, []);

    useEffect(() => {
        if (isConnected) {
            fetchUserData();
            fetchEcosystemSettings();
        } else {
            setUserPoints(0n);
            setUserTier(0);
            setTotalTasksCompleted(0);
        }
    }, [isConnected, address, fetchEcosystemSettings, fetchUserData]);

    useEffect(() => {
        const loadThresholds = async () => {
            const data = await getSBTThresholds();
            if (data && data.length > 0) {
                setSbtThresholds(data);
            }
        };
        loadThresholds();
        fetchEcosystemSettings(); // Fetch once anyway for public settings
    }, [fetchEcosystemSettings]);

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

    // Admin verification function — uses lightweight /api/is-admin (no signature required)
    const checkAdminStatus = async (walletAddress) => {
        if (!walletAddress) return;

        try {
            // Use the lightweight read-only endpoint (no signature needed)
            const response = await fetch(`/api/is-admin?wallet=${walletAddress}`);

            if (response.ok) {
                const data = await response.json();
                setIsAdmin(data.isAdmin || false);
            } else {
                console.warn('[AdminCheck] is-admin endpoint failed with status:', response.status);
            }
        } catch (error) {
            console.error('[AdminCheck] Error:', error);
        }
    };

    // Manual add points (for local optimistic updates like Daily Claim)
    const manualAddPoints = (amount) => {
        const added = Number(amount);
        const oldPoints = userPointsRef.current;
        const newPoints = oldPoints + added;

        setUserPoints(BigInt(newPoints));
        userPointsRef.current = newPoints;
        setOffChainPoints(prev => prev + amount); // Sync off-chain state

        // Log the manual (optimistic) sync
        addSyncLog('manual_optimistic', oldPoints, newPoints, oldPoints);
    };

    const value = {
        userPoints,
        userTier,
        rankName: profileData?.rank_name || rankName,
        profileData,
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
        ecosystemSettings,
        fid,
        offChainPoints,
        offChainLevel,
        syncLogs,
        clearLogs: () => {
            setSyncLogs([]);
            try { localStorage.removeItem('disco_sync_logs'); } catch (e) { /* ignore */ }
        }
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
