import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { ShieldCheck, Lock, ArrowRight, AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSIWE } from '../hooks/useSIWE';
import { useNavigate } from 'react-router-dom';

/**
 * SignatureGuard: Senior Security Layer.
 * Enforces mandatory signature approval for all users.
 * Optimized for Mobile (Base App) with zero blurs and flat design.
 */
export const SignatureGuard = ({ children }) => {
    const { address, isConnected, status } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { disconnect } = useDisconnect();
    const { isAuthenticated } = useSIWE();
    const navigate = useNavigate();

    const [isApproved, setIsApproved] = useState(false);
    const [isSigning, setIsSigning] = useState(false);

    const AUTH_KEY = 'crypto_disco_auth_status';

    // 1. Initial Identity Check & Redirection
    useEffect(() => {
        // Wait for Wagmi to initialize
        if (status === 'reconnecting' || status === 'connecting') return;

        const authRaw = localStorage.getItem(AUTH_KEY);
        let isAuth = false;

        if (authRaw) {
            try {
                // Try parsing as JSON (New SDK Format)
                const auth = JSON.parse(authRaw);
                isAuth = auth.status === 'AUTHENTICATED';
            } catch (e) {
                // Fallback for Legacy Format
                isAuth = authRaw === 'authenticated';
            }
        }

        const isFullyAuth = isAuth && isConnected;
        setIsApproved(isFullyAuth);

        if (!isFullyAuth && status === 'disconnected') {
            // Redirect to login ohne modal to prevent blocking UI
            // We use a small timeout to allow routing state to settle if needed
            const timeoutId = setTimeout(() => {
                navigate('/login', { replace: true });
            }, 10);
            return () => clearTimeout(timeoutId);
        }
    }, [isConnected, status, address, isAuthenticated, navigate]);

    // 2. High-Performance Signature Logic (Still available if needed for internal actions)
    const handleSignApproval = useCallback(async () => {
        if (isSigning) return;

        const timestamp = new Date().toISOString();
        const message = `Crypto Disco\n\nLogin and verify identity for revenue sharing and anti-sybil protection.\n\nTimestamp: ${timestamp}`;

        setIsSigning(true);
        try {
            await signMessageAsync({ message });

            localStorage.setItem(AUTH_KEY, 'authenticated');
            setIsApproved(true);
            toast.success("Identity Verified", { icon: '🛡️' });
        } catch (err) {
            console.error('[Security Node] Signature Rejected:', err.message);
            toast.error("Signature required to enter.", { icon: '⚠️' });
        } finally {
            setIsSigning(false);
        }
    }, [signMessageAsync, isSigning]);

    const handleReject = () => {
        disconnect();
        localStorage.removeItem(AUTH_KEY);
        navigate('/login');
    };

    // If connected and approved, show app (Outlet/Children)
    if (isApproved) return children;

    // If connected but not approved: Show Sign-In Prompt (Zero-Flash)
    if (isConnected && !isApproved) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center animate-pulse">
                    <Lock className="text-indigo-400" size={32} />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white uppercase tracking-tighter italic">Identity <span className="text-indigo-500">Locked</span></h2>
                    <p className="text-xs text-slate-500 max-w-[240px] leading-relaxed">
                        Please sign the verification message to access your profile and rewards.
                    </p>
                </div>
                <button
                    onClick={handleSignApproval}
                    disabled={isSigning}
                    className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl shadow-indigo-500/20"
                >
                    {isSigning ? (
                        <div className="flex items-center gap-2">
                            <RefreshCw className="animate-spin w-4 h-4" />
                            Verifying...
                        </div>
                    ) : (
                        <>
                            <ShieldCheck size={16} />
                            Verify Identity
                        </>
                    )}
                </button>
                <button 
                    onClick={handleReject}
                    className="text-[11px] text-slate-500 font-bold uppercase tracking-widest hover:text-red-400 transition-colors pt-2"
                >
                    Disconnect Wallet
                </button>
            </div>
        );
    }

    // While checking or redirecting (disconnected), show nothing to avoid flash
    return null;
};
