import React, { useState, useEffect } from 'react';
import { Zap, BarChart, Plus, TrendingUp, Cpu } from 'lucide-react';
import { useReadContract, useWriteContract } from 'wagmi';
import { CONTRACTS, DAILY_APP_ABI } from '../../../lib/contracts';
import toast from 'react-hot-toast';

import { usePoints } from '../../../shared/context/PointsContext';

export function BlockchainConfigSection() {
    const { writeContractAsync } = useWriteContract();
    const { ecosystemSettings } = usePoints();
    const [isSaving, setIsSaving] = useState(false);

    // Form States (Initialized with Zero-Hardcode canonical defaults)
    const [rewards, setRewards] = useState({
        daily: String(ecosystemSettings?.daily_claim || '100'),
        referral: String(ecosystemSettings?.referral_reward || '50')
    });
    const [raffleFees, setRaffleFees] = useState({ rake: '2000', surcharge: '500' });
    const [raffleLimits, setRaffleLimits] = useState({ maxUser: '1000', maxParticipants: '10000' });
    const [raffleXp, setRaffleXp] = useState({ create: '500', claim: '200', purchase: '50' });
    const [econShares, setEconShares] = useState({ owner: '4000', ops: '2000', treasury: '2000', sbt: '2000' });
    const [tierWeights, setTierWeights] = useState({ diamond: '400', gold: '200', silver: '100', bronze: '50' });
    const [withdrawFee, setWithdrawFee] = useState('500');

    // 1. READ Global Rewards
    const { data: qDaily } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'dailyBonusAmount' });
    const { data: qReferral } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'baseReferralReward' });

    // 2. READ Raffle Economics
    const { data: qRake } = useReadContract({ address: CONTRACTS.RAFFLE, abi: DAILY_APP_ABI, functionName: 'maintenanceFeeBP' });
    const { data: qSurcharge } = useReadContract({ address: CONTRACTS.RAFFLE, abi: DAILY_APP_ABI, functionName: 'surchargeBP' });
    const { data: qMaxUser } = useReadContract({ address: CONTRACTS.RAFFLE, abi: DAILY_APP_ABI, functionName: 'maxTicketsPerUser' });
    const { data: qMaxPart } = useReadContract({ address: CONTRACTS.RAFFLE, abi: DAILY_APP_ABI, functionName: 'maxParticipants' });
    const { data: qXpCreate } = useReadContract({ address: CONTRACTS.RAFFLE, abi: DAILY_APP_ABI, functionName: 'rewardXpCreate' });
    const { data: qXpClaim } = useReadContract({ address: CONTRACTS.RAFFLE, abi: DAILY_APP_ABI, functionName: 'rewardXpClaim' });
    const { data: qXpPurchase } = useReadContract({ address: CONTRACTS.RAFFLE, abi: DAILY_APP_ABI, functionName: 'rewardXpPurchase' });

    // 3. READ MasterX Economics
    const { data: qOwner } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'ownerShare' });
    const { data: qOps } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'opsShare' });
    const { data: qTreasury } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'treasuryShare' });
    const { data: qSbtShare } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'sbtPoolShare' });

    const { data: qDWeight } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'diamondWeight' });
    const { data: qGWeight } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'goldWeight' });
    const { data: qSWeight } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'silverWeight' });
    const { data: qBWeight } = useReadContract({ address: CONTRACTS.MASTER_X, abi: DAILY_APP_ABI, functionName: 'bronzeWeight' });

    useEffect(() => {
        if (qDaily) setRewards(prev => ({ ...prev, daily: qDaily.toString() }));
        if (qReferral) setRewards(prev => ({ ...prev, referral: qReferral.toString() }));
        if (qRake) setRaffleFees(prev => ({ ...prev, rake: qRake.toString() }));
        if (qSurcharge) setRaffleFees(prev => ({ ...prev, surcharge: qSurcharge.toString() }));
        if (qMaxUser) setRaffleLimits(prev => ({ ...prev, maxUser: qMaxUser.toString() }));
        if (qMaxPart) setRaffleLimits(prev => ({ ...prev, maxParticipants: qMaxPart.toString() }));
        if (qXpCreate) setRaffleXp(prev => ({ ...prev, create: qXpCreate.toString() }));
        if (qXpClaim) setRaffleXp(prev => ({ ...prev, claim: qXpClaim.toString() }));
        if (qXpPurchase) setRaffleXp(prev => ({ ...prev, purchase: qXpPurchase.toString() }));

        if (qOwner) setEconShares(prev => ({ ...prev, owner: qOwner.toString() }));
        if (qOps) setEconShares(prev => ({ ...prev, ops: qOps.toString() }));
        if (qTreasury) setEconShares(prev => ({ ...prev, treasury: qTreasury.toString() }));
        if (qSbtShare) setEconShares(prev => ({ ...prev, sbt: qSbtShare.toString() }));

        if (qDWeight) setTierWeights(prev => ({ ...prev, diamond: qDWeight.toString() }));
        if (qGWeight) setTierWeights(prev => ({ ...prev, gold: qGWeight.toString() }));
        if (qSWeight) setTierWeights(prev => ({ ...prev, silver: qSWeight.toString() }));
        if (qBWeight) setTierWeights(prev => ({ ...prev, bronze: qBWeight.toString() }));
    }, [qDaily, qReferral, qRake, qSurcharge, qMaxUser, qMaxPart, qXpCreate, qXpClaim, qXpPurchase, qOwner, qOps, qTreasury, qSbtShare, qDWeight, qGWeight, qSWeight, qBWeight]);

    const handleSaveGeneral = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing Rewards to Chain...");
        try {
            await writeContractAsync({
                address: CONTRACTS.DAILY_APP,
                abi: DAILY_APP_ABI,
                functionName: 'setGlobalRewards',
                args: [BigInt(rewards.daily), BigInt(rewards.referral)],
            });
            toast.success("Rewards Updated!", { id: tid });
        } catch (e) {
            toast.error(e.shortMessage || e.message, { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveRaffleFees = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing Raffle Fees...");
        try {
            await writeContractAsync({
                address: CONTRACTS.RAFFLE,
                abi: DAILY_APP_ABI,
                functionName: 'setRaffleFees',
                args: [BigInt(raffleFees.rake), BigInt(raffleFees.surcharge)],
            });
            toast.success("Raffle Fees Updated!", { id: tid });
        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); }
        finally { setIsSaving(false); }
    };

    const handleSaveRaffleLimits = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing Raffle Limits...");
        try {
            await writeContractAsync({
                address: CONTRACTS.RAFFLE,
                abi: DAILY_APP_ABI,
                functionName: 'setRaffleLimits',
                args: [BigInt(raffleLimits.maxUser), BigInt(raffleLimits.maxParticipants)],
            });
            toast.success("Raffle Limits Updated!", { id: tid });
        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); }
        finally { setIsSaving(false); }
    };

    const handleSaveRaffleXp = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing Raffle XP Rewards...");
        try {
            await writeContractAsync({
                address: CONTRACTS.RAFFLE,
                abi: DAILY_APP_ABI,
                functionName: 'setRaffleXP',
                args: [BigInt(raffleXp.create), BigInt(raffleXp.claim), BigInt(raffleXp.purchase)],
            });
            toast.success("Raffle XP Rewards Updated!", { id: tid });
        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); }
        finally { setIsSaving(false); }
    };

    const handleSaveEconShares = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing MasterX Shares...");
        try {
            await writeContractAsync({
                address: CONTRACTS.MASTER_X,
                abi: DAILY_APP_ABI,
                functionName: 'setRevenueShares',
                args: [BigInt(econShares.owner), BigInt(econShares.ops), BigInt(econShares.treasury), BigInt(econShares.sbt)],
            });
            toast.success("Revenue Shares Updated!", { id: tid });
        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); }
        finally { setIsSaving(false); }
    };

    const handleSaveTierWeights = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing SBT Pool Weights...");
        try {
            await writeContractAsync({
                address: CONTRACTS.MASTER_X,
                abi: DAILY_APP_ABI,
                functionName: 'setTierWeights',
                args: [BigInt(tierWeights.diamond), BigInt(tierWeights.gold), BigInt(tierWeights.silver), BigInt(tierWeights.bronze)],
            });
            toast.success("Tier Weights Updated!", { id: tid });
        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); }
        finally { setIsSaving(false); }
    };

    return (
        <div className="space-y-6">
            {/* Rewards Card */}
            <div className="glass-card p-6 bg-slate-900/40 border border-white/5 space-y-4 rounded-2xl">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" /> GLOBAL XP REWARDS
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Daily Claim XP</label>
                        <input type="number" value={rewards.daily} onChange={e => setRewards({ ...rewards, daily: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Referral XP</label>
                        <input type="number" value={rewards.referral} onChange={e => setRewards({ ...rewards, referral: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                    </div>
                </div>
                <button onClick={handleSaveGeneral} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all">
                    Update XP Rewards
                </button>
            </div>

            {/* Raffle Fees Card */}
            <div className="glass-card p-6 bg-slate-900/40 border border-white/5 space-y-4 rounded-2xl">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <BarChart className="w-5 h-5 text-emerald-400" /> RAFFLE ECONOMICS
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Rake BP (2000 = 20%)</label>
                        <input type="number" value={raffleFees.rake} onChange={e => setRaffleFees({ ...raffleFees, rake: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Surcharge BP (500 = 5%)</label>
                        <input type="number" value={raffleFees.surcharge} onChange={e => setRaffleFees({ ...raffleFees, surcharge: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                    </div>
                </div>
                <button onClick={handleSaveRaffleFees} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all">
                    Update Raffle Fees
                </button>

                <div className="border-t border-white/5 pt-4 grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Max Tickets/User</label>
                        <input type="number" value={raffleLimits.maxUser} onChange={e => setRaffleLimits({ ...raffleLimits, maxUser: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Max Participants</label>
                        <input type="number" value={raffleLimits.maxParticipants} onChange={e => setRaffleLimits({ ...raffleLimits, maxParticipants: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                    </div>
                </div>
                <button onClick={handleSaveRaffleLimits} disabled={isSaving} className="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all">
                    Update Raffle Limits
                </button>
            </div>

            {/* MasterX Economics & Tier Weights */}
            <div className="glass-card p-6 bg-slate-900/40 border border-white/5 space-y-4 lg:col-span-2 rounded-2xl">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-orange-400" /> MASTER-X REVENUE & POOL
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                    <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue Shares (BP - Total 10000)</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase text-left">Owner</label>
                                <input type="number" value={econShares.owner} onChange={e => setEconShares({ ...econShares, owner: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase">Operations</label>
                                <input type="number" value={econShares.ops} onChange={e => setEconShares({ ...econShares, ops: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase">Treasury</label>
                                <input type="number" value={econShares.treasury} onChange={e => setEconShares({ ...econShares, treasury: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase">SBT Pool</label>
                                <input type="number" value={econShares.sbt} onChange={e => setEconShares({ ...econShares, sbt: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                        </div>
                        <button onClick={handleSaveEconShares} disabled={isSaving} className="w-full bg-orange-600 hover:bg-orange-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all">
                            Update Revenue Shares
                        </button>
                    </div>

                    <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SBT Pool Distribution Weights</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-cyan-400 uppercase">Diamond</label>
                                <input type="number" value={tierWeights.diamond} onChange={e => setTierWeights({ ...tierWeights, diamond: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-amber-400 uppercase">Gold</label>
                                <input type="number" value={tierWeights.gold} onChange={e => setTierWeights({ ...tierWeights, gold: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase">Silver</label>
                                <input type="number" value={tierWeights.silver} onChange={e => setTierWeights({ ...tierWeights, silver: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-amber-700 uppercase">Bronze</label>
                                <input type="number" value={tierWeights.bronze} onChange={e => setTierWeights({ ...tierWeights, bronze: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                            </div>
                        </div>
                        <button onClick={handleSaveTierWeights} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all">
                            Update Tier Weights
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
