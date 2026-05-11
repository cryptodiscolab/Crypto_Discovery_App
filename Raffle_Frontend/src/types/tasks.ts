import { Database } from './database.types';

export type Tables = Database['public']['Tables'];

export interface Task {
    id: number | string;
    title: string;
    link: string;
    baseReward: number;
    isActive: boolean;
    cooldown: number;
    minTier: number;
    createdAt?: number;
    requiresVerification: boolean;
    sponsorshipId: number;
    platform?: string;
    action_type?: string;
    isBaseSocialRequired?: boolean;
}

export interface UGCCampaign {
    id: string;
    title: string;
    platform_code: string;
    reward_amount_per_user: number;
    reward_symbol: string;
    is_active: boolean;
    is_verified_payment: boolean;
    subTasks?: Task[];
}

export interface FarcasterProfile {
    fid?: number;
    username?: string;
    pfp_url?: string;
    display_name?: string;
    is_base_social_verified?: boolean;
    is_twitter_verified?: boolean;
    is_tiktok_verified?: boolean;
    is_instagram_verified?: boolean;
    wallet_address?: string;
}

export interface UserTaskClaim {
    task_id: string;
    wallet_address: string;
    claimed_at: string;
}

export type ContractTask = readonly [
    bigint,   // baseReward
    boolean,  // isActive
    bigint,   // cooldown
    bigint,   // minTier
    string,   // title
    string,   // link
    bigint,   // createdAt
    boolean,  // requiresVerification
    bigint    // sponsorshipId
];
