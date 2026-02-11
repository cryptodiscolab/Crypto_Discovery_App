import { useState, useEffect } from 'react';
import { X, Info, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

export function AnnouncementBanner({ announcement }) {
    const [isDismissed, setIsDismissed] = useState(false);

    // Check if user has dismissed this announcement before
    useEffect(() => {
        const dismissedKey = `announcement_dismissed_${announcement?.title}`;
        const wasDismissed = localStorage.getItem(dismissedKey) === 'true';
        setIsDismissed(wasDismissed);
    }, [announcement?.title]);

    const handleDismiss = () => {
        const dismissedKey = `announcement_dismissed_${announcement?.title}`;
        localStorage.setItem(dismissedKey, 'true');
        setIsDismissed(true);
    };

    // Don't render if not visible or dismissed
    if (!announcement?.visible || isDismissed) {
        return null;
    }

    // Type-based styling
    const typeConfig = {
        info: {
            bg: 'from-blue-500/10 to-indigo-500/10',
            border: 'border-blue-500/30',
            text: 'text-blue-400',
            icon: Info,
        },
        warning: {
            bg: 'from-yellow-500/10 to-orange-500/10',
            border: 'border-yellow-500/30',
            text: 'text-yellow-400',
            icon: AlertTriangle,
        },
        success: {
            bg: 'from-green-500/10 to-emerald-500/10',
            border: 'border-green-500/30',
            text: 'text-green-400',
            icon: CheckCircle,
        },
        error: {
            bg: 'from-red-500/10 to-pink-500/10',
            border: 'border-red-500/30',
            text: 'text-red-400',
            icon: AlertCircle,
        },
    };

    const config = typeConfig[announcement.type] || typeConfig.info;
    const Icon = config.icon;

    return (
        <div
            className={`max-w-4xl mx-auto mb-8 animate-slide-up`}
        >
            <div className={`glass-card p-6 bg-gradient-to-r ${config.bg} border-l-4 ${config.border} relative overflow-hidden`}>
                {/* Background decoration */}
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Icon className="w-32 h-32" />
                </div>

                <div className="relative z-10 flex items-start gap-4">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg bg-white/5 ${config.text}`}>
                        <Icon className="w-6 h-6" />
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        <h3 className={`text-lg font-bold ${config.text} mb-1`}>
                            {String(announcement.title || '')}
                        </h3>
                        <p className="text-slate-300 text-sm">
                            {String(announcement.message || '')}
                        </p>
                    </div>

                    {/* Dismiss button */}
                    <button
                        onClick={handleDismiss}
                        className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
