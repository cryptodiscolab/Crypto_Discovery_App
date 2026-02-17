import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAccount, useSwitchChain } from 'wagmi';
import { ShieldCheck } from 'lucide-react';
import { baseSepolia } from 'wagmi/chains';
import { ConnectButton } from '@rainbow-me/rainbowkit';

import { useSIWE } from '../hooks/useSIWE';
import { useFarcaster } from '../shared/context/FarcasterContext';

/**
 * Mobile-Optimized Login via Wallet Connect.
 * Adheres to Anti-Riba principle and hardware performance mandates.
 */
export function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { switchChain } = useSwitchChain();
    const { frameUser } = useFarcaster();
    const { signIn, session: siweSession, isLoading: isSigningIn } = useSIWE();
    const from = location.state?.from?.pathname || "/";
    const { address, isConnected } = useAccount();
    const AUTH_KEY = 'crypto_disco_auth_status';

    // Auto-navigate when wallet is connected AND SIWE is done
    useEffect(() => {
        if (isConnected && address && siweSession) {
            navigate(from, { replace: true });
        }
    }, [isConnected, address, siweSession, navigate, from]);

    // Re-entry Prevention: If already authenticated AND connected, skip login
    useEffect(() => {
        if (!isConnected) return; // Don't trust storage if wallet is locked

        const authRaw = localStorage.getItem(AUTH_KEY);
        if (authRaw) {
            try {
                const auth = JSON.parse(authRaw);
                if (auth.status === 'AUTHENTICATED') {
                    navigate(from, { replace: true });
                }
            } catch (e) {
                localStorage.removeItem(AUTH_KEY);
            }
        }
    }, [navigate, from, isConnected]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 bg-[#0B0E14]">
            <div className="relative z-50 pointer-events-auto w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-2xl overflow-hidden">
                {/* Background ID accent */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

                <h1 className="text-3xl font-black text-white mb-2 text-center uppercase italic tracking-tighter relative z-10">
                    Daily<span className="text-indigo-500">App</span>
                </h1>
                <p className="text-slate-500 text-center mb-10 text-[10px] font-bold uppercase tracking-[0.3em] relative z-10">
                    Initialize Protocol Session
                </p>

                <div className="space-y-6 relative z-20">
                    {/* Wallet Connect Button - Static Import for Stability */}
                    <div className="w-full flex justify-center relative z-50 pointer-events-auto">
                        <ConnectButton.Custom>
                            {({
                                account,
                                chain,
                                openAccountModal,
                                openChainModal,
                                openConnectModal,
                                authenticationStatus,
                                mounted,
                            }) => {
                                const ready = mounted && authenticationStatus !== 'loading';
                                const connected =
                                    ready &&
                                    account &&
                                    chain &&
                                    (!authenticationStatus ||
                                        authenticationStatus === 'authenticated');

                                return (
                                    <div
                                        {...(!ready && {
                                            'aria-hidden': true,
                                            'style': {
                                                opacity: 0,
                                                pointerEvents: 'none',
                                                userSelect: 'none',
                                            },
                                        })}
                                    >
                                        {(() => {
                                            if (!connected) {
                                                return (
                                                    <button
                                                        onClick={openConnectModal}
                                                        type="button"
                                                        className="group transition-all active:scale-95"
                                                    >
                                                        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-all duration-300">
                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                width="28"
                                                                height="28"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="white"
                                                                strokeWidth="2.5"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            >
                                                                <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3.33" />
                                                                <path d="M3 12h18" />
                                                                <path d="M18 10v4" />
                                                            </svg>
                                                        </div>
                                                    </button>
                                                );
                                            }

                                            if (chain.unsupported) {
                                                return (
                                                    <button
                                                        onClick={() => switchChain({ chainId: baseSepolia.id })}
                                                        type="button"
                                                        className="px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
                                                    >
                                                        Switch to Base
                                                    </button>
                                                );
                                            }

                                            return (
                                                <div className="flex flex-col items-center gap-3">
                                                    {!siweSession ? (
                                                        <button
                                                            onClick={() => signIn(frameUser?.fid)}
                                                            disabled={isSigningIn}
                                                            type="button"
                                                            className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl text-white text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                                                        >
                                                            {isSigningIn ? (
                                                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                            ) : (
                                                                <ShieldCheck className="w-4 h-4" />
                                                            )}
                                                            {isSigningIn ? 'Verifying...' : 'Sign & Verify'}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={openAccountModal}
                                                            type="button"
                                                            className="px-6 py-3 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl text-indigo-400 text-xs font-bold uppercase tracking-widest hover:bg-indigo-600/20 transition-all"
                                                        >
                                                            {account.displayName}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            }}
                        </ConnectButton.Custom>
                    </div>

                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl relative z-10">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center leading-relaxed">
                            Connect your wallet to continue.<br />
                            Sanitized wallet & identity sync included.
                        </p>
                    </div>
                </div>

                <div className="mt-10 text-center text-[8px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed relative z-10">
                    Identity verification follows the Security Mandate.<br />
                    No Riba. No Interest. Honest Data Only.
                </div>
            </div>
        </div>
    );
}


