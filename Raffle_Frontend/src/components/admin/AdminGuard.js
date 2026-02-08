import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';

const MASTER_ADMIN = "0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B".toLowerCase();

/**
 * AdminGuard: Security Gate for Lead Admin.
 * Prevents Supabase data loading until address is verified.
 */
export default function AdminGuard({ children }) {
    const { address, isConnected } = useAccount();
    const navigate = useNavigate();
    const [isAuthorized, setIsAuthorized] = useState(null);

    useEffect(() => {
        if (!isConnected) {
            setIsAuthorized(false);
            return;
        }

        const currentAddr = address?.toLowerCase();
        if (currentAddr === MASTER_ADMIN) {
            setIsAuthorized(true);
        } else {
            setIsAuthorized(false);
        }
    }, [address, isConnected]);

    if (isAuthorized === null) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Lock className="w-12 h-12 text-indigo-500 animate-pulse" />
                <p className="text-slate-400 font-mono text-sm">Validating Identity...</p>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
                <div className="bg-red-500/10 p-6 rounded-full border border-red-500/20 mb-8">
                    <ShieldAlert className="w-20 h-20 text-red-500" />
                </div>
                <h1 className="text-4xl font-black text-white mb-4">ACCESS <span className="text-red-500">DENIED</span></h1>
                <p className="text-lg text-slate-400 max-w-lg mx-auto leading-relaxed">
                    Unauthorized identity detected. Access restricted to Master Admin.
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="mt-8 flex items-center gap-2 bg-indigo-600 px-8 py-3 rounded-2xl text-white font-bold hover:bg-indigo-500 transition-all shadow-lg"
                >
                    <ArrowLeft className="w-4 h-4" /> Return Home
                </button>
            </div>
        );
    }

    return <>{children}</>;
}
