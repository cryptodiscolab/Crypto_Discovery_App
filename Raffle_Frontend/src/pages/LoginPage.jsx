
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

    const from = location.state?.from?.pathname || "/";

    useEffect(() => {
        if (isAuthenticated) {
            navigate(from, { replace: true });
        }
    }, [isAuthenticated, navigate, from]);

    const handleLogin = async () => {
        try {
            await signIn();
        } catch (e) {
            // Error handled in hook
        }
    };

    const handleConnect = (connector) => {
        connect({ connector });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h1 className="text-2xl font-bold text-white mb-2 text-center">Welcome Back</h1>
                <p className="text-slate-400 text-center mb-6">Sign in to access your account</p>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 rounded text-red-200 text-sm text-center">
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
                                        className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors border border-slate-700 active:scale-95 duration-75"
                                    >
                                        Connect {connector.name}
                                    </button>
                                )
                            ))}
                        </div>
                    ) : (
                        <div className="text-center">
                            <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
                                <p className="text-sm text-slate-400 mb-1">Connected Wallet</p>
                                <div className="font-mono text-slate-200 truncate px-4">
                                    {address}
                                </div>
                            </div>

                            <button
                                onClick={handleLogin}
                                disabled={isLoading}
                                className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all transform active:scale-95 duration-75
                  ${isLoading
                                        ? 'bg-slate-700 cursor-wait opacity-80'
                                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-sm'
                                    }`}
                            >
                                {isLoading ? 'Signing...' : 'Sign In with Ethereum'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-6 text-center text-xs text-slate-500">
                    By connecting, you agree to our Terms of Service and Privacy Policy.
                </div>
            </div>
        </div>
    );
}
