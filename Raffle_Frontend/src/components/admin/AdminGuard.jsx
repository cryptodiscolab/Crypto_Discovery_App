import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';
import { useCMS } from '../../hooks/useCMS';

// ALLOWED_ADMINS Addresses
// 1. Master Admin (Lead Architect authority from .cursorrules)
// 2. Secondary Authorized Admin Wallet
const ALLOWED_ADMINS = [
    "0x08452c1bdAa6aCD11f6cCf5268d16e2AC29c204B".toLowerCase(), // MASTER_ADMIN
    "0x455DF75735d2a18c26f0AfDefa93217B60369fe5".toLowerCase()
];


/**
 * AdminGuard: BUILD-READY Security Gate.
 * Fixes: Relative pathing, strict address check, and AST efficiency.
 */
const AdminGuard = ({ children }) => {
    const { address, isConnected } = useAccount();
    const { isAdmin, isLoading } = useCMS();
    const navigate = useNavigate();
    const [isAuthorized, setIsAuthorized] = useState(null);

    useEffect(() => {
        if (isConnected === false) {
            setIsAuthorized(false);
            return;
        }

        if (isLoading) return; // Wait for CMS to load roles

        const currentAddr = address?.toLowerCase();
        // 1. Check Hardcoded Authority
        const isMaster = ALLOWED_ADMINS.includes(currentAddr);

        // 2. Check Centralized Roles (Blockchain + DB + Env)
        if (isMaster || isAdmin) {
            setIsAuthorized(true);
        } else {
            setIsAuthorized(false);
        }
    }, [address, isConnected, isAdmin, isLoading]);

    if (isAuthorized === null) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Lock className="w-12 h-12 text-indigo-500 animate-pulse" />
                <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">Validating Crypto Disco Admin Identity...</p>
            </div>
        );
    }

    if (isAuthorized === false) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
                <div className="bg-red-500/10 p-6 rounded-full border border-red-500/20 mb-8">
                    <ShieldAlert className="w-16 h-16 text-red-500" />
                </div>
                <h1 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Identity <span className="text-red-500">Rejected</span></h1>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed font-medium">
                    Critical Security Failure: Your connected wallet identity does not match the Lead Architect authority.
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="mt-8 flex items-center gap-2 bg-indigo-600 px-8 py-3 rounded-2xl text-white font-bold hover:bg-indigo-500 transition-all shadow-xl active:scale-95"
                >
                    <ArrowLeft className="w-4 h-4" /> Balik ke Home
                </button>
            </div>
        );
    }

    return <>{children}</>;
};

export default AdminGuard;
