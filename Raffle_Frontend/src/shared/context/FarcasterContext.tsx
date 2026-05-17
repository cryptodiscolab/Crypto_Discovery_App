import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { sdk as _sdk } from '@farcaster/miniapp-sdk';

const sdk = _sdk as { actions: { ready: () => Promise<void> }; context: Promise<{ client?: unknown; user?: { fid: number; username?: string; displayName?: string; pfpUrl?: string } } | null> };

interface FrameUser {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
}

interface FarcasterContextType {
    frameUser: FrameUser | null;
    client: { config?: { theme?: string; safeAreaInsets?: { top?: number; bottom?: number; left?: number; right?: number } } } | null;
    safeAreaInsets: { top?: number; bottom?: number; left?: number; right?: number } | null;
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
    const [frameUser, setFrameUser] = useState<FrameUser | null>(null);
    const [client, setClient] = useState<FarcasterContextType['client']>(null);
    const [safeAreaInsets, setSafeAreaInsets] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null);
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
                    setClient(context.client as FarcasterContextType['client']);
                    setSafeAreaInsets(((context.client as { config?: { safeAreaInsets?: { top?: number; bottom?: number; left?: number; right?: number } } }).config?.safeAreaInsets) || null);

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
