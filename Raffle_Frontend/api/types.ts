import { VercelRequest } from '@vercel/node';
import { Database, Json } from './database.types';

export type { Json, Database };
export type DbUserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type DbDailyTask = Database['public']['Tables']['daily_tasks']['Row'];
export type DbUserActivityLog = Database['public']['Tables']['user_activity_logs']['Row'];

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
    id: number;
    activity_key: string;
    points_value: number;
    is_active: boolean;
}

export interface DailyTask extends Omit<DbDailyTask, 'created_at' | 'expires_at'> {
    created_at: string;
    expires_at?: string;
    task_type: 'social' | 'regular' | 'system' | 'ugc';
}

export interface UserProfile extends DbUserProfile {}

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
