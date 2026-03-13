import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAccount, useSwitchChain } from 'wagmi';
import { ShieldCheck, ExternalLink, Mail, Twitter, Wallet } from 'lucide-react';
import { baseSepolia } from 'wagmi/chains';
import { ConnectButton } from '@rainbow-me/rainbowkit';

import { useSIWE } from '../hooks/useSIWE';
import { useFarcaster } from '../shared/context/FarcasterContext';
import { useOAuth } from '../hooks/useOAuth';

/**
 * LoginPage — Wallet-First 3-Step Registration.
 *
 * Step 1: Connect Wallet (mandatory)
 * Step 2: Sign & Verify (SIWE — mandatory, creates user_profiles record)
 * Step 3: Link Social Identity (optional — Google & X OAuth for Sybil protection & pfp sync)
 *
 * Social OAuth (Google/X) CANNOT bypass wallet registration.
 * Wallet is always the primary identity anchor.
 */
export function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { switchChain } = useSwitchChain();
    const { frameUser } = useFarcaster();
    const { signIn, session: siweSession, isLoading: isSigningIn } = useSIWE();
    const { linkGoogle, linkX, isLinking, linkedGoogle, linkedX } = useOAuth();
    const from = location.state?.from?.pathname || '/';
    const { address, isConnected } = useAccount();
    const AUTH_KEY = 'crypto_disco_auth_status';

    // Auto-navigate when wallet connected AND SIWE done (social link is optional)
    useEffect(() => {
        if (isConnected && address && siweSession) {
            // Small delay so user can see the social link step if they want
            const timer = setTimeout(() => navigate(from, { replace: true }), 2500);
            return () => clearTimeout(timer);
        }
    }, [isConnected, address, siweSession, navigate, from]);

    // Re-entry Prevention: If already authenticated AND connected, skip login
    useEffect(() => {
        if (!isConnected) return;
        const authRaw = localStorage.getItem(AUTH_KEY);
        if (authRaw) {
            try {
                const auth = JSON.parse(authRaw);
                if (auth.status === 'AUTHENTICATED') navigate(from, { replace: true });
            } catch (e) {
                localStorage.removeItem(AUTH_KEY);
            }
        }
    }, [navigate, from, isConnected]);

    // Determine current step
    const step = !isConnected ? 1 : !siweSession ? 2 : 3;

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 bg-[#0B0E14]">
            <div className="relative z-50 pointer-events-auto w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-2xl overflow-hidden">
                {/* Background accent */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

                <h1 className="text-3xl font-black text-white mb-1 text-center uppercase italic tracking-tighter relative z-10">
                    Daily<span className="text-indigo-500">App</span>
                </h1>
                <p className="text-slate-500 text-center mb-6 text-[10px] font-bold uppercase tracking-[0.3em] relative z-10">
                    Initialize Protocol Session
                </p>

                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-2 mb-8 relative z-10">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all ${
                                step > s ? 'bg-green-500 text-white' :
                                step === s ? 'bg-indigo-500 text-white ring-2 ring-indigo-500/30' :
                                'bg-slate-800 text-slate-600'
                            }`}>
                                {step > s ? '✓' : s}
                            </div>
                            {s < 3 && <div className={`w-6 h-px ${step > s ? 'bg-green-500/50' : 'bg-slate-700'}`} />}
                        </div>
                    ))}
                </div>

                <div className="space-y-4 relative z-20">

                    {/* ── STEP 1: Connect Wallet ── */}
                    <div className={`transition-all ${step > 1 ? 'opacity-60' : ''}`}>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <Wallet className="w-3 h-3 text-indigo-400" />
                            Step 1 — Connect Wallet (Required)
                        </p>
                        <div className="w-full flex justify-center relative z-50 pointer-events-auto">
                            <ConnectButton.Custom>
                                {({ account, chain, openAccountModal, openConnectModal, authenticationStatus, mounted }) => {
                                    const ready = mounted && authenticationStatus !== 'loading';
                                    const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated');

                                    return (
                                        <div {...(!ready && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' } })}>
                                            {!connected ? (
                                                <button
                                                    onClick={openConnectModal}
                                                    type="button"
                                                    className="group transition-all active:scale-95"
                                                >
                                                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-all duration-300">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3.33" />
                                                            <path d="M3 12h18" />
                                                            <path d="M18 10v4" />
                                                        </svg>
                                                    </div>
                                                </button>
                                            ) : chain.unsupported ? (
                                                <button
                                                    onClick={() => switchChain({ chainId: baseSepolia.id })}
                                                    type="button"
                                                    className="px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
                                                >
                                                    Switch to Base
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={openAccountModal}
                                                    type="button"
                                                    className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-[10px] font-black uppercase tracking-widest"
                                                >
                                                    ✓ {account.displayName}
                                                </button>
                                            )}
                                        </div>
                                    );
                                }}
                            </ConnectButton.Custom>
                        </div>
                    </div>

                    {/* ── STEP 2: Sign & Verify (SIWE) ── */}
                    {isConnected && (
                        <div className={`transition-all ${step > 2 ? 'opacity-60' : ''}`}>
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <ShieldCheck className="w-3 h-3 text-indigo-400" />
                                Step 2 — Sign & Verify Identity (Required)
                            </p>
                            {!siweSession ? (
                                <button
                                    onClick={() => signIn(frameUser?.fid)}
                                    disabled={isSigningIn}
                                    type="button"
                                    className="w-full px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl text-white text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isSigningIn ? (
                                        <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Verifying...</>
                                    ) : (
                                        <><ShieldCheck className="w-4 h-4" /> Sign & Verify Wallet</>
                                    )}
                                </button>
                            ) : (
                                <div className="w-full px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 text-[10px] font-black uppercase tracking-widest text-center">
                                    ✓ Wallet Verified — Profile Created
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── STEP 3: Social Identity Link (Optional) ── */}
                    {siweSession && (
                        <div className="pt-2 border-t border-slate-800/60">
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <span className="text-indigo-400">○</span>
                                Step 3 — Link Social Identity (Optional)
                            </p>
                            <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest mb-3 leading-relaxed">
                                Link Google or X to enable pfp sync & Sybil protection.
                                Your wallet remains the primary identity — this step is optional.
                            </p>

                            {/* Google Link */}
                            <button
                                onClick={linkGoogle}
                                disabled={isLinking || !!linkedGoogle}
                                className={`w-full flex items-center justify-between px-4 py-3 mb-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                    linkedGoogle
                                        ? 'bg-green-500/10 border-green-500/20 text-green-400 cursor-default'
                                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20 active:scale-95'
                                } disabled:opacity-60`}
                            >
                                <div className="flex items-center gap-2">
                                    <Mail className="w-3.5 h-3.5" />
                                    {linkedGoogle ? `Google: ${linkedGoogle.email}` : 'Link Google Account'}
                                </div>
                                {linkedGoogle && (
                                    <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30 font-black">LINKED</span>
                                )}
                            </button>

                            {/* X (Twitter) Link */}
                            <button
                                onClick={linkX}
                                disabled={isLinking || !!linkedX}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                    linkedX
                                        ? 'bg-green-500/10 border-green-500/20 text-green-400 cursor-default'
                                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20 active:scale-95'
                                } disabled:opacity-60`}
                            >
                                <div className="flex items-center gap-2">
                                    <Twitter className="w-3.5 h-3.5" />
                                    {linkedX ? `X: @${linkedX.username}` : 'Link X (Twitter) Account'}
                                </div>
                                {linkedX && (
                                    <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30 font-black">LINKED</span>
                                )}
                            </button>

                            <p className="text-[8px] text-slate-600 text-center mt-3 font-bold uppercase tracking-widest animate-pulse">
                                Redirecting to app in a moment...
                            </p>
                        </div>
                    )}
                </div>

                {/* Farcaster CTA */}
                <div className="mt-8 pt-6 border-t border-slate-800/60 text-center relative z-10">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">
                        New to Farcaster?
                    </p>
                    <a
                        href="https://farcaster.xyz/~/code/CJ393F"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600/20 transition-all"
                    >
                        Get Account & Join the Gacha
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </div>

                <div className="mt-6 text-center text-[8px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed relative z-10">
                    Wallet is your primary identity. No Riba. Honest Data Only.
                </div>
            </div>
        </div>
    );
}
