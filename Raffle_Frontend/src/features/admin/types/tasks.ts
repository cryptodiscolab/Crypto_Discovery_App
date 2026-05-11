export interface TaskBatchItem {
    platform: string;
    action: string;
    title: string;
    link: string;
    target_id: string;
    baseReward: number;
    minTier: number;
    cooldown: number;
    requiresVerification: boolean;
    isBaseSocialRequired: boolean;
    minNeynarScore: number;
    minFollowers: number;
    accountAgeLimit?: number;
    powerBadgeRequired: boolean;
    noSpamFilter: boolean;
}

export interface SponsorshipRequest {
    id: bigint;
    sponsor: `0x${string}`;
    title: string;
    link: string;
    email: string;
    rewardPool: bigint;
    rewardPerUser: bigint;
    maxClaims: bigint;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface EconomyParams {
    rewardPerClaim: bigint;
    tasksRequired: bigint;
    minPoolValue: bigint;
    platformFee: bigint;
}

export interface OnChainTask {
    id: bigint;
    reward: bigint;
    cooldown: bigint;
    minTier: number;
    title: string;
    link: string;
    isActive: boolean;
    requiresVerification: boolean;
}
