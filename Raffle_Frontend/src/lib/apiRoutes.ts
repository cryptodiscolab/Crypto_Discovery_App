/**
 * Typed API Route Registry
 *
 * Central source of truth for all backend API endpoints. Use this instead of
 * raw string literals in `fetch('/api/...')` to prevent route drift.
 *
 * Run `npm run check-routes` to verify all string-literal routes match these constants.
 */

// User bundle actions (POST /api/user-bundle with `action` body field)
export const USER_BUNDLE_ACTIONS = {
    SYNC: 'sync',
    XP: 'xp',
    FC_SYNC: 'fc-sync',
    UPDATE_PROFILE: 'update-profile',
    GET_ACTIVITY_LOGS: 'get-activity-logs',
    GET_PROFILE: 'get-profile',
    LOG_ACTIVITY: 'log-activity',
    GET_POINT_SETTINGS: 'get-point-settings',
    SYNC_UGC_MISSION: 'sync-ugc-mission',
    SYNC_UGC_RAFFLE: 'sync-ugc-raffle',
    SBT_MINT_ENTITLEMENT: 'sbt-mint-entitlement',
    SYNC_SBT_UPGRADE: 'sync-sbt-upgrade',
    SYNC_POOL_CLAIM: 'sync-pool-claim',
    LEADERBOARD: 'leaderboard',
    SYNC_OAUTH: 'sync-oauth',
    SYNC_BASE_SOCIAL: 'sync-base-social',
    APPROVE_MISSION: 'approve-mission',
    APPROVE_RAFFLE: 'approve-raffle',
    REJECT_RAFFLE: 'reject-raffle',
    CHECK_ADMIN: 'check-admin',
    PENDING_MISSIONS: 'pending-missions',
    PENDING_RAFFLES: 'pending-raffles',
    GET_HEALTH: 'get-health',
    RESET_HEALTH: 'reset-health',
    GENERATE_SYNC_SIGNATURE: 'generate-sync-signature',
    SOCIAL_STATUS: 'social-status',
    GET_DAILY_PROGRESS: 'get-daily-progress',
    ECOSYSTEM_STATS: 'ecosystem-stats',
    CHECK_REPUTATION: 'check-reputation',
    RECORD_PENDING_SYNC: 'record-pending-sync',
    GET_PENDING_SYNCS: 'get-pending-syncs'
} as const;

export type UserBundleAction = typeof USER_BUNDLE_ACTIONS[keyof typeof USER_BUNDLE_ACTIONS];

// Admin bundle actions
export const ADMIN_BUNDLE_ACTIONS = {
    CHECK: 'check',
    GET_SBT_CONFIG: 'GET_SBT_CONFIG',
    PARITY_AUDIT: 'parity-audit',
    SYNC_TIERS: 'sync-tiers',
    SYNC_POINTS: 'sync-points',
    SYNC_MULTIPLIERS: 'SYNC_MULTIPLIERS',
    SYNC_WEIGHTS: 'SYNC_WEIGHTS',
    WHITELIST_TOKEN_DB: 'WHITELIST_TOKEN_DB',
    REMOVE_TOKEN_DB: 'REMOVE_TOKEN_DB',
    GET_ECONOMY: 'GET_ECONOMY',
    ECONOMY_STATS: 'economy-stats',
    ACCOUNTANT_LEDGER: 'accountant-ledger',
    ACCOUNTANT_SYNC: 'accountant-sync',
    TASK_CREATE: 'task-create',
    TASK_CLEAR: 'task-clear',
    TASK_SYNC: 'task-sync',
    UPDATE_POINTS: 'UPDATE_POINTS',
    BATCH_UPDATE_POINTS: 'BATCH_UPDATE_POINTS',
    GRANT_ROLE: 'GRANT_ROLE',
    REVOKE_ROLE: 'REVOKE_ROLE',
    SYNC_RAFFLE: 'SYNC_RAFFLE',
    CREATE_CAMPAIGN: 'CREATE_CAMPAIGN',
    UPDATE_CAMPAIGN_STATUS: 'UPDATE_CAMPAIGN_STATUS',
    DELETE_CAMPAIGN: 'DELETE_CAMPAIGN',
    RESET_SEASON: 'RESET_SEASON',
    GRANT_PRIVILEGE: 'GRANT_PRIVILEGE',
    REVOKE_PRIVILEGE: 'REVOKE_PRIVILEGE',
    ISSUE_ENS: 'ISSUE_ENS',
    UPDATE_FEATURE_FLAGS: 'UPDATE_FEATURE_FLAGS',
    UPDATE_UGC_CONFIG: 'UPDATE_UGC_CONFIG',
    CREATE_UGC_MISSION: 'CREATE_UGC_MISSION',
    VERIFY_UGC_PAYMENT_ONCHAIN: 'VERIFY_UGC_PAYMENT_ONCHAIN',
    REJECT_MISSION: 'reject-mission',
    GET_UGC_REVENUE: 'GET_UGC_REVENUE',
    MARK_REVENUE_ALLOCATED: 'MARK_REVENUE_ALLOCATED',
    UPDATE_THRESHOLDS: 'UPDATE_THRESHOLDS',
    UPDATE_TIER_CONFIG: 'UPDATE_TIER_CONFIG',
    MANUAL_TIER_OVERRIDE: 'MANUAL_TIER_OVERRIDE',
    NEXUS_DISPATCH: 'NEXUS_DISPATCH',
    GET_ERROR_LOGS: 'GET_ERROR_LOGS'
} as const;

export type AdminBundleAction = typeof ADMIN_BUNDLE_ACTIONS[keyof typeof ADMIN_BUNDLE_ACTIONS];

// Tasks bundle actions
export const TASKS_BUNDLE_ACTIONS = {
    CLAIM: 'claim',
    VERIFY: 'verify',
    SOCIAL_VERIFY: 'social-verify',
    CLAIM_UGC_CAMPAIGN: 'claim-ugc-campaign'
} as const;

export type TasksBundleAction = typeof TASKS_BUNDLE_ACTIONS[keyof typeof TASKS_BUNDLE_ACTIONS];

// Raffle bundle actions
export const RAFFLE_BUNDLE_ACTIONS = {
    CLAIM_PRIZE: 'claim-prize',
    LEADERBOARD: 'leaderboard',
    ANNOUNCE_WINNER: 'announce-winner',
    CAMPAIGN_JOIN: 'campaign-join'
} as const;

export type RaffleBundleAction = typeof RAFFLE_BUNDLE_ACTIONS[keyof typeof RAFFLE_BUNDLE_ACTIONS];

// Direct API endpoints (no action body)
export const DIRECT_API_ROUTES = {
    NOTIFY: '/api/notify',
    PIN_METADATA: '/api/pin-metadata',
    PING: '/api/ping',
    IS_ADMIN: '/api/is-admin'
} as const;

// Bundle endpoints
export const BUNDLE_ROUTES = {
    USER: '/api/user-bundle',
    ADMIN: '/api/admin-bundle',
    TASKS: '/api/tasks-bundle',
    RAFFLE: '/api/raffle-bundle',
    AUDIT: '/api/audit-bundle'
} as const;

/**
 * Typed helper for calling bundle endpoints. Returns response promise.
 *
 * @example
 *   await callUserBundle(USER_BUNDLE_ACTIONS.PENDING_RAFFLES, { wallet, signature, message })
 */
export async function callUserBundle(action: UserBundleAction, body: Record<string, unknown> = {}): Promise<Response> {
    return fetch(BUNDLE_ROUTES.USER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body })
    });
}

export async function callAdminBundle(action: AdminBundleAction, body: Record<string, unknown> = {}): Promise<Response> {
    return fetch(BUNDLE_ROUTES.ADMIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body })
    });
}

export async function callTasksBundle(action: TasksBundleAction, body: Record<string, unknown> = {}): Promise<Response> {
    return fetch(BUNDLE_ROUTES.TASKS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body })
    });
}

export async function callRaffleBundle(action: RaffleBundleAction, body: Record<string, unknown> = {}): Promise<Response> {
    return fetch(BUNDLE_ROUTES.RAFFLE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body })
    });
}
