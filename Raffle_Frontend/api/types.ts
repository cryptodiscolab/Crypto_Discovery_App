import { VercelRequest, VercelResponse } from '@vercel/node';

export interface BaseResponse {
    success: boolean;
    error?: string;
    message?: string;
}

export interface TaskClaimResponse extends BaseResponse {
    xp?: number;
    already_claimed?: boolean;
}

export interface PointSetting {
    id: string;
    activity_key: string;
    points_value: number;
    is_active: boolean;
}

export interface DailyTask {
    id: string;
    title: string;
    description: string;
    platform: string;
    action_type: string;
    xp_reward: number;
    target_id?: string;
    task_type: 'social' | 'regular' | 'system' | 'ugc';
    is_active: boolean;
    is_base_social_required: boolean;
    min_neynar_score: number;
    expires_at?: string;
    created_at: string;
    onchain_id?: string;
}

export interface UserProfile {
    wallet_address: string;
    total_xp: number;
    tier: number;
    is_base_social_verified: boolean;
    neynar_score: number;
    referred_by?: string | null;
    referral_bonus_paid: boolean;
    fid?: number | null;
    username?: string | null;
    display_name?: string | null;
    bio?: string | null;
    pfp_url?: string | null;
    google_id?: string | null;
    google_email?: string | null;
    twitter_id?: string | null;
    twitter_username?: string | null;
    oauth_provider?: string | null;
    is_admin?: boolean;
    last_onchain_xp?: number;
    streak_count?: number;
    last_streak_claim?: string | null;
    last_login_at?: string;
    updated_at: string;
    base_username?: string | null;
}

export interface UserActivityLog {
    id?: number;
    wallet_address: string;
    category: 'XP' | 'REWARD' | 'PURCHASE' | 'SOCIAL' | 'ADMIN' | 'IDENTITY' | string;
    activity_type: string;
    description: string;
    value_amount: number;
    value_symbol: string;
    tx_hash?: string | null;
    metadata?: any;
    created_at?: string;
}

export interface SyncPayload {
    wallet_address: string;
    signature: string;
    message: string;
    fid?: number;
    metadata?: any;
    referred_by?: string;
}

export interface XpSyncPayload {
    wallet_address: string;
    signature?: string;
    message?: string;
    tx_hash?: string;
}

export interface UpdateProfilePayload {
    wallet: string;
    signature: string;
    message: string;
    payload: Partial<UserProfile>;
}

export interface UgcMissionPayload {
    title: string;
    description: string;
    sponsor_address: string;
    platform_code: string;
    reward_amount_per_user: string;
    max_participants: number;
    txHash: string;
    tasks_batch: any[];
    reward_symbol: string;
    payment_token: string;
    is_base_social_required?: boolean;
}

export interface UgcRafflePayload {
    raffle_id: string;
    depositETH: string;
    end_time: number;
    max_tickets: number;
    metadata_uri: string;
    extra_metadata: {
        title?: string;
        description?: string;
        image?: string;
        category?: string;
        external_link?: string;
        twitter?: string;
        min_sbt_level?: number;
    };
    winnerCount: number;
    txHash: string;
}

export type ExtendedVercelRequest = VercelRequest & {
    body: {
        action?: string;
        wallet_address?: string;
        signature?: string;
        message?: string;
        task_id?: string;
        platform?: string;
        action_type?: string;
        campaign_id?: string;
        [key: string]: any;
    };
};
