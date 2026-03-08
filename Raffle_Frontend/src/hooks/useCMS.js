import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useReadContract, useWriteContract, useAccount, useConfig, usePublicClient } from 'wagmi';
import { ABIS, CONTRACTS, PRICE_FEED_ADDRESS } from '../lib/contracts';
import { FEATURE_IDS, FEATURE_NAMES } from '../shared/constants/cmsFeatures';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { cleanWallet } from '../utils/cleanWallet';

const CMS_CONTRACT_ADDRESS = CONTRACTS.CMS;
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

// Default fallback states
const DEFAULT_ANNOUNCEMENT = { visible: false, title: "", message: "", type: "info" };
const DEFAULT_POOL_SETTINGS = { targetUSDC: 0, claimTimestamp: 0 };
const DEFAULT_NEWS = [];

/**
 * Custom hook for interacting with ContentCMSV2 contract
 * Provides read/write access to content, role management, and sponsored access whitelist
 */
export function useCMS() {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const config = useConfig();
    const publicClient = usePublicClient();

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
        abi: ABIS.CMS,
        functionName: 'getAnnouncement',
        query: {
            enabled: Boolean(CMS_CONTRACT_ADDRESS),
            placeholderData: (prev) => prev,
            staleTime: 0,
        }
    });

    // On-Chain ETH Price Oracle (Chainlink)
    // Resolves CORS/429 issues from CoinGecko
    const { data: priceRaw } = useReadContract({
        address: PRICE_FEED_ADDRESS,
        abi: ABIS.CHAINLINK,
        functionName: 'latestRoundData',
        query: {
            refetchInterval: 300 * 1000, // Update every 5 minutes (reduced from 1m)
            placeholderData: (prev) => prev,
            staleTime: 60 * 1000,
        }
    });

    const ethPrice = useMemo(() => {
        if (priceRaw?.[1]) {
            return Number(priceRaw[1]) / 1e8; // Chainlink USD Feeds have 8 decimals
        }
        return 0; // Fallback to 0 if Oracle fails
    }, [priceRaw]);

    const {
        data: newsRaw,
        isLoading: loadingNews,
        refetch: refetchNews,
        error: newsError
    } = useReadContract({
        address: CMS_CONTRACT_ADDRESS,
        abi: ABIS.CMS,
        functionName: 'getNews',
        query: {
            enabled: Boolean(CMS_CONTRACT_ADDRESS),
            placeholderData: (prev) => prev,
            staleTime: 0,
        }
    });

    const {
        data: featureCardsRaw,
        isLoading: loadingCards,
        refetch: refetchCards,
        error: cardsError
    } = useReadContract({
        address: CMS_CONTRACT_ADDRESS,
        abi: ABIS.CMS,
        functionName: 'getFeatureCards',
        query: {
            enabled: Boolean(CMS_CONTRACT_ADDRESS),
            placeholderData: (prev) => prev,
            staleTime: 0,
        }
    });


    // ============================================
    // READ ROLES
    // ============================================

    const { data: isAdminRaw } = useReadContract({
        address: CMS_CONTRACT_ADDRESS,
        abi: ABIS.CMS,
        functionName: 'hasRole',
        args: [DEFAULT_ADMIN_ROLE, address || "0x0000000000000000000000000000000000000000"],
        query: {
            enabled: Boolean(CMS_CONTRACT_ADDRESS && address),
        }
    });

    const { data: isOperatorRaw } = useReadContract({
        address: CMS_CONTRACT_ADDRESS,
        abi: ABIS.CMS,
        functionName: 'isOperator',
        args: [address || "0x0000000000000000000000000000000000000000"],
        query: {
            enabled: Boolean(CMS_CONTRACT_ADDRESS && address),
        }
    });

    // Robust check fallbacks (using Centralized Authority from contracts.js)
    const isEnvAdmin = useMemo(() => {
        if (!address) return false;
        return ADMIN_WALLETS.includes(address.toLowerCase());
    }, [address]);

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
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('is_admin')
                    .eq('wallet_address', wallet)
                    .maybeSingle();

                if (!error && data && isMounted) {
                    setIsDbAdmin(!!data.is_admin);
                }
            } catch (e) {
                console.warn('[useCMS] DB Admin check failed:', e.message);
                if (isMounted) setIsDbAdmin(false);
            }
        };
        checkDbAdmin();
        return () => { isMounted = false; };
    }, [address]);

    // Final boolean roles (Memoized for efficiency)
    const isAdmin = useMemo(() => Boolean(isAdminRaw || isEnvAdmin || isDbAdmin), [isAdminRaw, isEnvAdmin, isDbAdmin]);
    const isOperator = useMemo(() => Boolean(isOperatorRaw), [isOperatorRaw]);
    const canEdit = useMemo(() => isAdmin || isOperator, [isAdmin, isOperator]);


    // ============================================
    // PARSE JSON DATA WITH ERROR BOUNDARIES (Memoized)
    // ============================================

    const content = useMemo(() => {
        let announcement = DEFAULT_ANNOUNCEMENT;
        let poolSettings = DEFAULT_POOL_SETTINGS;
        let news = DEFAULT_NEWS;
        let featureCards = [];

        // Parse Announcement and Pool Settings
        try {
            if (announcementRaw && typeof announcementRaw === 'string' && announcementRaw.trim() !== "") {
                const parsed = JSON.parse(announcementRaw);
                if (parsed && typeof parsed === 'object') {
                    if (parsed.announcement) {
                        announcement = {
                            visible: Boolean(parsed.announcement.visible),
                            title: String(parsed.announcement.title || ""),
                            message: String(parsed.announcement.message || ""),
                            type: String(parsed.announcement.type || "info")
                        };
                        poolSettings = {
                            targetUSDC: Number(parsed.pool?.targetUSDC || 0),
                            claimTimestamp: Number(parsed.pool?.claimTimestamp || 0)
                        };
                    } else {
                        announcement = {
                            visible: Boolean(parsed.visible),
                            title: String(parsed.title || ""),
                            message: String(parsed.message || ""),
                            type: String(parsed.type || "info")
                        };
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
                if (Array.isArray(parsed)) {
                    news = parsed.map(item => ({
                        id: String(item.id || Date.now()),
                        title: String(item.title || ""),
                        message: String(item.message || ""),
                        date: String(item.date || ""),
                        type: String(item.type || "info")
                    }));
                }
            }
        } catch (e) {
            console.error("Failed to parse news JSON", e);
        }

        // Parse Feature Cards
        try {
            if (featureCardsRaw && typeof featureCardsRaw === 'string' && featureCardsRaw.trim() !== "") {
                const parsed = JSON.parse(featureCardsRaw);
                if (Array.isArray(parsed)) {
                    featureCards = parsed.map(item => ({
                        id: String(item.id || ""),
                        title: String(item.title || ""),
                        description: String(item.description || ""),
                        icon: String(item.icon || "Sparkles"),
                        link: String(item.link || "#"),
                        active: Boolean(item.active),
                        visible: item.visible !== undefined ? Boolean(item.visible) : true,
                        color: String(item.color || "indigo"),
                        linkText: String(item.linkText || ""),
                        badge: String(item.badge || "")
                    }));
                }
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
        const hash = await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: ABIS.CMS,
            functionName: 'updateAnnouncement',
            args: [jsonString],
        });

        return hash;
    }, [poolSettings, writeContractAsync]);

    const updatePoolSettings = useCallback(async (newPoolSettings) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");

        const newSettings = {
            announcement: announcement,
            pool: newPoolSettings
        };
        const jsonString = JSON.stringify(newSettings);
        const hash = await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: ABIS.CMS,
            functionName: 'updateAnnouncement',
            args: [jsonString],
        });

        return hash;
    }, [announcement, writeContractAsync]);

    const updateNews = useCallback(async (newNews) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");
        const jsonString = JSON.stringify(newNews);
        const hash = await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: ABIS.CMS,
            functionName: 'updateNews',
            args: [jsonString],
        });

        return hash;
    }, [writeContractAsync]);

    const updateFeatureCards = useCallback(async (newCards) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");
        const jsonString = JSON.stringify(newCards);
        const hash = await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: ABIS.CMS,
            functionName: 'updateFeatureCards',
            args: [jsonString],
        });

        return hash;
    }, [writeContractAsync]);

    const batchUpdate = useCallback(async (newAnnouncement, newNews, newCards) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");
        const hash = await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: ABIS.CMS,
            functionName: 'batchUpdate',
            args: [
                JSON.stringify(newAnnouncement),
                JSON.stringify(newNews),
                JSON.stringify(newCards)
            ],
        });

        return hash;
    }, [writeContractAsync]);

    // ============================================
    // WRITE FUNCTIONS - ROLE MANAGEMENT
    // ============================================

    const grantOperator = useCallback(async (operatorAddress) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");
        return await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: ABIS.CMS,
            functionName: 'grantOperator',
            args: [operatorAddress],
        });
    }, [writeContractAsync]);

    const revokeOperator = useCallback(async (operatorAddress) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");
        return await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: ABIS.CMS,
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
            abi: ABIS.CMS,
            functionName: 'grantPrivilege',
            args: [userAddress, featureId],
        });
    }, [writeContractAsync]);

    const revokePrivilege = useCallback(async (userAddress, featureId) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");
        return await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: ABIS.CMS,
            functionName: 'revokePrivilege',
            args: [userAddress, featureId],
        });
    }, [writeContractAsync]);

    const batchGrantPrivileges = useCallback(async (userAddresses, featureIds) => {
        if (!CMS_CONTRACT_ADDRESS) throw new Error("Contract address missing");
        return await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: ABIS.CMS,
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
            if (!publicClient) return false;
            const result = await publicClient.readContract({
                address: CMS_CONTRACT_ADDRESS,
                abi: ABIS.CMS,
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
        isLoadingCards: loadingCards,
        isLoadingAnnouncement: loadingAnnouncement,
        isLoadingNews: loadingNews,
        hasError: announcementError || newsError || cardsError,

        // Content write functions
        updateAnnouncement,
        updatePoolSettings,
        updateNews,
        updateFeatureCards,
        batchUpdate,

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
// Feature constants moved to shared/constants/cmsFeatures.js
