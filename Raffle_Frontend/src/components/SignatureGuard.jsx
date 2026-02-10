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
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { disconnect } = useDisconnect();
    const { isAuthenticated } = useSIWE();
    const navigate = useNavigate();

    const [isApproved, setIsApproved] = useState(false);
    const [isSigning, setIsSigning] = useState(false);

    const AUTH_KEY = 'crypto_disco_auth_status';

    // 1. Initial Identity Check & Redirection
    useEffect(() => {
        // Explicit State Check
        const isAuth = localStorage.getItem(AUTH_KEY) === 'authenticated' && isConnected;

        setIsApproved(isAuth);

        if (!isAuth) {
            // Redirect to login ohne modal to prevent blocking UI
            // We use a small timeout to allow routing state to settle if needed
            const timeoutId = setTimeout(() => {
                navigate('/login', { replace: true });
            }, 10);
            return () => clearTimeout(timeoutId);
        }
    }, [isConnected, address, isAuthenticated, navigate]);

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

    // While checking or redirecting, show nothing to avoid flash of "Login Required" modal
    return null;
};
