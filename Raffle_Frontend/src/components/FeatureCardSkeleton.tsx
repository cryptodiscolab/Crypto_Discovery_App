

export function FeatureCardSkeleton({ count = 6 }) {
    return (
        <>
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    style={{ animationDelay: `${index * 100}ms` }}
                    className="bg-[#161B22] border border-white/10 rounded-2xl p-6 shadow-xl h-full animate-fade-in opacity-0 fill-mode-forwards"
                >
                    {/* Icon skeleton */}
                    <div className="w-12 h-12 bg-slate-700/50 rounded-xl mb-4 animate-pulse" />

                    {/* Title skeleton */}
                    <div className="h-6 bg-slate-700/50 rounded-lg mb-2 w-3/4 animate-pulse" />

                    {/* Description skeleton */}
                    <div className="space-y-2 mb-4">
                        <div className="h-4 bg-slate-700/30 rounded w-full animate-pulse" />
                        <div className="h-4 bg-slate-700/30 rounded w-5/6 animate-pulse" />
                    </div>

                    {/* Link skeleton */}
                    <div className="h-4 bg-slate-700/40 rounded w-1/3 animate-pulse" />
                </div>
            ))}
        </>
    );
}
