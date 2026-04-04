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

/**
 * Calculates all active multipliers for a user.
 * @param {Object} userStats - { points, currentTier, lastActivity }
 * @param {Number} totalUsers - System user count
 * @returns {Object} { global, individual, underdog, total }
 */
export function calculateMultipliers(userStats, totalUsers = 1000) {
    if (!userStats) return { global: 1.0, individual: 1.0, underdog: 1.0, total: 1.0 };

    // 1. Global Multiplier (Logarithmic)
    // Formula: 1.5 / (1 + log10(totalUsers / 1000 + 1))
    const globalMult = 1.5 / (1 + Math.log10(totalUsers / 1000 + 1));

    // 2. Individual Multiplier (Tier-Safe / Anti-Whale)
    // Formula: MAX(0.5, 1.0 - (userXP / 20000))
    const userXP = userStats.points || 0;
    const individualMult = Math.max(0.5, 1.0 - (userXP / 20000));

    // 3. Underdog Bonus (+10%)
    // Condition: Tier 0-2 AND active within 48 hours
    const isUnderdog = (userStats.currentTier || 0) <= 2;
    const now = Math.floor(Date.now() / 1000);
    const lastActivity = userStats.lastActivity || 0;
    const isActiveRecently = (now - lastActivity) <= (48 * 3600);
    
    const underdogMult = (isUnderdog && isActiveRecently) ? 1.1 : 1.0;

    // Total Multiplier
    const total = globalMult * individualMult * underdogMult;

    return {
        global: Number(globalMult.toFixed(4)),
        individual: Number(individualMult.toFixed(4)),
        underdog: Number(underdogMult.toFixed(4)),
        total: Number(total.toFixed(4)),
        isUnderdogActive: isUnderdog && isActiveRecently
    };
}

/**
 * Estimates the final XP reward after all scaling factors.
 * @param {Number} baseXP - The points_value from setup
 * @param {Object} multipliers - Result from calculateMultipliers
 * @returns {Number} Rounded estimated XP (Min: 5)
 */
export function estimateXP(baseXP, multipliers) {
    if (!baseXP) return 0;
    const estimated = Math.round(baseXP * multipliers.total);
    return Math.max(5, estimated);
}
