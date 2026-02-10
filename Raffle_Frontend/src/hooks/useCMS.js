import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useReadContract, useWriteContract, useAccount } from 'wagmi';
import { readContract } from '@wagmi/core';
import { CMS_CONTRACT_ABI } from '../shared/constants/abis';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { cleanWallet } from '../utils/cleanWallet';
import { config } from '../Web3Provider'; // Import from Web3Provider instead of missing lib/wagmi

const CMS_CONTRACT_ADDRESS = import.meta.env.VITE_CMS_CONTRACT_ADDRESS;
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

// Default fallback states
const DEFAULT_ANNOUNCEMENT = { visible: false, title: "", message: "", type: "info" };
const DEFAULT_POOL_SETTINGS = { targetUSDC: 5000, claimTimestamp: 0 };
const DEFAULT_NEWS = [];
const DEFAULT_FEATURE_CARDS = [];

/**
 * Custom hook for interacting with ContentCMSV2 contract
 * Provides read/write access to content, role management, and sponsored access whitelist
 */
export function useCMS() {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();

    // ============================================
    // READ CONTENT FROM CONTRACT
    // ============================================

    const {
        data: announcementRaw,
        isLoading: loadingAnnouncement,
        refetch: refetchAnnouncement,
        error: announcementError
    } = useReadContract({
        address: CMS_CONTRACT_ADDRESS,
        abi: CMS_CONTRACT_ABI,
        functionName: 'getAnnouncement',
        query: {
            enabled: Boolean(CMS_CONTRACT_ADDRESS),
        }
    });

    const [ethPrice, setEthPrice] = useState(2500); // Fallback price

    // Fetch ETH Price from CoinGecko (Simple public API)
    useEffect(() => {
        let isMounted = true;
        const fetchPrice = async () => {
            try {
                const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
                const data = await response.json();
                if (isMounted && data.ethereum?.usd) {
                    setEthPrice(data.ethereum.usd);
                    console.log('[useCMS] ETH Price Updated:', data.ethereum.usd);
                }
            } catch (e) {
                console.error("Failed to fetch ETH price:", e);
            }
        };

        fetchPrice();
        const interval = setInterval(fetchPrice, 5 * 60 * 1000); // Update every 5 minutes
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const {
        data: newsRaw,
        isLoading: loadingNews,
        refetch: refetchNews,
        error: newsError
    } = useReadContract({
        address: CMS_CONTRACT_ADDRESS,
        abi: CMS_CONTRACT_ABI,
        functionName: 'getNews',
        query: {
            enabled: Boolean(CMS_CONTRACT_ADDRESS),
        }
    });

    const {
        data: featureCardsRaw,
        isLoading: loadingCards,
        refetch: refetchCards,
        error: cardsError
    } = useReadContract({
        address: CMS_CONTRACT_ADDRESS,
        abi: CMS_CONTRACT_ABI,
        functionName: 'getFeatureCards',
        query: {
            enabled: Boolean(CMS_CONTRACT_ADDRESS),
        }
    });


    // ============================================
    // READ ROLES
    // ============================================

    const { data: isAdminRaw } = useReadContract({
        address: CMS_CONTRACT_ADDRESS,
        abi: CMS_CONTRACT_ABI,
        functionName: 'hasRole',
        args: [DEFAULT_ADMIN_ROLE, address || "0x0000000000000000000000000000000000000000"],
        query: {
            enabled: Boolean(CMS_CONTRACT_ADDRESS && address),
        }
    });

    const { data: isOperatorRaw } = useReadContract({
        address: CMS_CONTRACT_ADDRESS,
        abi: CMS_CONTRACT_ABI,
        functionName: 'isOperator',
        args: [address || "0x0000000000000000000000000000000000000000"],
        query: {
            enabled: Boolean(CMS_CONTRACT_ADDRESS && address),
        }
    });

    // Robust check fallbacks (using ENV for immediate UI response)
    const envAdmin = import.meta.env.VITE_ADMIN_ADDRESS || '';
    const envWallets = import.meta.env.VITE_ADMIN_WALLETS || '';
    const isEnvAdmin = useMemo(() => {
        if (!address) return false;
        const adminList = `${envAdmin},${envWallets}`.split(',').map(a => a.trim().toLowerCase()).filter(a => a.startsWith('0x'));
        return adminList.includes(address.toLowerCase());
    }, [address, envAdmin, envWallets]);

    // Database Admin Check
    const [isDbAdmin, setIsDbAdmin] = useState(false);
    useEffect(() => {
        let isMounted = true;
        const checkDbAdmin = async () => {
            const wallet = cleanWallet(address);
            if (!wallet) {
                if (isMounted) setIsDbAdmin(false);
                return;
            }
            try {
                const { data } = await supabase
                    .from('user_profiles')
                    .select('is_admin')
                    .eq('wallet_address', wallet)
                    .maybeSingle();

                if (isMounted) {
                    const isAdminVal = Boolean(data?.is_admin);
                    setIsDbAdmin(isAdminVal);
                    if (isAdminVal) {
                        console.log('[useCMS] DB Admin confirmed:', wallet);
                    }
                }
            } catch (e) {
                console.warn('[useCMS] DB Admin check failed (Non-blocking):', e.message);
                if (isMounted) setIsDbAdmin(false);
            }
        };
        checkDbAdmin();
        return () => { isMounted = false; };
    }, [address]);

    // Final boolean roles (Memoized for efficiency)
    const isAdmin = useMemo(() => Boolean(isAdminRaw || isEnvAdmin || isDbAdmin), [isAdminRaw, isEnvAdmin, isDbAdmin]);
    const isOperator = useMemo(() => Boolean(isOperatorRaw || isEnvAdmin || isDbAdmin), [isOperatorRaw, isEnvAdmin, isDbAdmin]);
    const canEdit = useMemo(() => isAdmin || isOperator, [isAdmin, isOperator]);


    // ============================================
    // PARSE JSON DATA WITH ERROR BOUNDARIES (Memoized)
    // ============================================

    const content = useMemo(() => {
        let announcement = DEFAULT_ANNOUNCEMENT;
        let poolSettings = DEFAULT_POOL_SETTINGS;
        let news = DEFAULT_NEWS;
        let featureCards = DEFAULT_FEATURE_CARDS;

        // Parse Announcement and Pool Settings
        try {
            if (announcementRaw && typeof announcementRaw === 'string' && announcementRaw.trim() !== "") {
                const parsed = JSON.parse(announcementRaw);
                if (parsed && typeof parsed === 'object') {
                    if (parsed.announcement) {
                        announcement = { ...DEFAULT_ANNOUNCEMENT, ...parsed.announcement };
                        poolSettings = { ...DEFAULT_POOL_SETTINGS, ...parsed.pool };
                    } else {
                        announcement = { ...DEFAULT_ANNOUNCEMENT, ...parsed };
                    }
                }
            }
        } catch (e) {
            console.error("Failed to parse announcement JSON", e);
        }

        // Parse News
        try {
            if (newsRaw && typeof newsRaw === 'string' && newsRaw.trim() !== "") {
                const parsed = JSON.parse(newsRaw);
                news = Array.isArray(parsed) ? parsed : DEFAULT_NEWS;
            }
        } catch (e) {
            console.error("Failed to parse news JSON", e);
        }

        // Parse Feature Cards
        try {
            if (featureCardsRaw && typeof featureCardsRaw === 'string' && featureCardsRaw.trim() !== "") {
                const parsed = JSON.parse(featureCardsRaw);
                featureCards = Array.isArray(parsed) ? parsed : DEFAULT_FEATURE_CARDS;
            }
        } catch (e) {
            console.error("Failed to parse feature cards JSON", e);
        }

        return { announcement, poolSettings, news, featureCards };
    }, [announcementRaw, newsRaw, featureCardsRaw]);

    const { announcement, poolSettings, news, featureCards } = content;

    // ============================================
    // WRITE FUNCTIONS - CONTENT MANAGEMENT
    // ============================================

    const updateAnnouncement = useCallback(async (newAnnouncement) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");

        const newSettings = {
            announcement: newAnnouncement,
            pool: poolSettings
        };
        const jsonString = JSON.stringify(newSettings);
        return await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'updateAnnouncement',
            args: [jsonString],
        });
    }, [poolSettings, writeContractAsync]);

    const updatePoolSettings = useCallback(async (newPoolSettings) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");

        const newSettings = {
            announcement: announcement,
            pool: newPoolSettings
        };
        const jsonString = JSON.stringify(newSettings);
        return await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'updateAnnouncement',
            args: [jsonString],
        });
    }, [announcement, writeContractAsync]);

    const updateNews = useCallback(async (newNews) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");
        const jsonString = JSON.stringify(newNews);
        return await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'updateNews',
            args: [jsonString],
        });
    }, [writeContractAsync]);

    const updateFeatureCards = useCallback(async (newCards) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");
        const jsonString = JSON.stringify(newCards);
        return await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'updateFeatureCards',
            args: [jsonString],
        });
    }, [writeContractAsync]);

    const batchUpdate = useCallback(async (newAnnouncement, newNews, newCards) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");
        return await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'batchUpdate',
            args: [
                JSON.stringify(newAnnouncement),
                JSON.stringify(newNews),
                JSON.stringify(newCards)
            ],
        });
    }, [writeContractAsync]);

    // ============================================
    // WRITE FUNCTIONS - ROLE MANAGEMENT
    // ============================================

    const grantOperator = useCallback(async (operatorAddress) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");
        return await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'grantOperator',
            args: [operatorAddress],
        });
    }, [writeContractAsync]);

    const revokeOperator = useCallback(async (operatorAddress) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");
        return await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'revokeOperator',
            args: [operatorAddress],
        });
    }, [writeContractAsync]);

    // ============================================
    // WRITE FUNCTIONS - SPONSORED ACCESS WHITELIST
    // ============================================

    const grantPrivilege = useCallback(async (userAddress, featureId) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");
        return await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'grantPrivilege',
            args: [userAddress, featureId],
        });
    }, [writeContractAsync]);

    const revokePrivilege = useCallback(async (userAddress, featureId) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");
        return await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'revokePrivilege',
            args: [userAddress, featureId],
        });
    }, [writeContractAsync]);

    const batchGrantPrivileges = useCallback(async (userAddresses, featureIds) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");
        return await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'batchGrantPrivileges',
            args: [userAddresses, featureIds],
        });
    }, [writeContractAsync]);

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    /**
     * Check if a user has access to a specific feature
     * FIXED: Removed useReadContract hook from inside function
     */
    const checkAccess = useCallback(async (userAddress, featureId) => {
        if (!CMS_CONTRACT_ADDRESS) return false;
        try {
            const result = await readContract(config, {
                address: CMS_CONTRACT_ADDRESS,
                abi: CMS_CONTRACT_ABI,
                functionName: 'hasAccess',
                args: [userAddress, featureId],
            });
            return result;
        } catch (e) {
            console.error("[useCMS] Error checking access:", e);
            return false;
        }
    }, []);

    /**
     * Show success toast with BaseScan link
     */
    const showSuccessToast = (message, txHash) => {
        toast.success(
            `${message} - View on BaseScan: https://sepolia.basescan.org/tx/${txHash}`,
            { duration: 6000 }
        );
    };


    // ============================================
    // RETURN ALL DATA AND FUNCTIONS
    // ============================================

    return {
        // Content data
        announcement,
        poolSettings,
        news,
        featureCards,
        ethPrice,

        // Role status
        isAdmin,
        isOperator,
        canEdit,

        // Loading states
        isLoading: loadingAnnouncement || loadingNews || loadingCards,
        hasError: announcementError || newsError || cardsError,

        // Content write functions
        updateAnnouncement,
        updatePoolSettings,
        updateNews,
        updateFeatureCards,
        batchUpdate,

        // Role management functions
        grantOperator,
        revokeOperator,

        // Sponsored access functions
        grantPrivilege,
        revokePrivilege,
        batchGrantPrivileges,
        checkAccess,

        // Helpers
        showSuccessToast,
        refetchAll: () => {
            refetchAnnouncement();
            refetchNews();
            refetchCards();
        },
    };
}

// Feature ID constants (match contract)
export const FEATURE_IDS = {
    FREE_DAILY_TASK: 1,
    FREE_RAFFLE_TICKET: 2,
    PREMIUM_ACCESS: 3,
};

export const FEATURE_NAMES = {
    1: "Free Daily Task",
    2: "Free Raffle Ticket",
    3: "Premium Access",
};

