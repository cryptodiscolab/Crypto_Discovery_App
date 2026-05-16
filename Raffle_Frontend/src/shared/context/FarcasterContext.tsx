import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

interface FarcasterContextType {
    frameUser: unknown | null;
    client: unknown | null;
    safeAreaInsets: unknown | null;
    isFrame: boolean;
    isLoading: boolean;
    error: unknown | null;
}

const FarcasterContext = createContext<FarcasterContextType>({
    frameUser: null,
    client: null,
    safeAreaInsets: null,
    isFrame: false,
    isLoading: true,
    error: null
});

export function FarcasterProvider({ children }: { children: ReactNode }) {
    const [frameUser, setFrameUser] = useState<unknown | null>(null);
    const [client, setClient] = useState<unknown | null>(null);
    const [safeAreaInsets, setSafeAreaInsets] = useState<unknown | null>(null);
    const [isFrame, setIsFrame] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, _setError] = useState<unknown | null>(null);

    useEffect(() => {
        const loadContext = async () => {
            try {
                // Ensure SDK is ready before grabbing context
                await sdk.actions.ready();
                const context = await sdk.context;

                if (context) {
                    setIsFrame(true);
                    setClient(context.client);
                    setSafeAreaInsets((context.client as unknown).config?.safeAreaInsets || null);

                    if (context.user) {
                        setFrameUser({
                            fid: context.user.fid,
                            username: context.user.username,
                            displayName: context.user.displayName,
                            pfpUrl: context.user.pfpUrl
                        });
                    }
                }
            } catch (err) {
                console.error('[FarcasterContext] Failed to load context:', err);
                // Note: Not throwing error or blocking here as it might be a normal web load
                setIsFrame(false);
            } finally {
                setIsLoading(false);
            }
        };

        loadContext();
    }, []);

    return (
        <FarcasterContext.Provider value={{ frameUser, client, safeAreaInsets, isFrame, isLoading, error }}>
            {children}
        </FarcasterContext.Provider>
    );
}

export const useFarcaster = () => useContext(FarcasterContext);
