/**
 * Profile Feature Types
 * [v3.61.0] Centralized Type Definitions
 */

export interface ProfileData {
    id?: string;
    wallet_address?: string;
    avatarUrl?: string;
    pfp_url?: string;
    powerBadge?: boolean;
    fid?: string | number | null;
    displayName?: string;
    display_name?: string;
    username?: string;
    is_base_social_verified?: boolean;
    base_username?: string | null;
    neynarScore?: number;
    neynar_score?: number;
    total_xp?: number;
    rankName?: string;
    rank_name?: string;
    tier?: number;
    google_id?: string | null;
    twitter_id?: string | null;
    streakCount?: number;
    streak_count?: number;
    created_at?: string;
    updated_at?: string;
}

export interface ActivityLog {
    id: string;
    wallet_address?: string;
    category: string;
    activity_type: string;
    description: string;
    created_at: string;
    value_amount: number;
    value_symbol: string;
    tx_hash?: string;
    metadata?: unknown;
}

export interface OnChainUserData {
    currentTier?: bigint | number;
    balance?: bigint | number;
    lastClaim?: bigint | number;
}
