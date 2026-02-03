import { useState, useEffect } from 'react';
import { usePoints } from '../shared/context/PointsContext';

export function ClaimTimer({ deadline, totalDuration = 8 * 60 * 60 * 1000 }) {
    const { formatTimeLeft } = usePoints();
    const [timeLeft, setTimeLeft] = useState(deadline - Date.now());

    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            const left = deadline - now;
            setTimeLeft(left);
            if (left <= 0) clearInterval(timer);
        }, 1000); // Update every second for smooth UI
        return () => clearInterval(timer);
    }, [deadline]);

    // Calculate progress percentage (0 to 100)
    // If just created: left = totalDuration -> 100%
    // If expired: left = 0 -> 0%
    const progress = Math.max(0, Math.min(100, (timeLeft / totalDuration) * 100));

    // Determine color based on time left
    // Green > 50%, Yellow > 20%, Red < 20%
    let colorClass = "bg-green-500";
    if (progress < 20) colorClass = "bg-red-500";
    else if (progress < 50) colorClass = "bg-yellow-500";

    if (timeLeft <= 0) {
        return <div className="text-red-500 font-bold text-sm">EXPIRED</div>;
    }

    return (
        <div className="w-full max-w-[200px]">
            <div className="flex justify-between items-end mb-1">
                <span className="text-xs text-slate-400">Claims expire in:</span>
                <span className="text-sm font-mono font-bold text-white tracking-widest">
                    {formatTimeLeft(timeLeft)}
                </span>
            </div>

            {/* Lightweight Progress Bar */}
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden relative">
                <div
                    className={`h-full transition-all duration-1000 ease-linear ${colorClass}`}
                    style={{
                        width: `${progress}%`,
                        // Add subtle gradient for "wow" factor without heaviness
                        backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)',
                        backgroundSize: '1rem 1rem'
                    }}
                ></div>
            </div>
        </div>
    );
}
