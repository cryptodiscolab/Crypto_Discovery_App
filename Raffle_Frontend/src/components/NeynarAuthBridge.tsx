import React from 'react';
import { NeynarAuthButton, useNeynarContext } from '@neynar/react';
import { cleanWallet } from '../utils/cleanWallet';

/**
 * NeynarAuthBridge:
 * Synchronizes Neynar SIWN with Crypto Disco Auth Status.
 * Ensures zero-RIBA compliance and sanitized identity attribution.
 */
export const NeynarAuthBridge = ({ onSuccess }: { onSuccess?: (status: any) => void }) => {
    const { user } = useNeynarContext();

    React.useEffect(() => {
        if (user?.custody_address) {
            const sanitizedWallet = cleanWallet(user.custody_address);

            const authStatus = {
                wallet: sanitizedWallet,
                sid: user.signer_uuid,
                fid: user.fid,
                status: 'AUTHENTICATED'
            };

            localStorage.setItem('crypto_disco_auth_status', JSON.stringify(authStatus));

            if (onSuccess) onSuccess(authStatus);
        }
    }, [user, onSuccess]);

    return (
        <div className="neynar-bridge-container w-full">
            <NeynarAuthButton
                className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 active:scale-95 duration-75"
            />
        </div>
    );
};

