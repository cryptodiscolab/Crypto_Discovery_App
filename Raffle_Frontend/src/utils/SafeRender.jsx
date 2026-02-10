/**
 * Safe Render Utility - Prevents React Error #31
 * 
 * Ensures only primitives (string, number) are rendered as React children.
 * Converts BigInt to string, suppresses objects/undefined/null.
 * 
 * Usage:
 * import { Safe } from '@/utils/SafeRender';
 * <div><Safe v={potentiallyUnsafeValue} /></div>
 */

export const Safe = ({ v }) => {
    if (typeof v === "string" || typeof v === "number") return v;
    if (typeof v === "bigint") return String(v);
    if (v === null || v === undefined) return null;

    // Suppress objects (prevents React Error #31)
    console.warn('[SafeRender] Attempted to render object:', v);
    return null;
};

/**
 * Safe String Converter - Utility function
 * 
 * Converts any value to a safe string for rendering.
 * 
 * @param {*} value - Any value to convert
 * @param {string} fallback - Fallback string if value is invalid
 * @returns {string} Safe string for rendering
 */
export const toSafeString = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "bigint") return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";

    // For objects, try to extract meaningful data
    if (typeof value === "object") {
        // Check for common SDK response patterns
        if (value.toString && typeof value.toString === 'function') {
            const str = value.toString();
            if (str !== '[object Object]') return str;
        }
        console.warn('[toSafeString] Cannot safely convert object:', value);
        return fallback;
    }

    return fallback;
};

/**
 * Safe Number Converter
 * 
 * Converts BigInt or string numbers to regular numbers for display.
 * 
 * @param {*} value - Value to convert
 * @param {number} fallback - Fallback number if conversion fails
 * @returns {number} Safe number
 */
export const toSafeNumber = (value, fallback = 0) => {
    if (typeof value === "number") return value;
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "string") {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
};
