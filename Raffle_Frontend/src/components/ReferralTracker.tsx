import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { referralUtils } from '../utils/referralUtils';

/**
 * Referral Tracking UI/UX Component
 * Captures referral codes from URL parameters (?ref=0x...)
 */
export const ReferralTracker = () => {
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const ref = params.get('ref') || params.get('referred_by') || params.get('r');

        if (ref && ref.startsWith('0x')) {
            console.log('[ReferralTracker] Captured referrer:', ref);
            referralUtils.saveReferrer(ref);
        }
    }, [location]);

    return null; // Side-effect only
};
