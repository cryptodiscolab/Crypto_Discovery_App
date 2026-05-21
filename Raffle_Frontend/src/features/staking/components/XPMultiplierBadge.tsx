/**
 * XPMultiplierBadge.tsx — Active XP multiplier visual badge
 * Midnight Cyber | CSS-only glow animation | Zero-Riba
 * v3.64.19-Hardened
 */

import React from 'react';

interface XPMultiplierBadgeProps {
  multiplierDisplay: string; // e.g. "+10%"
  bonusBP: number;           // raw bonus basis points above 10000
  tierName: string;
  isActive: boolean;
}

export function XPMultiplierBadge({
  multiplierDisplay,
  bonusBP,
  tierName,
  isActive,
}: XPMultiplierBadgeProps) {
  if (!isActive || bonusBP === 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/3 border border-white/8">
        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-lg">
          ⚡
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] leading-none text-slate-500">
            XP Multiplier
          </p>
          <p className="text-[13px] font-medium leading-relaxed text-slate-400 mt-0.5">
            Mint a tier NFT to activate
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="relative flex items-center gap-3 p-4 rounded-2xl border overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(167,139,250,0.06))',
          borderColor: 'rgba(99,102,241,0.4)',
          animation: 'multiplier-glow 2.5s ease-in-out infinite',
        }}
      >
        {/* Ambient glow */}
        <div
          className="absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl pointer-events-none"
          style={{ background: 'rgba(99,102,241,0.25)' }}
        />

        {/* Icon */}
        <div
          className="relative w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(167,139,250,0.2))',
            border: '1px solid rgba(99,102,241,0.5)',
          }}
        >
          ⚡
        </div>

        {/* Text */}
        <div className="relative">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] leading-none text-indigo-300">
            Active Multiplier — {tierName}
          </p>
          <p
            className="text-[22px] font-black leading-tight tracking-tight mt-0.5"
            style={{ color: '#a78bfa' }}
          >
            {multiplierDisplay} XP BOOST
          </p>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] leading-none text-slate-400 mt-1">
            Applied to all earning activities
          </p>
        </div>
      </div>

      <style>{`
        @keyframes multiplier-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.35), 0 0 20px rgba(99,102,241,0.1); }
          50%       { box-shadow: 0 0 0 6px rgba(99,102,241,0), 0 0 32px rgba(99,102,241,0.2); }
        }
      `}</style>
    </>
  );
}
