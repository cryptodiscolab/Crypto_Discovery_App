/**
 * retry.util.js — Exponential Backoff Retry Helper (VS4 Fix)
 *
 * Wraps any async function with configurable retry logic.
 * Retries only on transient errors (429 rate-limit, 5xx server errors, network timeouts).
 * Non-retryable errors (401 unauthorized, 403 forbidden) throw immediately.
 *
 * Usage:
 *   const result = await withRetry(() => neynarClient.fetchFollowing(fid));
 */

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const TWITTER_RATE_LIMIT_CODE = 88; // Twitter v2 specific rate-limit error code

/**
 * Determines if an error is transient (worth retrying).
 * @param {Error} error
 * @returns {boolean}
 */
function isRetryable(error) {
    // HTTP status codes in error object
    const status = error?.status ?? error?.statusCode ?? error?.response?.status;
    if (status && RETRYABLE_STATUS_CODES.has(Number(status))) return true;

    // Twitter API v2 specific: errors array with code 88 = rate limit
    const twitterErrors = error?.errors ?? error?.data?.errors ?? [];
    if (Array.isArray(twitterErrors) && twitterErrors.some(e => e?.code === TWITTER_RATE_LIMIT_CODE)) return true;

    // Neynar SDK may return { status: 429 } or wrap in ApiError
    if (error?.name === 'ApiError' && RETRYABLE_STATUS_CODES.has(Number(error?.status))) return true;

    // Network errors (ECONNRESET, ETIMEDOUT, etc.)
    const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'socket hang up'];
    if (networkErrors.some(msg => error?.message?.includes(msg) || error?.code === msg)) return true;

    return false;
}

/**
 * Executes an async function with exponential backoff retry.
 *
 * @param {function(): Promise<*>} fn           - Async function to execute
 * @param {object}                 [options]
 * @param {number}                 [options.retries=3]      - Max retry attempts (not counting first)
 * @param {number}                 [options.baseDelay=1000] - Base delay in ms (doubles each retry)
 * @param {number}                 [options.maxDelay=15000] - Cap on delay between retries
 * @param {string}                 [options.label='']       - Label for structured log output
 * @returns {Promise<*>}
 */
async function withRetry(fn, { retries = 3, baseDelay = 1000, maxDelay = 15000, label = '' } = {}) {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;

            if (!isRetryable(err)) {
                // Non-transient — fail immediately, don't waste quota
                throw err;
            }

            if (attempt < retries) {
                // Exponential backoff + small jitter to spread retries
                const expDelay = baseDelay * Math.pow(2, attempt);
                const jitter = Math.floor(Math.random() * 200);
                const delay = Math.min(expDelay + jitter, maxDelay);

                const status = err?.status ?? err?.statusCode ?? '?';
                console.warn(
                    `[Retry${label ? ':' + label : ''}] Attempt ${attempt + 1}/${retries + 1} failed ` +
                    `(status=${status}). Retrying in ${delay}ms…`
                );

                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    console.error(`[Retry${label ? ':' + label : ''}] All ${retries + 1} attempts exhausted.`);
    throw lastError;
}

module.exports = { withRetry, isRetryable };
