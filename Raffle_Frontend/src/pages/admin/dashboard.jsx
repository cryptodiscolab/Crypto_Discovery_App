import React, { Suspense, lazy } from 'react';
import { ShieldCheck, Database, RefreshCw } from 'lucide-react';

// Specialized Performance: Lazy load with absolute minimal fallback
const UserReputationTable = lazy(() => import('../../components/admin/UserReputationTable'));

/**
 * AdminDashboard: MOBILE WebView Optimized.
 * Fixes: No blur, No shadows, No tables.
 */
const AdminDashboard = () => {
    return (
        <div className="max-w-xl mx-auto px-4 py-4 space-y-6 bg-[#0B0E14] min-h-screen" style={{ transform: 'translateZ(0)' }}>

            {/* Minimalist Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-900 border border-white/5 rounded-lg">
                        <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-white uppercase tracking-tighter italic">
                            Admin <span className="text-indigo-500">Rep</span>
                        </h1>
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none">
                            Mobile Node Optimized
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 bg-black px-3 py-1.5 rounded-full border border-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[8px] font-black text-white uppercase italic">Active</span>
                </div>
            </div>

            {/* Hardware Accelerated Content Area */}
            <Suspense fallback={
                <div className="py-20 text-center flex flex-col items-center gap-3">
                    <RefreshCw className="w-6 h-6 text-slate-700 animate-spin" />
                    <p className="text-[8px] font-black text-slate-700 uppercase">Booting Module...</p>
                </div>
            }>
                <UserReputationTable />
            </Suspense>

            {/* Disclosure: Zero-padding/Zero-blur */}
            <div className="p-3 bg-slate-900/50 rounded-xl border-t border-white/5">
                <p className="text-[8px] text-slate-600 leading-tight font-black uppercase tracking-tighter">
                    Restricted: 0x0845...204B. Internal reputation data is confidential.
                </p>
            </div>
        </div>
    );
};

export default AdminDashboard;
