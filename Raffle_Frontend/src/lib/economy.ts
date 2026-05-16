/**
 * 💹 Nexus Hybrid Economy Utilities (v3.41.2)
 *
 * Mirror of Supabase RPC: fn_increment_xp
 * Enforces:
 * 1. Logarithmic Global Scaling (Macro-Inflation Control)
 * 2. Tier-Safe Individual Scaling (Whale Prevention)
 * 3. Underdog Catch-up Bonus (Retention/Retention)
 * 4. 5 XP Minimum Floor
 */

// Economy tuning knobs — sourced from env with sensible defaults
const GLOBAL_MULT_BASE = Number(import.meta.env.VITE_ECONOMY_GLOBAL_MULT_BASE || 1.5);
const GLOBAL_MULT_DIVISOR = Number(import.meta.env.VITE_ECONOMY_GLOBAL_MULT_DIVISOR || 1000);
const INDIVIDUAL_FLOOR = Number(import.meta.env.VITE_ECONOMY_INDIVIDUAL_FLOOR || 0.5);
const ANTI_WHALE_DIVISOR = Number(import.meta.env.VITE_ECONOMY_ANTI_WHALE_DIVISOR || 20000);
const UNDERDOG_BONUS = Number(import.meta.env.VITE_ECONOMY_UNDERDOG_BONUS || 1.1);
const MIN_XP_FLOOR = Number(import.meta.env.VITE_ECONOMY_MIN_XP || 5);

export interface UserStats {
    points: number;
    currentTier: number;
    lastActivity: number;
    [key: string]: unknown; // Allow other properties
}

export interface MultiplierResult {
    global: number;
    individual: number;
    underdog: number;
    total: number;
    isUnderdogActive: boolean;
}

/**
 * Calculates all active multipliers for a user.
 * @param {UserStats} userStats - { points, currentTier, lastActivity }
 * @param {Number} totalUsers - System user count
 * @returns {MultiplierResult} { global, individual, underdog, total }
 */
export function calculateMultipliers(userStats: UserStats | null, totalUsers: number = GLOBAL_MULT_DIVISOR): MultiplierResult {
    if (!userStats) return { global: 1.0, individual: 1.0, underdog: 1.0, total: 1.0, isUnderdogActive: false };

    // 1. Global Multiplier (Logarithmic)
    const globalMult = GLOBAL_MULT_BASE / (1 + Math.log10(totalUsers / GLOBAL_MULT_DIVISOR + 1));

    // 2. Individual Multiplier (Tier-Safe / Anti-Whale)
    const userXP = userStats.points || 0;
    const individualMult = Math.max(INDIVIDUAL_FLOOR, 1.0 - (userXP / ANTI_WHALE_DIVISOR));

    // 3. Underdog Bonus
    const isUnderdog = (userStats.currentTier || 0) <= 2;
    const now = Math.floor(Date.now() / 1000);
    const lastActivity = userStats.lastActivity || 0;
    const isActiveRecently = (now - lastActivity) <= (48 * 3600);

    const underdogMult = (isUnderdog && isActiveRecently) ? UNDERDOG_BONUS : 1.0;

    const total = globalMult * individualMult * underdogMult;

    return {
        global: Number(globalMult.toFixed(4)),
        individual: Number(individualMult.toFixed(4)),
        underdog: Number(underdogMult.toFixed(4)),
        total: Number(total.toFixed(4)),
        isUnderdogActive: !!(isUnderdog && isActiveRecently)
    };
}

/**
 * Estimates the final XP reward after all scaling factors.
 * @param {Number} baseXP - The points_value from setup
 * @param {MultiplierResult} multipliers - Result from calculateMultipliers
 * @returns {Number} Rounded estimated XP (Min: MIN_XP_FLOOR)
 */
export function estimateXP(baseXP: number, multipliers: MultiplierResult) {
    if (!baseXP) return 0;
    const estimated = Math.round(baseXP * multipliers.total);
    return Math.max(MIN_XP_FLOOR, estimated);
}
