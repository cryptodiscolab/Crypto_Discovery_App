import { createContext, useContext, useState, useEffect } from 'react';
import sdk from '@farcaster/miniapp-sdk';

const FarcasterContext = createContext({
    frameUser: null,
    isLoading: true,
    error: null
});

export function FarcasterProvider({ children }) {
    const [frameUser, setFrameUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadContext = async () => {
            try {
                // Ensure SDK is ready before grabbing context
                await sdk.actions.ready();
                const context = await sdk.context;

                if (context?.user) {
                    setFrameUser({
                        fid: context.user.fid,
                        username: context.user.username,
                        displayName: context.user.displayName,
                        pfpUrl: context.user.pfpUrl
                    });
                }
            } catch (err) {
                console.error('[FarcasterContext] Failed to load context:', err);
                setError(err);
            } finally {
                setIsLoading(false);
            }
        };

        loadContext();
    }, []);

    return (
        <FarcasterContext.Provider value={{ frameUser, isLoading, error }}>
            {children}
        </FarcasterContext.Provider>
    );
}

export const useFarcaster = () => useContext(FarcasterContext);
