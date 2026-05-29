import { useAccount, useBalance, useSignMessage, useConfig, useReadContract, useChainId } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { useNFTTiers } from '../../../hooks/useNFTTiers';
import { useCMS } from '../../../hooks/useCMS';
import { usePoints } from '../../../shared/context/PointsContext';
import { useSBT } from '../../../hooks/useSBT';
import { useUserInfo } from '../../../hooks/useContract';
import { CONTRACTS, ABIS } from '../../../lib/contracts';
import { formatEther } from 'viem';
import toast from 'react-hot-toast';
import { usePendingSyncRecovery } from '../../../hooks/usePendingSyncRecovery';
import { AlertCircle, ArrowUpCircle, CheckCircle2, Loader2, Lock, Sparkles } from 'lucide-react';

export function SBTUpgradeCard() {
    const { address } = useAccount();
    const chainId = useChainId();
    const { recordFailure: recordPendingSync } = usePendingSyncRecovery();
    const config = useConfig();
    const { signMessageAsync } = useSignMessage();
    const { userPoints, userTier, refetch: refetchPoints, ecosystemSettings, gasTracker } = usePoints();
    const { isGasExpensive, isGasHigh } = gasTracker || {};
    const { tiers, mintTier, refetch: refetchTiers } = useNFTTiers();
    const { ethPrice } = useCMS();
    const { refetchAll } = useSBT();
    const { stats: userOnChainStats, refetch: refetchUserInfo } = useUserInfo(address);
    const { data: balanceData } = useBalance({ address });

    // Feature Flags Check
    const isMainnet = import.meta.env.VITE_CHAIN_ID === '8453';
    const isSbtFeatureEnabled = !isMainnet || (ecosystemSettings as { active_features?: { sbt_minting?: boolean } })?.active_features?.sbt_minting === true;

    // Find current and next tier (Sync on-chain tier to bypass DB delay)
    const dbTier = userTier || 0;
    const chainTier = userOnChainStats?.currentTier || 0;
    const currentTierIndex = Math.max(dbTier, chainTier);
    const nextTierId = currentTierIndex + 1;
    const nextTier = tiers.find(t => t.id === nextTierId);

    // Read MasterX tier fee as fallback (admin may set fee there instead of DailyApp)
    const { data: masterXFee } = useReadContract({
        address: CONTRACTS.MASTER_X as `0x${string}`,
        abi: ABIS.MASTER_X as readonly unknown[],
        functionName: 'tierUpgradeFeeWei',
        args: [nextTierId],
        query: { enabled: nextTierId <= 5 }
    });

    // Resolve effective mint price: prefer DailyApp nftConfigs, fallback to MasterX tierUpgradeFeeWei
    const effectiveMintPrice = (nextTier?.mintPrice && nextTier.mintPrice > 0n)
        ? nextTier.mintPrice
        : (masterXFee ? BigInt(masterXFee.toString()) : 0n);

    // FIX v3.64.35: Guard against rendering before tier contract data is loaded.
    // isOpen being undefined means data hasn't loaded yet — don't block button prematurely.
    const isDataLoaded = nextTier?.isOpen !== undefined;

    // Safety check for Max Level
    if (currentTierIndex >= 5) {
        return (
            <div className="glass-card p-6 border-yellow-500/30 bg-yellow-500/5">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <Sparkles className="text-yellow-400" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">MAX LEVEL REACHED</h3>
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">YOU ARE A DIAMOND MEMBER. MAXIMUM REWARDS ACTIVE.</p>
                    </div>
                </div>
            </div>
        );
    }

    // FIX v3.64.36: Wait for tier data to load before rendering.
    // Prevents false states: pointsRequired=0 causing hasTotalXP=true, isOpen=undefined causing premature button enable.
    if (!nextTier || !isDataLoaded) return null;

    // FIX v3.64.35: Use on-chain XP as authoritative source when available.
    // This allows users restored via batchMigrateUsers (on-chain) but not yet DB-synced to mint.
    const chainXP = userOnChainStats ? Number(userOnChainStats.points) : -1;
    const dbXP = Number(userPoints);
    // Prefer on-chain XP if it's loaded (>= 0), else fall back to Supabase XP
    const effectiveXP = chainXP >= 0 ? chainXP : dbXP;

    // FIX v3.64.36: Only compute XP sufficiency when data is loaded.
    // When !isDataLoaded, pointsRequired is 0 (fallback), causing false positive.
    const hasTotalXP = isDataLoaded && effectiveXP >= nextTier.pointsRequired;
    const hasDbCanonicalXP = hasTotalXP;
    const isSoldOut = nextTier.maxSupply > 0 && nextTier.currentSupply >= nextTier.maxSupply;
    const isTierClosed = nextTier.isOpen === false;
    // SECURITY: DEV-only bypass — import.meta.env.DEV is false in production builds
    const hasEnoughETH = (import.meta.env.DEV && import.meta.env.VITE_DEV_WALLET && address?.toLowerCase() === import.meta.env.VITE_DEV_WALLET.toLowerCase())
        ? true
        : (balanceData?.value ?? 0n) >= effectiveMintPrice;

    const xpShortfall = nextTier.pointsRequired - effectiveXP;
    const isReady = isSbtFeatureEnabled && hasDbCanonicalXP && !isSoldOut && !isTierClosed && hasEnoughETH && isDataLoaded;

    const handleUpgrade = async () => {
        if (isGasExpensive) return toast.error("⛔ Transaction paused: network gas too high. Please wait.", { icon: '⛽' });
        if (!isSbtFeatureEnabled) return toast.error("SBT Minting is currently disabled for this phase.");
        if (!hasDbCanonicalXP) {
            return toast.error(`You need ${xpShortfall.toLocaleString()} more XP to upgrade!`);
        }

        if (isSoldOut) {
            return toast.error("This tier is currently sold out!");
        }

        if (isTierClosed) {
            return toast.error("This tier is not currently open for minting.");
        }

        if (!hasEnoughETH) {
            return toast.error(`Insufficient ETH. You need ${formatEther(effectiveMintPrice)} ETH to mint.`);
        }

        const tid = toast.loading(`Minting ${nextTier.name} NFT...`);
        try {
            const hash = await mintTier(nextTier.id, effectiveMintPrice);

            toast.loading(`Waiting for confirmation...`, { id: tid });

            // FIX v3.47.4: Wait for the transaction receipt to avoid optimistic UI state when tx reverts
            const receipt = await waitForTransactionReceipt(config, {
                hash,
                confirmations: 1
            });

            if (receipt.status !== 'success') {
                throw new Error("Transaction reverted on-chain");
            }

            toast.success(`NFT Minted! Welcome to ${nextTier.name} Tier! 🎉`, { id: tid });

            // Sync to DB Log
            try {
                const timestamp = new Date().toISOString();
                const message = `Log activity for ${address}\nAction: SBT Tier Ascension\nTimestamp: ${timestamp}`;
                const signature = await signMessageAsync({ message });

                const syncRes = await fetch('/api/user-bundle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'sync-sbt-upgrade',
                        wallet: address,
                        signature,
                        message,
                        payload: {
                            tierName: nextTier.name,
                            ethSpent: formatEther(effectiveMintPrice),
                            txHash: hash
                        }
                    })
                });
                if (!syncRes.ok) throw new Error(`SBT sync API returned ${syncRes.status}`);
            } catch (syncErr: unknown) {
                console.warn('SBT Sync failed (non-critical):', syncErr);
                // Chain succeeded but backend sync failed → record for reconciliation cron.
                const errMsg = syncErr instanceof Error ? syncErr.message : String(syncErr);
                recordPendingSync({
                    actionType: 'sbt_upgrade',
                    txHash: hash,
                    chainId,
                    contractAddress: CONTRACTS.DAILY_APP as string,
                    payload: {
                        tier_id: nextTier.id,
                        tier_name: nextTier.name,
                        eth_spent: formatEther(effectiveMintPrice)
                    },
                    errorMessage: errMsg
                }).catch(() => {});
                toast('SBT minted on-chain. Backend sync pending — will retry automatically.', {
                    icon: '⏳',
                    duration: 6000
                });
            }

            refetchPoints();
            refetchTiers();
            refetchAll();
            refetchUserInfo?.(); // FIX v3.56.1: Force update on-chain user stats for instant UI feedback
        } catch (err: unknown) {
            const e = err as { shortMessage?: string; message?: string; code?: number | string };
            console.error('[SBTUpgradeCard] Mint error:', e);
            // Provide specific error messages based on error type
            const errMsg = e?.shortMessage || e?.message || '';
            if (errMsg.includes('insufficient funds') || errMsg.includes('exceeds balance')) {
                toast.error(`Insufficient ETH balance. Need ${formatEther(effectiveMintPrice)} ETH + gas.`, { id: tid });
            } else if (errMsg.includes('user rejected') || e?.code === 4001) {
                toast.error('Transaction cancelled by user.', { id: tid });
            } else if (errMsg.includes('gas')) {
                toast.error('Gas estimation failed. Ensure you have enough ETH for the fee and gas.', { id: tid });
            } else {
                toast.error(errMsg || 'Mint failed. Check your balance and try again.', { id: tid });
            }
        }
    };

    return (
        <div className={`glass-card relative overflow-hidden transition-all duration-500 border ${isReady ? 'border-indigo-500/40 bg-indigo-500/5 shadow-lg shadow-indigo-500/10' : 'border-white/10 bg-slate-900/40'}`}>
            {/* Background Glow for Ready State */}
            {isReady && (
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 blur-[50px] animate-pulse" />
            )}

            <div className="p-5 md:p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400">Next Ascension</span>
                            {isReady && (
                                <span className="flex items-center gap-1 text-[11px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30 font-black uppercase tracking-widest">
                                    Ready
                                </span>
                            )}
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                            TIER {nextTier.name.toUpperCase()}
                        </h3>
                    </div>
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                        <ArrowUpCircle className={isReady ? "text-indigo-400 animate-bounce" : "text-slate-500"} size={24} />
                    </div>
                </div>

                {/* Progress Indicators */}
                <div className="space-y-4 mb-6">
                    {/* XP Progress */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                            <span className="text-slate-500">XP Requirement
                                {chainXP >= 0 && chainXP !== dbXP && (
                                    <span className="ml-1 text-[9px] text-indigo-400 normal-case">(on-chain)</span>
                                )}
                            </span>
                            <span className={hasDbCanonicalXP ? "text-green-400" : "text-yellow-400"}>
                                {effectiveXP.toLocaleString()} / {nextTier.pointsRequired.toLocaleString()}
                            </span>
                        </div>
                        <div className="h-2 bg-black/40 rounded-full border border-white/5 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ${hasDbCanonicalXP ? 'bg-green-500' : 'bg-yellow-600'}`}
                                style={{ width: `${Math.min((effectiveXP / nextTier.pointsRequired) * 100, 100)}%` }}
                            />
                        </div>
                        {hasDbCanonicalXP && (
                            <p className="text-[9px] font-bold text-yellow-500/80 uppercase tracking-widest animate-pulse">
                                XP verified. V16 mints directly on-chain and burns required points.
                            </p>
                        )}
                    </div>

                    {/* Cost & Supply Indicator */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
                            <div className="flex flex-col">
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Fee</span>
                                <span className="text-[11px] font-black text-white uppercase tracking-widest">
                                    {formatEther(effectiveMintPrice)} ETH
                                    {ethPrice > 0 && <span className="ml-1 text-slate-500 text-[9px] normal-case">(${(parseFloat(formatEther(effectiveMintPrice)) * ethPrice).toFixed(2)})</span>}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
                            <div className="flex flex-col">
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Supply</span>
                                <span className={`text-[11px] font-black uppercase tracking-widest ${isSoldOut ? 'text-red-400' : 'text-white'}`}>
                                    {nextTier.currentSupply} / {nextTier.maxSupply || '∞'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Requirements Summary */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-black uppercase tracking-widest ${hasTotalXP ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {hasTotalXP ? <CheckCircle2 size={12} /> : <Lock size={12} />}
                        Total XP
                    </div>
                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-black uppercase tracking-widest ${hasDbCanonicalXP ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'}`}>
                        {hasDbCanonicalXP ? <CheckCircle2 size={12} /> : <Loader2 size={12} className="animate-spin" />}
                        Voucher Ready
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-6">
                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-black uppercase tracking-widest ${hasEnoughETH ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {hasEnoughETH ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        Funds OK
                    </div>
                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-black uppercase tracking-widest ${!isSoldOut ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {!isSoldOut ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        Available
                    </div>
                </div>

                {/* Gas Warning Banner */}
                {isGasHigh && !isGasExpensive && (
                    <div className="flex items-center justify-center gap-2 mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest text-center shadow-inner">
                        ⚠️ Network is busy, mint fee might be high
                    </div>
                )}

                <button
                    onClick={handleUpgrade}
                    disabled={!hasDbCanonicalXP || isSoldOut || !isSbtFeatureEnabled || isGasExpensive || !hasEnoughETH}
                    className={`w-full min-h-[56px] py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-1
                        ${isGasExpensive
                            ? 'bg-red-900/20 text-red-500 border border-red-500/30 cursor-not-allowed'
                            : isReady
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-900/30'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                >
                    {isGasExpensive ? (
                        <>
                            <span className="flex items-center gap-2"><AlertCircle size={14} /> ⛔ GAS TOO HIGH</span>
                            <span className="text-[9px] opacity-70 normal-case font-medium tracking-normal">Please wait until network fees drop</span>
                        </>
                    ) : !isSbtFeatureEnabled ? (
                        'LOCKED: PHASE 3 FEATURE'
                    ) : isSoldOut ? (
                        'TIER SOLD OUT'
                    ) : !hasDbCanonicalXP ? (
                        `NEED ${xpShortfall.toLocaleString()} MORE XP`
                    ) : (
                        <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-2">
                                <Sparkles size={14} />
                                MINT {nextTier.name.toUpperCase()} NOW — {formatEther(effectiveMintPrice)} ETH
                            </div>
                            {ethPrice > 0 && (
                                <span className="text-[9px] opacity-70 font-bold tracking-widest">
                                    EST. COST: ${(parseFloat(formatEther(effectiveMintPrice)) * ethPrice).toFixed(2)} USDC
                                </span>
                            )}
                        </div>
                    )}
                </button>

                {hasTotalXP && !hasEnoughETH && (
                    <p className="text-[11px] text-red-400 text-center mt-3 font-black uppercase animate-pulse tracking-widest">
                        ⚠️ Insufficient ETH for Minting Fee
                    </p>
                )}
            </div>
        </div>
    );
}
