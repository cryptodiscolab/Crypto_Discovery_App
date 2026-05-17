import { useState, useCallback, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import toast from 'react-hot-toast';

/**
 * useWalletAttest — FREE identity verification (no API cost, no third-party).
 *
 * Flow:
 *  1. User clicks "Verify with Wallet" → wallet pops up signature request
 *  2. User signs an EIP-191 message asserting they are a unique person
 *  3. Hook posts to /api/user-bundle?action=link-wallet-attest
 *  4. Backend verifies signature + timestamp → adds 'wallet-attest' to verifications array
 *
 * Anti-Sybil: Combined with on-chain transaction history (gas paid), this provides
 * sufficient uniqueness proof for non-monetary flows. Higher-value flows still
 * recommend Farcaster/Twitter/Base for stronger Sybil resistance.
 *
 * Why this matters:
 *  - No API key cost (no Neynar, no Twitter API, no Base name resolution)
 *  - Works offline-first (only needs wallet + Vercel function)
 *  - User-friendly: 1 signature, no OAuth popup, no external account linking
 */
export function useWalletAttest() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [isAttesting, setIsAttesting] = useState(false);
    const [isAttested, setIsAttested] = useState<boolean | null>(null);

    // Check current attestation status on mount / address change
    useEffect(() => {
        if (!address) {
            setIsAttested(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/user-bundle?action=social-status&address=${address.toLowerCase()}`);
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled) return;
                // social-status returns { isVerified, farcaster, twitter, ... }
                // We optimistically check via that flag — backend already counts wallet-attest.
                if (typeof data.isVerified === 'boolean') {
                    setIsAttested(data.isVerified);
                }
            } catch {
                // ignore — UI will let user retry
            }
        })();
        return () => { cancelled = true; };
    }, [address]);

    const attest = useCallback(async (): Promise<boolean> => {
        if (!address) {
            toast.error('Connect your wallet first');
            return false;
        }
        setIsAttesting(true);
        const tid = toast.loading('Preparing attestation...');
        try {
            const timestamp = new Date().toISOString();
            const message = [
                'Disco Gacha Wallet Attestation',
                '',
                'I am a unique person and this wallet is mine.',
                `Wallet: ${address.toLowerCase()}`,
                `Time: ${timestamp}`,
                '',
                'This signature does not authorize any transaction or transfer of funds.',
                'It only verifies my identity for the Disco Gacha platform.'
            ].join('\n');

            toast.loading('Sign in your wallet...', { id: tid });
            const signature = await signMessageAsync({ message });

            toast.loading('Verifying attestation...', { id: tid });
            const res = await fetch('/api/user-bundle', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    action: 'link-wallet-attest',
                    wallet_address: address,
                    signature,
                    message
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || `Attestation failed (HTTP ${res.status})`);
            }

            setIsAttested(true);
            if (data.already_attested) {
                toast.success('Already verified!', { id: tid });
            } else {
                toast.success('Identity verified! 🎉', { id: tid, duration: 5000 });
            }
            return true;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(msg || 'Attestation failed', { id: tid });
            return false;
        } finally {
            setIsAttesting(false);
        }
    }, [address, signMessageAsync]);

    return {
        attest,
        isAttesting,
        isAttested
    };
}
