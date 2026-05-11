export interface RewardSettings {
    daily: string;
    referral: string;
}

export interface RaffleFees {
    rake: string;
    surcharge: string;
}

export interface RaffleLimits {
    maxUser: string;
    maxParticipants: string;
}

export interface RaffleXp {
    create: string;
    claim: string;
    purchase: string;
}

export interface EconShares {
    owner: string;
    ops: string;
    treasury: string;
    sbt: string;
}

export interface TierWeights {
    diamond: string;
    platinum: string;
    gold: string;
    silver: string;
    bronze: string;
}

export interface MasterParams {
    tUSDC: string;
    mGas: string;
    pPerTicket: string;
    desc: string;
}

export interface SponsorSettings {
    fee: string;
    minPool: string;
    reward: string;
    tasks: string;
}

export interface PoolFormData {
    targetUSDC: number;
    claimTimestamp: number;
}

export interface SystemPointers {
    creatorToken: string;
    usdcToken: string;
    raffleContract: string;
    dailyApp: string;
    masterX: string;
}

export interface TokenWhitelist {
    address: string;
    symbol: string;
    decimals: string;
    chain_id: string;
}
