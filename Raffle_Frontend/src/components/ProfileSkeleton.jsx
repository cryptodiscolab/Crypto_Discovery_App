import React from 'react';
import { ShieldCheck, Zap } from 'lucide-react';

export function ProfileSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header Skeleton */}
            <div className="bg-[#121720] border border-white/5 rounded-[2rem] p-6 relative overflow-hidden animate-pulse">
                <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                    <div className="w-24 h-24 rounded-2xl bg-white/5" />
                    <div className="flex-1 space-y-3 w-full">
                        <div className="h-8 w-48 bg-white/5 rounded-xl mx-auto md:mx-0" />
                        <div className="flex items-center justify-center md:justify-start gap-4">
                            <div className="h-4 w-16 bg-white/5 rounded" />
                            <div className="h-4 w-16 bg-white/5 rounded" />
                        </div>
                        <div className="h-6 w-32 bg-white/5 rounded-lg mx-auto md:mx-0" />
                    </div>
                </div>
            </div>

            {/* Reputation Audit Skeleton */}
            <div className="bg-[#121720] border border-white/5 rounded-[2rem] p-6 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-slate-700" />
                        <div className="h-3 w-32 bg-white/5 rounded" />
                    </div>
                    <div className="h-4 w-12 bg-white/5 rounded" />
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full" />
                <div className="mt-4 p-4 bg-black/20 rounded-2xl border border-white/5 flex items-start gap-3">
                    <div className="w-8 h-8 bg-white/5 rounded-xl" />
                    <div className="space-y-2 flex-1">
                        <div className="h-2 w-24 bg-white/5 rounded" />
                        <div className="h-2 w-full bg-white/5 rounded" />
                    </div>
                </div>
            </div>
        </div>
    );
}
