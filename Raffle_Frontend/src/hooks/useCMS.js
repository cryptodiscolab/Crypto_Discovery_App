import React, { useState, useEffect } from 'react';
import { useReadContract, useWriteContract, useAccount } from 'wagmi';
import { CMS_CONTRACT_ABI } from '../shared/constants/abis';
import toast from 'react-hot-toast';

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
        watch: true,
    });

    const [ethPrice, setEthPrice] = useState(2500); // Fallback price

    // Fetch ETH Price from CoinGecko (Simple public API)
    useEffect(() => {
        const fetchPrice = async () => {
            try {
                const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
                const data = await response.json();
                if (data.ethereum?.usd) {
                    setEthPrice(data.ethereum.usd);
                    console.log('[useCMS] ETH Price Updated:', data.ethereum.usd);
                }
            } catch (e) {
                console.error("Failed to fetch ETH price:", e);
            }
        };

        fetchPrice();
        const interval = setInterval(fetchPrice, 5 * 60 * 1000); // Update every 5 minutes
        return () => clearInterval(interval);
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
        watch: true,
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
        watch: true,
    });

    // ============================================
    // READ ROLES
    // ============================================

    const { data: isAdminRaw } = useReadContract({
        address: CMS_CONTRACT_ADDRESS,
        abi: CMS_CONTRACT_ABI,
        functionName: 'hasRole',
        args: [DEFAULT_ADMIN_ROLE, address || "0x0"],
    });

    const { data: isOperatorRaw } = useReadContract({
        address: CMS_CONTRACT_ADDRESS,
        abi: CMS_CONTRACT_ABI,
        functionName: 'isOperator',
        args: [address || "0x0"],
    });

    // Robust check fallbacks (using ENV for immediate UI response)
    const envAdmin = import.meta.env.VITE_ADMIN_ADDRESS;
    const isEnvAdmin = address && envAdmin && address.toLowerCase() === envAdmin.toLowerCase();

    // Final boolean roles
    const isAdmin = isAdminRaw || isEnvAdmin || false;
    const isOperator = isOperatorRaw || isEnvAdmin || false; // Admin is also an operator
    const canEdit = isAdmin || isOperator;


    // ============================================
    // PARSE JSON DATA WITH ERROR BOUNDARIES
    // ============================================

    let announcement = DEFAULT_ANNOUNCEMENT;
    let poolSettings = DEFAULT_POOL_SETTINGS;
    let news = DEFAULT_NEWS;
    let featureCards = DEFAULT_FEATURE_CARDS;

    try {
        if (announcementRaw && typeof announcementRaw === 'string' && announcementRaw.trim() !== "") {
            const parsed = JSON.parse(announcementRaw);
            // Support both old flat structure and new nested structure
            if (parsed.announcement) {
                announcement = parsed.announcement;
                poolSettings = parsed.pool || DEFAULT_POOL_SETTINGS;
            } else {
                announcement = parsed;
            }
        }
    } catch (e) {
        console.error("Failed to parse announcement JSON, using defaults:", e);
    }

    try {
        if (newsRaw && typeof newsRaw === 'string' && newsRaw.trim() !== "") {
            news = JSON.parse(newsRaw);
        }
    } catch (e) {
        console.error("Failed to parse news JSON, using defaults:", e);
    }

    try {
        if (featureCardsRaw && typeof featureCardsRaw === 'string' && featureCardsRaw.trim() !== "") {
            featureCards = JSON.parse(featureCardsRaw);
        }
    } catch (e) {
        console.error("Failed to parse feature cards JSON, using defaults:", e);
    }

    // DEBUG: Log admin status
    console.log('[useCMS] Contract Address:', CMS_CONTRACT_ADDRESS);
    console.log('[useCMS] Current User:', address);
    console.log('[useCMS] isAdminRaw:', isAdminRaw);
    console.log('[useCMS] isOperatorRaw:', isOperatorRaw);

    // ============================================
    // WRITE FUNCTIONS - CONTENT MANAGEMENT
    // ============================================

    const updateAnnouncement = async (newAnnouncement) => {
        // Wrap in system structure to preserve pool settings
        const newSettings = {
            announcement: newAnnouncement,
            pool: poolSettings
        };
        const jsonString = JSON.stringify(newSettings);
        const hash = await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'updateAnnouncement',
            args: [jsonString],
        });
        return hash;
    };

    const updatePoolSettings = async (newPoolSettings) => {
        const newSettings = {
            announcement: announcement,
            pool: newPoolSettings
        };
        const jsonString = JSON.stringify(newSettings);
        const hash = await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'updateAnnouncement',
            args: [jsonString],
        });
        return hash;
    };

    const updateNews = async (newNews) => {
        const jsonString = JSON.stringify(newNews);
        const hash = await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'updateNews',
            args: [jsonString],
        });
        return hash;
    };

    const updateFeatureCards = async (newCards) => {
        const jsonString = JSON.stringify(newCards);
        const hash = await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'updateFeatureCards',
            args: [jsonString],
        });
        return hash;
    };

    /**
     * Batch update all content in one transaction (GAS SAVER!)
     */
    const batchUpdate = async (newAnnouncement, newNews, newCards) => {
        const hash = await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'batchUpdate',
            args: [
                JSON.stringify(newAnnouncement),
                JSON.stringify(newNews),
                JSON.stringify(newCards)
            ],
        });
        return hash;
    };

    // ============================================
    // WRITE FUNCTIONS - ROLE MANAGEMENT
    // ============================================

    const grantOperator = async (operatorAddress) => {
        const hash = await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'grantOperator',
            args: [operatorAddress],
        });
        return hash;
    };

    const revokeOperator = async (operatorAddress) => {
        const hash = await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'revokeOperator',
            args: [operatorAddress],
        });
        return hash;
    };

    // ============================================
    // WRITE FUNCTIONS - SPONSORED ACCESS WHITELIST
    // ============================================

    const grantPrivilege = async (userAddress, featureId) => {
        const hash = await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'grantPrivilege',
            args: [userAddress, featureId],
        });
        return hash;
    };

    const revokePrivilege = async (userAddress, featureId) => {
        const hash = await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'revokePrivilege',
            args: [userAddress, featureId],
        });
        return hash;
    };

    /**
     * Batch grant privileges to multiple users (GAS SAVER!)
     */
    const batchGrantPrivileges = async (userAddresses, featureIds) => {
        const hash = await writeContractAsync({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'batchGrantPrivileges',
            args: [userAddresses, featureIds],
        });
        return hash;
    };

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    /**
     * Check if a user has access to a specific feature
     */
    const checkAccess = async (userAddress, featureId) => {
        const { data } = await useReadContract({
            address: CMS_CONTRACT_ADDRESS,
            abi: CMS_CONTRACT_ABI,
            functionName: 'hasAccess',
            args: [userAddress, featureId],
        });
        return data;
    };

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
