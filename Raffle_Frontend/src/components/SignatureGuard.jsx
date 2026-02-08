import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { ShieldCheck, Lock, ArrowRight, AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * SignatureGuard: Senior Security Layer.
 * Enforces mandatory signature approval for all users.
 * Optimized for Mobile (Base App) with zero blurs and flat design.
 */
export const SignatureGuard = ({ children }) => {
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { disconnect } = useDisconnect();

    const [isApproved, setIsApproved] = useState(false);
    const [isSigning, setIsSigning] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const STORAGE_KEY = `disco_auth_${address?.toLowerCase()}`;

    // 1. Initial Identity Check
    useEffect(() => {
        if (isConnected && address) {
            const approved = localStorage.getItem(STORAGE_KEY) === 'true';
            setIsApproved(approved);
            if (!approved) {
                setShowModal(true);
            }
        } else {
            setIsApproved(false);
            setShowModal(false);
        }
    }, [isConnected, address, STORAGE_KEY]);

    // 2. High-Performance Signature Logic
    const handleSignApproval = useCallback(async () => {
        if (isSigning) return;

        const timestamp = new Date().toISOString();
        const message = `Crypto Disco\n\nLogin and verify identity for revenue sharing and anti-sybil protection.\n\nTimestamp: ${timestamp}`;

        setIsSigning(true);
        try {
            await signMessageAsync({ message });

            localStorage.setItem(STORAGE_KEY, 'true');
            setIsApproved(true);
            setShowModal(false);
            toast.success("Identity Verified", { icon: '🛡️' });
        } catch (err) {
            console.error('[Security Node] Signature Rejected:', err.message);
            toast.error("Signature required to enter.", { icon: '⚠️' });
        } finally {
            setIsSigning(false);
        }
    }, [signMessageAsync, STORAGE_KEY, isSigning]);

    const handleReject = () => {
        disconnect();
        setShowModal(false);
        toast.error("Access Restricted: Approval Required");
    };

    // If disconnected, just show children (HomePage will handle its own empty state)
    if (!isConnected) return children;

    // If connected and approved, show app
    if (isApproved) return children;

    // If connected but NOT approved, lock UI with high-focus modal
    return (
        <>
            {/* The rest of the app is hidden or blurred/faded during sign request */}
            <div className="fixed inset-0 z-[9999] bg-[#0a0a0c] flex items-center justify-center px-4 overflow-hidden">
                <div
                    className="w-full max-w-sm bg-[#121720] border border-white/5 rounded-[2.5rem] p-8 relative overflow-hidden"
                    style={{ transform: 'translateZ(0)' }}
                >
                    {/* Security Decor */}
                    <div className="absolute -top-10 -right-10 opacity-[0.03] pointer-events-none">
                        <ShieldCheck className="w-48 h-48 text-indigo-500" />
                    </div>

                    <div className="text-center relative z-10">
                        <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/20">
                            <Lock className="w-10 h-10 text-indigo-500" />
                        </div>

                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2 italic">
                            Login <span className="text-indigo-500">Required</span>
                        </h2>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-8 leading-relaxed">
                            Complete the signature request to verify your node identity.
                        </p>

                        <div className="space-y-4 mb-8 text-left bg-black/30 p-4 rounded-2xl border border-white/5">
                            <div className="flex gap-3">
                                <div className="p-1.5 h-fit bg-indigo-500/10 rounded-lg">
                                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                                </div>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                                    Anti-Sybil Verification Active
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <div className="p-1.5 h-fit bg-indigo-500/10 rounded-lg">
                                    <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                                </div>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                                    Enables Revenue Sharing Eligibility
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                disabled={isSigning}
                                onClick={handleSignApproval}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2"
                            >
                                {isSigning ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Confirming...
                                    </>
                                ) : (
                                    <>
                                        Sign Approval
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleReject}
                                className="w-full py-4 text-slate-700 hover:text-red-500 font-black text-[9px] uppercase tracking-widest transition-colors"
                            >
                                Cancel & Disconnect
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 opacity-30 flex items-center justify-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-yellow-500" />
                        <span className="text-[8px] font-black text-white uppercase tracking-tighter">This is a gasless off-chain signature</span>
                    </div>
                </div>
            </div>

            {/* Background blur/shadow for the rest of the app */}
            <div className="fixed inset-0 z-[9998] bg-black/60 pointer-events-none" />
        </>
    );
};
