import { useCallback, useEffect, useState } from 'react';
import { Shield, Sparkles, AlertTriangle, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { useAccount, usePublicClient } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { BUNDLE_ROUTES, USER_BUNDLE_ACTIONS } from '../lib/apiRoutes';
import { formatEther } from 'viem';
import { useNFTTiers } from '../hooks/useNFTTiers';

const PINATA_GATEWAY = (import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs').trim();

const normalizePinataGateway = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed || 'https://gateway.pinata.cloud/ipfs';
};

const resolvePinataAssetUrl = (value?: string | null): string | undefined => {
  const raw = String(value || '').trim();
  if (!raw) return undefined;

  const pinataGateway = normalizePinataGateway(PINATA_GATEWAY);

  if (raw.startsWith('ipfs://')) {
    const cid = raw.replace('ipfs://', '').replace(/^ipfs\//, '');
    return `${pinataGateway}/${cid}`;
  }

  if (/^https?:\/\/[^/]*pinata\.[^/]+\/ipfs\//i.test(raw)) {
    return raw;
  }

  const ipfsMatch = raw.match(/^https?:\/\/[^/]+\/ipfs\/(.+)$/i);
  if (ipfsMatch?.[1]) {
    return `${pinataGateway}/${ipfsMatch[1]}`;
  }

  return raw;
};

// Tier config fetched dynamically from sbt_thresholds (Zero-Hardcode Mandate)
interface SBTThreshold {
  level: number;
  tier_name: string;
  min_xp: number;
  badge_url: string | null;
  level_name: string | null;
}

const TIER_ICONS: Record<string, string> = {
  DIAMOND: '💎',
  PLATINUM: '🔷',
  GOLD: '🥇',
  SILVER: '🥈',
  BRONZE: '🥉',
  ROOKIE: '🟢',
};

const TIER_DESCS: Record<string, string> = {
  DIAMOND: 'Top 1% — maximum revenue share, exclusive rewards',
  PLATINUM: 'Top 5% — premium revenue share, priority access',
  GOLD: 'Top 15% — enhanced revenue share, early access',
  SILVER: 'Top 35% — moderate revenue share, bonus rewards',
  BRONZE: 'Top 55% — entry-level revenue share',
  ROOKIE: 'Starting tier — earn XP to upgrade',
};

interface UserProgress {
  totalXP: number;
  currentTier: string;
  nextTier: string | null;
  xpToNextTier: number | null;
  nextTierMinXP: number | null;
  canMint: boolean;
}

const TIER_COLORS: Record<string, string> = {
  DIAMOND: 'from-blue-500/20 to-purple-500/20 border-blue-500/30 text-blue-400',
  PLATINUM: 'from-slate-400/20 to-slate-500/20 border-slate-400/30 text-slate-300',
  GOLD: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-400',
  SILVER: 'from-gray-400/20 to-gray-500/20 border-gray-400/30 text-gray-300',
  BRONZE: 'from-amber-700/20 to-orange-700/20 border-amber-700/30 text-amber-500',
  ROOKIE: 'from-slate-800/30 to-slate-900/30 border-slate-700/30 text-slate-400',
};

export function SBTMintPage() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const [thresholds, setThresholds] = useState<SBTThreshold[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { tiers: nftTiers, mintTier, refetch: refetchTiers } = useNFTTiers();

  // Fetch tier thresholds from Supabase (Zero-Hardcode: all XP values from DB)
  const fetchThresholds = useCallback(async (): Promise<SBTThreshold[]> => {
    const { data, error: tErr } = await supabase
      .from('sbt_thresholds')
      .select('level, tier_name, min_xp, badge_url, level_name')
      .order('level', { ascending: true });
    if (tErr) throw tErr;
    return (data || []) as SBTThreshold[];
  }, []);

  const fetchProgress = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const [profileResult, tiers] = await Promise.all([
        supabase
          .from('v_user_full_profile')
          .select('total_xp, rank_name')
          .eq('wallet_address', address.toLowerCase())
          .maybeSingle(),
        fetchThresholds(),
      ]);

      if (profileResult.error && profileResult.error.code !== 'PGRST116') {
        throw profileResult.error;
      }

      setThresholds(tiers);

      const totalXP = Number(profileResult.data?.total_xp || 0);
      const currentTier = String(profileResult.data?.rank_name || 'ROOKIE').toUpperCase();

      // Determine next tier from live DB thresholds (Sequential Upgrade Only — BP-007)
      const sorted = [...tiers].sort((a, b) => a.level - b.level);
      const currentIdx = sorted.findIndex((t) => t.tier_name?.toUpperCase() === currentTier);
      const nextThreshold = currentIdx >= 0 && currentIdx < sorted.length - 1 ? sorted[currentIdx + 1] : null;
      const xpToNextTier = nextThreshold ? Math.max(0, nextThreshold.min_xp - totalXP) : null;

      setProgress({
        totalXP,
        currentTier,
        nextTier: nextThreshold?.tier_name?.toUpperCase() || null,
        xpToNextTier,
        nextTierMinXP: nextThreshold?.min_xp ?? null,
        // canMint: user has a next tier AND has enough XP for it
        canMint: !!nextThreshold && totalXP >= nextThreshold.min_xp,
      });
    } catch (err) {
      console.warn('[SBTMint] Failed to fetch progress:', err);
      setError('Failed to load tier progress');
    } finally {
      setLoading(false);
    }
  }, [address, fetchThresholds]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const publicClient = usePublicClient();

  const handleMint = async () => {
    if (!address || !progress?.canMint || !progress.nextTier) return;
    setMinting(true);
    try {
      const cleanWallet = address.toLowerCase();

      // FIX: Look up NEXT tier level (not current) — backend validates sequential upgrade
      const nextTierLevel = thresholds.find(
        (t) => t.tier_name?.toUpperCase() === progress.nextTier
      )?.level;
      if (!nextTierLevel) throw new Error('Cannot determine next tier level');

      const targetTier = nftTiers.find((tier) => tier.id === nextTierLevel);
      if (!targetTier) throw new Error('Next tier config is not loaded from DailyApp V16');
      if (targetTier.isOpen === false) throw new Error(`${progress.nextTier} minting is currently closed`);
      const mintPrice = targetTier.mintPrice || 0n;
      toast.loading('Sending mint transaction…', { id: 'sbt-mint' });
      const txHash = await mintTier(nextTierLevel, mintPrice);

      toast.loading('Waiting for confirmation…', { id: 'sbt-mint' });
      if (!publicClient) throw new Error('Wallet RPC client is not ready');
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain');

      toast.success(
        `✅ ${progress.nextTier} SBT minted on-chain!`,
        { id: 'sbt-mint' }
      );

      const syncRes = await fetch(BUNDLE_ROUTES.USER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: USER_BUNDLE_ACTIONS.SYNC_SBT_UPGRADE,
          wallet: cleanWallet,
          payload: {
            tierName: progress.nextTier,
            ethSpent: formatEther(mintPrice),
            txHash,
          },
        }),
      });

      if (!syncRes.ok) {
        const syncBody = await syncRes.json().catch(() => ({}));
        const syncMessage = (syncBody as Record<string, string>)?.message || (syncBody as Record<string, string>)?.error || 'Backend SBT sync delayed';
        toast.error(syncMessage, { id: 'sbt-mint-sync' });
      } else {
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: ['profile', address] }),
          queryClient.invalidateQueries({ queryKey: ['activity-logs', address] }),
        ]);
      }

      // Refresh progress after successful mint
      fetchProgress();
      refetchTiers();
    } catch (err) {
      console.error('[SBTMint] Mint failed:', err);
      toast.error(err instanceof Error ? err.message : 'Mint failed', { id: 'sbt-mint' });
    } finally {
      setMinting(false);
    }
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="w-full max-w-[100vw] overflow-x-hidden pb-safe md:pb-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 px-4">
          <Shield size={64} className="mx-auto text-slate-700" />
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Connect wallet to mint SBT</p>
        </div>
      </div>
    );
  }

  const currentTierColor = TIER_COLORS[progress?.currentTier || 'ROOKIE'] || TIER_COLORS.ROOKIE;

  // Sort thresholds descending for display (Diamond first)
  const displayTiers = [...thresholds].sort((a, b) => b.level - a.level);

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden pb-safe md:pb-8">
      <div className="max-w-screen-lg mx-auto">
        {/* Midnight Cyber Header */}
        <div className="card-title-row mb-6">
          <h2 className="text-xl text-white" style={{ fontFamily: 'var(--typography-family-heading)' }}>Soulbound Identity Card</h2>
          <span className="badge-cyber badge-cyber-blue">Sequential Upgrade Only</span>
        </div>

        <div className="px-4">

        {loading ? (
          <div className="min-h-[40vh] flex items-center justify-center">
            <Loader2 className="animate-spin text-slate-600" size={32} />
          </div>
        ) : error ? (
          <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4">
            <AlertTriangle size={48} className="text-red-500/50" />
            <p className="label-native text-red-400 mb-0">{error}</p>
            <button onClick={fetchProgress} className="btn-cyber-native-action px-6 py-3 rounded-full">
              Retry
            </button>
          </div>
        ) : progress ? (
          <div className="space-y-6">
            {/* Current Tier Card */}
            <div className={`rounded-2xl border bg-gradient-to-br ${currentTierColor} p-6`}>
              <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
                <div className="aspect-square w-full max-w-[180px] overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-2xl">
                  {resolvePinataAssetUrl(
                    thresholds.find((tier) => tier.tier_name?.toUpperCase() === progress.currentTier)?.badge_url
                  ) ? (
                    <img
                      src={resolvePinataAssetUrl(
                        thresholds.find((tier) => tier.tier_name?.toUpperCase() === progress.currentTier)?.badge_url
                      )}
                      alt={`${progress.currentTier} SBT`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl">
                      {TIER_ICONS[progress.currentTier] || '🟢'}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="label-native mb-0 opacity-70">Current Tier</span>
                    <span className="label-native mb-0 text-lg">{TIER_ICONS[progress.currentTier] || '🟢'}</span>
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-widest mb-1">{progress.currentTier}</h2>
                  <p className="content-native mb-4">
                    {TIER_DESCS[progress.currentTier] || 'Earn XP to unlock rewards'}
                  </p>
                  <div className="space-y-2">
                <div className="flex justify-between label-native mb-0">
                  <span>Total XP</span>
                  <span className="value-native">{progress.totalXP.toLocaleString()}</span>
                </div>
                {progress.nextTier && progress.xpToNextTier !== null && progress.nextTierMinXP !== null && (
                  <div className="space-y-1">
                    <div className="flex justify-between label-native mb-0 text-slate-500">
                      <span>Next: {progress.nextTier}</span>
                      <span>{progress.xpToNextTier.toLocaleString()} XP needed</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-yellow-500/50 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, ((progress.totalXP / progress.nextTierMinXP) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tier Ladder — dynamic from DB */}
            <div className="space-y-2">
              <h3 className="label-native text-slate-400 mb-3">
                Tier Requirements
                {thresholds.length === 0 && (
                  <span className="text-slate-600 ml-2">(Loading…)</span>
                )}
              </h3>
              {displayTiers.map((tier) => {
                const key = (tier.tier_name || '').toUpperCase();
                const isCurrent = key === progress.currentTier;
                const isUnlocked = tier.min_xp <= progress.totalXP;
                return (
                  <div
                    key={tier.level}
                    className={`rounded-xl border p-4 flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'bg-white/5 border-white/20'
                        : isUnlocked
                        ? 'bg-white/[0.02] border-white/5'
                        : 'bg-white/[0.01] border-white/[0.03] opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-black/30 shrink-0">
                        {resolvePinataAssetUrl(tier.badge_url) ? (
                          <img
                            src={resolvePinataAssetUrl(tier.badge_url)}
                            alt={`${key} SBT`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg">
                            {TIER_ICONS[key] || '🟢'}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="label-native text-white mb-0">{key}</p>
                        <p className="label-native text-slate-500 mb-0">{TIER_DESCS[key] || tier.level_name || ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="value-native text-slate-500">
                        {tier.min_xp.toLocaleString()} XP
                      </p>
                      {isCurrent && (
                        <span className="label-native text-yellow-500 mb-0">CURRENT</span>
                      )}
                      {isUnlocked && !isCurrent && (
                        <CheckCircle2 size={16} className="text-green-500 ml-auto" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mint Button */}
            <button
              onClick={handleMint}
              disabled={!progress.canMint || minting || !progress.nextTier}
              className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 transition-all ${
                progress.canMint && !minting && progress.nextTier
                  ? 'btn-cyber-native-action active:scale-[0.98]'
                  : 'btn-cyber-disabled'
              }`}
            >
              {minting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  MINTING SBT...
                </>
              ) : progress.canMint && progress.nextTier ? (
                <>
                  MINT {progress.nextTier} SBT
                  <Sparkles size={16} />
                </>
              ) : !progress.nextTier ? (
                <>
                  MAX TIER REACHED
                  <CheckCircle2 size={16} />
                </>
              ) : (
                <>
                  {progress.xpToNextTier !== null
                    ? `NEED ${progress.xpToNextTier.toLocaleString()} MORE XP`
                    : 'EARN XP TO MINT'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {!progress.canMint && progress.nextTier && (
              <p className="label-native text-slate-600 text-center mb-0">
                You need {progress.xpToNextTier?.toLocaleString()} more XP to mint {progress.nextTier} SBT
              </p>
            )}
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
