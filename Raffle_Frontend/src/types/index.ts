export interface FarcasterData {
    username?: string;
    fid?: number;
    verified: boolean;
}

export interface TwitterData {
    username?: string;
    verified: boolean;
}

export interface SocialProfile {
    farcaster?: FarcasterData;
    twitter?: TwitterData;
    isVerified: boolean;
}

export interface BaseResponse<T> {
    data?: T;
    error?: string;
    success: boolean;
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
}
