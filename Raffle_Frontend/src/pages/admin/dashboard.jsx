import React, { Suspense, lazy } from 'react';
import { ShieldCheck, Database, RefreshCw } from 'lucide-react';

/**
 * Performance Strategy:
 * 1. Flat UI: No blurs/translucency in #0a0a0c.
 * 2. GPU Trigger: will-change + translateZ(0).
 * 3. Lazy: Avoid mounting heavy logic during boot.
 */
const UserReputationTable = lazy(() => import('../../components/admin/UserReputationTable'));

const AdminDashboard = () => {
    return (
        <div
            className="max-w-xl mx-auto px-4 py-4 min-h-screen bg-[#0a0a0c]"
            style={{
                willChange: 'transform',
                transform: 'translateZ(0)',
                WebkitOverflowScrolling: 'touch'
            }}
        >
            {/* Flat Header - High Contrast / Zero Blur */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[#121214] border border-white/5 rounded-xl">
                        <ShieldCheck className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="leading-tight">
                        <h1 className="text-lg font-black text-white uppercase tracking-tighter italic">
                            Admin <span className="text-indigo-500">Rep</span>
                        </h1>
                        <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest">
                            Extreme Mobile Node v3.0
                        </p>
                    </div>
                </div>

                <div className="bg-[#121214] px-3 py-1.5 rounded-full border border-white/5 flex items-center gap-2">
                    <Database className="w-3 h-3 text-indigo-600" />
                    <span className="text-[8px] font-black text-white uppercase tracking-tighter">Auth: Active</span>
                </div>
            </div>

            {/* Suspense Boundary with Minimalist Placeholder */}
            <Suspense fallback={
                <div className="py-20 flex flex-col items-center gap-4">
                    <RefreshCw className="w-6 h-6 text-slate-800 animate-spin" />
                    <p className="text-[8px] font-black text-slate-800 uppercase tracking-widest">Waking Rep Node...</p>
                </div>
            }>
                <UserReputationTable />
            </Suspense>

            {/* Flat Disclosure */}
            <div className="mt-8 pt-6 border-t border-white/5">
                <div className="flex items-start gap-4 opacity-30">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1 flex-shrink-0" />
                    <p className="text-[8px] text-white leading-relaxed font-black uppercase tracking-tighter">
                        Restricted Protocol: 0x0845...204B. All telemetry data is confidential.
                        Built for high-efficiency mobile WebViews.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
