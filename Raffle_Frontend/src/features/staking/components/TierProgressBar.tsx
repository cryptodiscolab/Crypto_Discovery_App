/**
 * TierProgressBar.tsx — XP progress toward next tier
 * Native+ Standard | CSS-only animation | Zero-Riba
 * v3.64.19-Hardened
 */

interface TierProgressBarProps {
  currentXP: number;
  requiredXP: number;
  tierName: string;
  nextTierName?: string;
}

export function TierProgressBar({
  currentXP,
  requiredXP,
  tierName,
  nextTierName,
}: TierProgressBarProps) {
  const pct = requiredXP > 0 ? Math.min((currentXP / requiredXP) * 100, 100) : 100;
  const remaining = Math.max(0, requiredXP - currentXP);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-[0.2em] leading-none text-slate-400">
          {nextTierName ? `${tierName} → ${nextTierName}` : `${tierName} — Max Tier`}
        </span>
        <span className="text-[12px] font-bold tracking-wide text-indigo-400">
          {currentXP.toLocaleString()} / {requiredXP.toLocaleString()} XP
        </span>
      </div>

      {/* Track */}
      <div className="relative h-2.5 bg-black/60 rounded-full border border-white/5 overflow-hidden">
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #6366f1, #a78bfa, #818cf8)',
            backgroundSize: '200% 100%',
            animation: 'progress-shimmer 2.4s linear infinite',
          }}
        />
        {/* Glow overlay */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, transparent 60%, rgba(167,139,250,0.4))',
          }}
        />
      </div>

      {/* Footer */}
      {remaining > 0 && nextTierName && (
        <p className="text-[11px] font-black uppercase tracking-[0.2em] leading-none text-slate-500">
          {remaining.toLocaleString()} XP to {nextTierName}
        </p>
      )}
      {pct >= 100 && (
        <p className="text-[11px] font-black uppercase tracking-[0.2em] leading-none text-emerald-400">
          ✓ XP requirement met
        </p>
      )}

      {/* CSS keyframe injected inline */}
      <style>{`
        @keyframes progress-shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </div>
  );
}
