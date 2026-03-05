/**
 * Referral Tracking Utility
 * Standard: EIP-191 compliant address tracking for viral growth.
 */

const REF_KEY = 'disco_ref';

export const referralUtils = {
    /**
     * Save referrer address to localStorage
     */
    saveReferrer: (address) => {
        if (!address || !address.startsWith('0x')) return;
        // Don't overwrite if already exists to prevent referrer hijacking
        if (!localStorage.getItem(REF_KEY)) {
            localStorage.setItem(REF_KEY, address.toLowerCase());
        }
    },

    /**
     * Get the current referrer from storage
     */
    getReferrer: () => {
        return localStorage.getItem(REF_KEY);
    },

    /**
     * Clear referrer after successful sync
     */
    clearReferrer: () => {
        localStorage.removeItem(REF_KEY);
    },

    /**
     * Generate a referral link for a user
     */
    generateLink: (address) => {
        const baseUrl = window.location.origin;
        return `${baseUrl}/profile/${address}?ref=${address}`;
    }
};
