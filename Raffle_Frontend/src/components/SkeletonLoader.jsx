import React from 'react';

export const SkeletonLoader = () => {
    return (
        <div className="w-full max-w-md mx-auto p-4 space-y-4 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-slate-800 rounded-full"></div>
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-800 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-800 rounded w-1/2"></div>
                </div>
            </div>

            {/* Stats Grid Skeleton */}
            <div className="grid grid-cols-2 gap-4">
                <div className="h-24 bg-slate-800 rounded-xl"></div>
                <div className="h-24 bg-slate-800 rounded-xl"></div>
            </div>

            {/* List Items Skeleton */}
            <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 bg-slate-800 rounded-lg w-full"></div>
                ))}
            </div>
        </div>
    );
};
