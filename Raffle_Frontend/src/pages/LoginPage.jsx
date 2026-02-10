import React, { useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { useSIWE } from '../hooks/useSIWE';
import { useNavigate, useLocation } from 'react-router-dom';

export function LoginPage() {
    const { isConnected, address } = useAccount();
    const { connect, connectors } = useConnect();
    const { signIn, isAuthenticated, isLoading, error } = useSIWE();
    const navigate = useNavigate();
    const location = useLocation();

    const AUTH_KEY = 'crypto_disco_auth_status';
    const from = location.state?.from?.pathname || "/";

    // Re-entry Prevention: If already authenticated, skip login
    useEffect(() => {
        const isAuth = localStorage.getItem(AUTH_KEY) === 'authenticated' && isConnected;
        if (isAuth || isAuthenticated) {
            navigate(from, { replace: true });
        }
    }, [isConnected, isAuthenticated, navigate, from]);

    const handleLogin = async () => {
        try {
            const session = await signIn();
            if (session) {
                // Atomic Update: Set authenticated status
                localStorage.setItem(AUTH_KEY, 'authenticated');
                navigate(from, { replace: true });
            }
        } catch (e) {
            // Error handled in hook / error state
        }
    };

    const handleConnect = (connector) => {
        connect({ connector });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
                <h1 className="text-2xl font-black text-white mb-2 text-center uppercase italic tracking-tighter">
                    Welcome <span className="text-indigo-500">Node</span>
                </h1>
                <p className="text-slate-500 text-center mb-8 text-[10px] font-bold uppercase tracking-[0.2em]">
                    Initialize identity to access the network
                </p>

                {error && (
                    <div className="mb-6 p-4 bg-red-900/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-bold uppercase text-center tracking-widest leading-relaxed">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    {!isConnected ? (
                        <div className="grid gap-3">
                            {connectors.map((connector) => (
                                connector.ready && (
                                    <button
                                        key={connector.id}
                                        onClick={() => handleConnect(connector)}
                                        className="w-full py-4 px-6 bg-slate-800/50 hover:bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/5 active:scale-95 duration-75"
                                    >
                                        Connect {connector.name}
                                    </button>
                                )
                            ))}
                        </div>
                    ) : (
                        <div className="text-center">
                            <div className="mb-6 p-5 bg-black/40 rounded-2xl border border-white/5">
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-2">Connected Identity</p>
                                <div className="font-mono text-indigo-400 truncate px-2 text-xs">
                                    {address}
                                </div>
                            </div>

                            <button
                                onClick={handleLogin}
                                disabled={isLoading}
                                className={`w-full py-5 px-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all transform active:scale-95 duration-75 text-white shadow-xl
                  ${isLoading
                                        ? 'bg-slate-800 cursor-wait opacity-80'
                                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                                    }`}
                            >
                                {isLoading ? 'Verifying...' : 'Initialize Session'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-8 text-center text-[8px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed">
                    Identity verification is off-chain and gasless.<br />By connecting, you agree to the protocol rules.
                </div>
            </div>
        </div>
    );
}
