export interface FarcasterData {
    username?: string;
    fid?: number;
    verified: boolean;
}

export interface TwitterData {
    username?: string;
    verified: boolean;
}

export interface GoogleData {
    email?: string;
    id?: string;
    verified: boolean;
}

export interface BaseData {
    username?: string;
    verified: boolean;
}

export interface SocialProfile {
    farcaster?: FarcasterData;
    twitter?: TwitterData;
    google?: GoogleData;
    base?: BaseData;
    isVerified: boolean;
}

export interface BaseResponse<T> {
    data?: T;
    error?: string;
    success: boolean;
}

export interface CallReceipt {
    transactionHash: `0x${string}`;
    blockHash: `0x${string}`;
    blockNumber: bigint;
    status: 'success' | 'reverted';
}

export interface CallStatusResponse {
    status: 'PENDING' | 'CONFIRMED' | 'FAILED';
    receipts?: CallReceipt[];
}

export interface RaffleExtraMetadata {
    [key: string]: unknown; // Flexibel for UGC metadata
}

export interface Raffle {
    id: number;
    totalTickets: number;
    maxTickets: number;
    targetPrizePool: bigint;
    prizePool: bigint;
    participants: string[];
    winners: string[];
    winnerCount: number;
    randomNumber: bigint;
    isActive: boolean;
    isFinalized: boolean;
    sponsor: string;
    metadataURI: string;
    endTime: number;
    prizePerWinner: bigint;
    // Off-chain metadata
    title?: string;
    description?: string;
    image_url?: string;
    prizeName?: string;
    floorPrice?: string;
    category?: string;
    // Extension fields for mission/reputation guards
    min_sbt_level?: number;
    is_base_social_required?: boolean;
    twitter_link?: string;
    external_link?: string;
    created_at?: string;
    extra_metadata?: RaffleExtraMetadata;
}
