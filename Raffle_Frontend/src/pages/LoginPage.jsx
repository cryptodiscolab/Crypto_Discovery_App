import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NeynarAuthBridge } from '../components/NeynarAuthBridge';

/**
 * Mobile-Optimized Login via Neynar (SIWN).
 * Adheres to Anti-Riba principle and hardware performance mandates.
 */
export function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname || "/";
    const AUTH_KEY = 'crypto_disco_auth_status';

    // Re-entry Prevention: If already authenticated, skip login
    useEffect(() => {
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
    }, [navigate, from]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 bg-[#0B0E14]">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
                {/* Background ID accent */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

                <h1 className="text-3xl font-black text-white mb-2 text-center uppercase italic tracking-tighter relative z-10">
                    Daily<span className="text-indigo-500">App</span>
                </h1>
                <p className="text-slate-500 text-center mb-10 text-[10px] font-bold uppercase tracking-[0.3em] relative z-10">
                    Initialize Protocol Session
                </p>

                <div className="space-y-6 relative z-10">
                    <NeynarAuthBridge onSuccess={() => navigate(from, { replace: true })} />

                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center leading-relaxed">
                            Sign-in with Farcaster is gasless.<br />
                            Sanitized wallet & identity sync included.
                        </p>
                    </div>
                </div>

                <div className="mt-10 text-center text-[8px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed">
                    Identity verification follows the Security Mandate.<br />
                    No Riba. No Interest. Honest Data Only.
                </div>
            </div>
        </div>
    );
}

