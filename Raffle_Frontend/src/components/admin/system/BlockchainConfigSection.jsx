import React, { useState, useEffect } from 'react';
import { Zap, BarChart, Plus, TrendingUp, Cpu, Database, Coins, Settings, RefreshCw, ArrowUpRight, Landmark, Clock, ShieldCheck } from 'lucide-react';
import { useAccount, useSignMessage, useReadContract, useWriteContract } from 'wagmi';
import { CONTRACTS, DAILY_APP_ABI, MASTER_X_ABI, RAFFLE_ABI, SAFE_MULTISIG } from '../../../lib/contracts';
import toast from 'react-hot-toast';
import axios from 'axios';
import { usePriceOracle } from '../../../hooks/usePriceOracle';
import { formatUnits, parseUnits, parseEther } from 'viem';
import { useSBT } from '../../../hooks/useSBT';
import { useCMS } from '../../../hooks/useCMS';
import { usePoints } from '../../../shared/context/PointsContext';

export function BlockchainConfigSection() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { writeContractAsync } = useWriteContract();
    const { ecosystemSettings } = usePoints();
    const [isSaving, setIsSaving] = useState(false);

    const { totalPoolBalance, distributeRevenue, withdrawTreasury, refetchAll } = useSBT();
    const { poolSettings, updatePoolSettings, ethPrice } = useCMS();

    // Form States (Initialized with Zero-Hardcode canonical defaults)
    const [rewards, setRewards] = useState({
        daily: String(ecosystemSettings?.daily_claim || '100'),
        referral: String(ecosystemSettings?.referral_reward || '50')
    });
    const [raffleFees, setRaffleFees] = useState({ rake: '2000', surcharge: '500' });
    const [raffleLimits, setRaffleLimits] = useState({ maxUser: '1000', maxParticipants: '10000' });
    const [raffleXp, setRaffleXp] = useState({ create: '500', claim: '200', purchase: '50' });
    const [econShares, setEconShares] = useState({ owner: '4000', ops: '2000', treasury: '2000', sbt: '2000' });
    const [tierWeights, setTierWeights] = useState({ diamond: '400', platinum: '300', gold: '200', silver: '100', bronze: '50' });
    const [withdrawFee, setWithdrawFee] = useState('500');
    const [sponsorSettings, setSponsorSettings] = useState({
        fee: '1000000', // $1 USDC
        minPool: '5000000000000000000', // 5 ETH/TOKEN
        reward: '10000000000000000', // 0.01
        tasks: '3'
    });
    const [withdrawAmount, setWithdrawAmount] = useState('0.1');
    const [poolFormData, setPoolFormData] = useState({
        targetUSDC: 5000,
        claimTimestamp: 0
    });

    // MasterX Protocol Parameters (Previously in SystemSettingsTab)
    const [masterParams, setMasterParams] = useState({
        tUSDC: '150000',
        mGas: '100000000000',
        pPerTicket: '15',
        desc: ''
    });


    const { prices } = usePriceOracle((ecosystemSettings?.allowed_tokens || ecosystemSettings?.whitelisted_tokens)?.map(t => t.address) || []);
    
    // Derived USD values for indicators
    const getUsdValue = (amount, isUsdc = false) => {
        if (!amount) return 0;
        if (isUsdc) return parseFloat(amount) / 1000000;
        
        // For reward tokens, we need to know WHICH token it is. 
        // In Admin panel, it's a bit tricky because the 'minPool' or 'reward' 
        // could be in ANY allowed/whitelisted token. We'll show valuation for ETH as a baseline or Creator Token.
        const ethPrice = prices['0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'] || prices['0x4200000000000000000000000000000000000006'] || 0;
        const raw = parseFloat(amount) / 1e18;
        return raw * ethPrice;
    };
    const [autoApprove, setAutoApprove] = useState(true);

    // System Architecture States
    const [pointers, setPointers] = useState({
        creatorToken: CONTRACTS.CREATOR_TOKEN || '',
        usdcToken: CONTRACTS.USDC || '',
        raffleContract: CONTRACTS.RAFFLE || '',
        dailyApp: CONTRACTS.DAILY_APP || '',
        masterX: CONTRACTS.MASTER_X || ''
    });
    const [newTokenWhitelist, setNewTokenWhitelist] = useState({
        address: '',
        symbol: '',
        decimals: '18',
        chain_id: '8453' // Default to Base
    });
    const tokens = ecosystemSettings?.allowed_tokens || ecosystemSettings?.whitelisted_tokens || [];

    // 1. READ Global Rewards
    const { data: qDaily } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'dailyBonusAmount' });
    const { data: qReferral } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'baseReferralReward' });

    // 2. READ Raffle Economics
    const { data: qRake } = useReadContract({ address: CONTRACTS.RAFFLE, abi: RAFFLE_ABI, functionName: 'maintenanceFeeBP' });
    const { data: qSurcharge } = useReadContract({ address: CONTRACTS.RAFFLE, abi: RAFFLE_ABI, functionName: 'surchargeBP' });
    const { data: qMaxUser } = useReadContract({ address: CONTRACTS.RAFFLE, abi: RAFFLE_ABI, functionName: 'maxTicketsPerUser' });
    const { data: qMaxPart } = useReadContract({ address: CONTRACTS.RAFFLE, abi: RAFFLE_ABI, functionName: 'maxParticipants' });
    const { data: qXpCreate } = useReadContract({ address: CONTRACTS.RAFFLE, abi: RAFFLE_ABI, functionName: 'rewardXpCreate' });
    const { data: qXpClaim } = useReadContract({ address: CONTRACTS.RAFFLE, abi: RAFFLE_ABI, functionName: 'rewardXpClaim' });
    const { data: qXpPurchase } = useReadContract({ address: CONTRACTS.RAFFLE, abi: RAFFLE_ABI, functionName: 'rewardXpPurchase' });

    // 3. READ MasterX Economics
    const { data: qOwner } = useReadContract({ address: CONTRACTS.MASTER_X, abi: MASTER_X_ABI, functionName: 'ownerShare' });
    const { data: qOps } = useReadContract({ address: CONTRACTS.MASTER_X, abi: MASTER_X_ABI, functionName: 'opsShare' });
    const { data: qTreasury } = useReadContract({ address: CONTRACTS.MASTER_X, abi: MASTER_X_ABI, functionName: 'treasuryShare' });
    const { data: qSbtShare } = useReadContract({ address: CONTRACTS.MASTER_X, abi: MASTER_X_ABI, functionName: 'sbtPoolShare' });

    const { data: qDWeight } = useReadContract({ address: CONTRACTS.MASTER_X, abi: MASTER_X_ABI, functionName: 'diamondWeight' });
    const { data: qPWeight } = useReadContract({ address: CONTRACTS.MASTER_X, abi: MASTER_X_ABI, functionName: 'platinumWeight' });
    const { data: qGWeight } = useReadContract({ address: CONTRACTS.MASTER_X, abi: MASTER_X_ABI, functionName: 'goldWeight' });
    const { data: qSWeight } = useReadContract({ address: CONTRACTS.MASTER_X, abi: MASTER_X_ABI, functionName: 'silverWeight' });
    const { data: qBWeight } = useReadContract({ address: CONTRACTS.MASTER_X, abi: MASTER_X_ABI, functionName: 'bronzeWeight' });

    // MasterX Technical Params
    const { data: qTUSDC } = useReadContract({ address: CONTRACTS.MASTER_X, abi: MASTER_X_ABI, functionName: 'ticketPriceUSDC' });
    const { data: qMGas } = useReadContract({ address: CONTRACTS.MASTER_X, abi: MASTER_X_ABI, functionName: 'maxGasPrice' });
    const { data: qPPT } = useReadContract({ address: CONTRACTS.MASTER_X, abi: MASTER_X_ABI, functionName: 'pointsPerTicket' });
    const { data: qDesc } = useReadContract({ address: CONTRACTS.MASTER_X, abi: MASTER_X_ABI, functionName: 'ticketDescription' });
    const { data: qLastDist } = useReadContract({ address: CONTRACTS.MASTER_X, abi: MASTER_X_ABI, functionName: 'lastDistributeTimestamp' });

    // 4. READ Additional DailyApp Economies
    const { data: qWithdrawFee } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'withdrawalFeeBP' });
    const { data: qSponsorFee } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'sponsorshipPlatformFee' });
    const { data: qMinPool } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'minRewardPoolValue' });
    const { data: qRewardClaim } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'rewardPerClaim' });
    const { data: qTasksGoal } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'tasksForReward' });
    const { data: qAutoApprove } = useReadContract({ address: CONTRACTS.DAILY_APP, abi: DAILY_APP_ABI, functionName: 'autoApproveSponsorship' });

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
        if (qPWeight) setTierWeights(prev => ({ ...prev, platinum: qPWeight.toString() }));
        if (qGWeight) setTierWeights(prev => ({ ...prev, gold: qGWeight.toString() }));
        if (qSWeight) setTierWeights(prev => ({ ...prev, silver: qSWeight.toString() }));
        if (qBWeight) setTierWeights(prev => ({ ...prev, bronze: qBWeight.toString() }));

        if (qTUSDC) setMasterParams(prev => ({ ...prev, tUSDC: qTUSDC.toString() }));
        if (qMGas) setMasterParams(prev => ({ ...prev, mGas: qMGas.toString() }));
        if (qPPT) setMasterParams(prev => ({ ...prev, pPerTicket: qPPT.toString() }));
        if (qDesc) setMasterParams(prev => ({ ...prev, desc: qDesc.toString() }));

        if (qWithdrawFee) setWithdrawFee(qWithdrawFee.toString());
        if (qSponsorFee) setSponsorSettings(prev => ({ ...prev, fee: qSponsorFee.toString() }));
        if (qMinPool) setSponsorSettings(prev => ({ ...prev, minPool: qMinPool.toString() }));
        if (qRewardClaim) setSponsorSettings(prev => ({ ...prev, reward: qRewardClaim.toString() }));
        if (qTasksGoal) setSponsorSettings(prev => ({ ...prev, tasks: qTasksGoal.toString() }));
        if (qAutoApprove !== undefined) setAutoApprove(!!qAutoApprove);
    }, [qDaily, qReferral, qRake, qSurcharge, qMaxUser, qMaxPart, qXpCreate, qXpClaim, qXpPurchase, qOwner, qOps, qTreasury, qSbtShare, qDWeight, qPWeight, qGWeight, qSWeight, qBWeight, qTUSDC, qMGas, qPPT, qDesc, qWithdrawFee, qSponsorFee, qMinPool, qRewardClaim, qTasksGoal, qAutoApprove]);

    useEffect(() => {
        if (poolSettings) {
            setPoolFormData({
                targetUSDC: poolSettings.targetUSDC || 5000,
                claimTimestamp: poolSettings.claimTimestamp || 0
            });
        }
    }, [poolSettings]);

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
                abi: RAFFLE_ABI,
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
                abi: RAFFLE_ABI,
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
                abi: RAFFLE_ABI,
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
                abi: MASTER_X_ABI,
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
                abi: MASTER_X_ABI,
                functionName: 'setTierWeights',
                args: [BigInt(tierWeights.diamond), BigInt(tierWeights.platinum), BigInt(tierWeights.gold), BigInt(tierWeights.silver), BigInt(tierWeights.bronze)],
            });
            toast.success("Tier Weights Updated On-Chain!", { id: tid });

            // 🛡️ Sync to DB for UI consistency
            try {
                const message = `Action: SYNC_WEIGHTS\nTimestamp: ${Date.now()}`;
                const sig = await signMessageAsync({ message });
                await axios.post('/api/admin-bundle', {
                    action: 'SYNC_WEIGHTS',
                    wallet_address: address,
                    signature: sig,
                    message: message,
                    payload: tierWeights
                });
                toast.success("Pool Weights Synced to DB!");
            } catch (syncErr) {
                console.warn("DB Sync failed, but on-chain update succeeded.");
            }
        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); }
        finally { setIsSaving(false); }
    };

    const handleSaveEconomical = async () => {
        setIsSaving(true);
        const tid = toast.loading("Syncing Economic Indicators...");
        try {
            // 1. Withdrawal Fee
            await writeContractAsync({
                address: CONTRACTS.DAILY_APP,
                abi: DAILY_APP_ABI,
                functionName: 'setWithdrawalFeeBP',
                args: [BigInt(withdrawFee)],
            });
            
            // 2. Sponsorship Settings
            await writeContractAsync({
                address: CONTRACTS.DAILY_APP,
                abi: DAILY_APP_ABI,
                functionName: 'setSettings',
                args: [BigInt(sponsorSettings.fee), BigInt(sponsorSettings.minPool), BigInt(sponsorSettings.reward), BigInt(sponsorSettings.tasks)],
            });

            // 3. Auto Approve
            await writeContractAsync({
                address: CONTRACTS.DAILY_APP,
                abi: DAILY_APP_ABI,
                functionName: 'setAutoApproveSponsorship',
                args: [autoApprove],
            });

            toast.success("Economic Indicators Updated!", { id: tid });
        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); }
        finally { setIsSaving(false); }
    };

    const handleUpdatePointer = async (contract, abi, functionName, arg) => {
        setIsSaving(true);
        const tid = toast.loading(`Updating ${functionName}...`);
        try {
            await writeContractAsync({
                address: contract,
                abi: abi,
                functionName: functionName,
                args: Array.isArray(arg) ? arg : [arg],
            });
            toast.success("Transaction submitted!", { id: tid });
        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); }
        finally { setIsSaving(false); }
    };

    const handleSaveMasterParams = async () => {
        setIsSaving(true);
        const tid = toast.loading("Updating MasterX Protocol Parameters...");
        try {
            await writeContractAsync({
                address: CONTRACTS.MASTER_X,
                abi: MASTER_X_ABI,
                functionName: 'setParams',
                args: [
                    BigInt(masterParams.tUSDC),
                    BigInt(masterParams.mGas),
                    BigInt(masterParams.pPerTicket),
                    masterParams.desc
                ],
            });
            toast.success("MasterX Parameters Updated!", { id: tid });
        } catch (e) { toast.error(e.shortMessage || e.message, { id: tid }); }
        finally { setIsSaving(false); }
    };

    const handleDistribute = async () => {
        if (!window.confirm("Open Community Claim? This will lock current balance for distribution.")) return;
        setIsSaving(true);
        const tid = toast.loading("Executing distribution...");
        try {
            await distributeRevenue();
            toast.success("Community Rewards Unlocked!", { id: tid });
            if (refetchAll) refetchAll();
        } catch (e) {
            toast.error(e.shortMessage || e.message, { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleWithdrawTreasury = async () => {
        if (!window.confirm(`Withdraw ${withdrawAmount} ETH to Safe Multisig (${SAFE_MULTISIG})?`)) return;
        setIsSaving(true);
        const tid = toast.loading("Processing treasury withdrawal...");
        try {
            await withdrawTreasury(parseEther(withdrawAmount));
            toast.success("Treasury fueled!", { id: tid });
            if (refetchAll) refetchAll();
        } catch (e) {
            toast.error(e.shortMessage || "Withdrawal failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSavePoolSettings = async () => {
        setIsSaving(true);
        const tid = toast.loading("Updating pool settings...");
        try {
            await updatePoolSettings(poolFormData);
            toast.success("Pool Settings Updated!", { id: tid });
        } catch (e) {
            toast.error(e.shortMessage || "Update failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSyncTokenToDb = async (action, tokenData) => {
        try {
            const message = `Action: ${action}\nToken: ${tokenData.address}\nTimestamp: ${Date.now()}`;
            const sig = await signMessageAsync({ message });
            
            await axios.post('/api/admin-bundle', {
                action: action,
                wallet_address: address,
                signature: sig,
                message: message,
                payload: tokenData
            });
            toast.success(`Token ${action === 'WHITELIST_TOKEN_DB' ? 'Added to' : 'Removed from'} Database!`);
        } catch (err) {
            console.error("DB Sync failed:", err);
            toast.error("Contract updated, but DB sync failed.");
        }
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
                                <label className="text-[9px] font-black text-indigo-300 uppercase">Platinum</label>
                                <input type="number" value={tierWeights.platinum} onChange={e => setTierWeights({ ...tierWeights, platinum: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
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

            {/* Economic Controls (Consolidated v3.8.0) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Community Pool Management */}
                <div className="bg-slate-900/40 p-6 rounded-2xl border border-white/5 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                            <Database className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Pool Configuration</h3>
                            <p className="text-[10px] text-slate-500 uppercase font-black">Community Reward Meta-Settings</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target USDC</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={poolFormData.targetUSDC}
                                        onChange={(e) => setPoolFormData({ ...poolFormData, targetUSDC: Number(e.target.value) })}
                                        className="w-full bg-black/40 border border-white/5 p-2 px-6 rounded-xl text-white font-mono text-xs focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Projected ETH Status</label>
                                <div className="bg-black/40 border border-white/5 p-2 rounded-xl text-indigo-400 font-mono text-xs flex items-center justify-center">
                                    {formatUnits(totalPoolBalance || 0n, 18).slice(0, 6)} ETH
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Automatic Schedule</label>
                            <input
                                type="datetime-local"
                                value={poolFormData.claimTimestamp ? new Date(poolFormData.claimTimestamp).toISOString().slice(0, 16) : ''}
                                onChange={(e) => setPoolFormData({ ...poolFormData, claimTimestamp: new Date(e.target.value).getTime() })}
                                className="w-full bg-black/40 border border-white/5 p-2 rounded-xl text-white font-mono text-xs focus:border-indigo-500 outline-none"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleSavePoolSettings}
                                disabled={isSaving}
                                className="flex-1 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-400 hover:text-white py-2.5 rounded-xl text-[10px] font-black transition-all border border-indigo-500/30 uppercase"
                            >
                                Save Configuration
                            </button>
                            <button
                                onClick={handleDistribute}
                                disabled={isSaving || totalPoolBalance === 0n}
                                className="flex-1 bg-emerald-500/20 hover:bg-emerald-600 text-emerald-400 hover:text-white py-2.5 rounded-xl text-[10px] font-black transition-all border border-emerald-500/30 uppercase"
                            >
                                Trigger Distribute
                            </button>
                        </div>
                    </div>
                </div>

                {/* Treasury Management */}
                <div className="bg-emerald-950/10 p-6 rounded-2xl border border-emerald-500/10 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                            <Landmark className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Treasury Safebox</h3>
                            <p className="text-[10px] text-emerald-500 font-black uppercase">Project Reserve (10%) Allocation</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="p-3 bg-black/40 rounded-xl border border-emerald-500/10 mb-4">
                            <p className="text-[9px] text-slate-500 uppercase font-black leading-tight">
                                Funds will be transferred to:
                                <br />
                                <span className="text-emerald-400 font-mono text-[10px]">{SAFE_MULTISIG}</span>
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Withdrawal Amount (ETH)</label>
                            <div className="flex gap-3">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    className="flex-1 bg-black/40 border border-emerald-500/10 p-3 rounded-xl text-white font-mono text-sm focus:border-emerald-500 outline-none"
                                />
                                <button
                                    onClick={handleWithdrawTreasury}
                                    disabled={isSaving}
                                    className="px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center gap-2"
                                >
                                    <ArrowUpRight className="w-4 h-4" />
                                    Withdraw
                                </button>
                            </div>
                        </div>

                        <p className="text-[9px] text-slate-500 italic mt-2">
                            *Treasury balance accumulates automatically. Multisig security required for processing.
                        </p>
                    </div>
                </div>
            </div>

            {/* ECONOMIC INDICATORS Card */}
            <div className="glass-card p-6 bg-slate-900/40 border border-white/5 space-y-4 rounded-2xl">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-400" /> ECONOMIC INDICATORS
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Withdrawal Fee BP</label>
                        <input type="number" value={withdrawFee} onChange={e => setWithdrawFee(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Sponsor Fee (USDC)</label>
                        <input type="number" value={sponsorSettings.fee} onChange={e => setSponsorSettings({ ...sponsorSettings, fee: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Min Pool Value (ETH Equiv)</label>
                        <input type="number" value={sponsorSettings.minPool} onChange={e => setSponsorSettings({ ...sponsorSettings, minPool: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                        <p className="text-[9px] text-indigo-400/60 font-mono pl-1">≈ ${getUsdValue(sponsorSettings.minPool).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Reward Per Claim (ETH Equiv)</label>
                        <input type="number" value={sponsorSettings.reward} onChange={e => setSponsorSettings({ ...sponsorSettings, reward: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                        <p className="text-[9px] text-indigo-400/60 font-mono pl-1">≈ ${getUsdValue(sponsorSettings.reward).toLocaleString(undefined, { maximumFractionDigits: 4 })} USD</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Tasks Goal</label>
                        <input type="number" value={sponsorSettings.tasks} onChange={e => setSponsorSettings({ ...sponsorSettings, tasks: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                    </div>
                    <div className="space-y-1 flex flex-col justify-end">
                        <label className="text-[10px] font-black text-slate-500 uppercase mb-2">Auto Approve</label>
                        <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black ${!autoApprove ? 'text-white' : 'text-slate-500'}`}>OFF</span>
                            <button onClick={() => setAutoApprove(!autoApprove)} className={`w-12 h-6 rounded-full p-1 transition-colors ${autoApprove ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${autoApprove ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                            <span className={`text-[10px] font-black ${autoApprove ? 'text-white' : 'text-slate-500'}`}>ON</span>
                        </div>
                    </div>
                </div>
                <button onClick={handleSaveEconomical} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all">
                    Update Economic Indicators
                </button>
            </div>

            {/* MASTER-X PROTOCOL PARAMETERS */}
            <div className="glass-card p-6 bg-blue-900/10 border border-blue-500/10 space-y-4 rounded-2xl">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-blue-400" /> MASTERX PROTOCOL PARAMETERS
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Ticket Price (USDC - 6 Dec)</label>
                        <input type="number" value={masterParams.tUSDC} onChange={e => setMasterParams({ ...masterParams, tUSDC: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                        <p className="text-[9px] text-slate-500 italic">150000 = $0.15</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Points Per Ticket</label>
                        <input type="number" value={masterParams.pPerTicket} onChange={e => setMasterParams({ ...masterParams, pPerTicket: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Max Gas Price (Wei)</label>
                        <input type="text" value={masterParams.mGas} onChange={e => setMasterParams({ ...masterParams, mGas: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Ticket Description</label>
                        <input type="text" value={masterParams.desc} onChange={e => setMasterParams({ ...masterParams, desc: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                    </div>
                </div>
                <button onClick={handleSaveMasterParams} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all">
                    Push Protocol Settings to Contract
                </button>
            </div>

            {/* MANUAL REVENUE BATCH DISTRIBUTION */}
            <div className="glass-card p-6 bg-emerald-900/10 border border-emerald-500/10 space-y-4 rounded-2xl">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-emerald-400" /> REVENUE BATCH MANAGEMENT
                </h3>
                
                <div className="grid grid-cols-2 gap-4 p-4 bg-black/20 rounded-xl border border-white/5">
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Last Distribution</p>
                        <p className="text-sm font-mono text-white">
                            {qLastDist > 0
                                ? new Date(Number(qLastDist) * 1000).toLocaleString()
                                : 'Loading...'}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Cycle Strategy</p>
                        <p className="text-sm font-mono text-emerald-400">5-Day Cooldown</p>
                    </div>
                </div>

                <button 
                    onClick={handleDistribute} 
                    disabled={isSaving} 
                    className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    <RefreshCw className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                    {isSaving ? "Processing..." : "Force Batch Distribution (Manual)"}
                </button>
                <p className="text-[9px] text-slate-500 italic text-center">* Bypasses cooldown. Updates all user reward pools.</p>
            </div>

            {/* SYSTEM ARCHITECTURE POINTERS (CRITICAL) */}
            <div className="glass-card p-6 bg-red-950/10 border border-red-500/10 space-y-6 rounded-2xl">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-red-400" /> SYSTEM ARCHITECTURE POINTERS
                </h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                    DANGEROUS: Core contract linkages. Only modify if redeploying modules.
                </p>

                <div className="space-y-4">
                    {/* DailyApp -> MasterX Link */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase">DailyApp → MasterX Pointer</label>
                            <input type="text" value={pointers.masterX} onChange={e => setPointers({ ...pointers, masterX: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-mono text-white" placeholder="0x..." />
                        </div>
                        <button onClick={() => handleUpdatePointer(CONTRACTS.DAILY_APP, DAILY_APP_ABI, 'setMasterX', pointers.masterX)} className="bg-red-600/20 hover:bg-red-600/40 border border-red-600/20 py-2 rounded-xl text-[9px] font-black uppercase text-red-400">Update MasterX Link</button>
                    </div>

                    {/* MasterX -> Raffle Link */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase">MasterX → Raffle Pointer</label>
                            <input type="text" value={pointers.raffleContract} onChange={e => setPointers({ ...pointers, raffleContract: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-mono text-white" placeholder="0x..." />
                        </div>
                        <button onClick={() => handleUpdatePointer(CONTRACTS.MASTER_X, MASTER_X_ABI, 'setRaffleContract', pointers.raffleContract)} className="bg-red-600/20 hover:bg-red-600/40 border border-red-600/20 py-2 rounded-xl text-[9px] font-black uppercase text-red-400">Update Raffle Link</button>
                    </div>

                    {/* DailyApp Tokens */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end border-t border-white/5 pt-4">
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase">USDCToken Address (DailyApp)</label>
                            <input type="text" value={pointers.usdcToken} onChange={e => setPointers({ ...pointers, usdcToken: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-mono text-white" placeholder="0x..." />
                        </div>
                        <button onClick={() => handleUpdatePointer(CONTRACTS.DAILY_APP, DAILY_APP_ABI, 'setUSDCToken', pointers.usdcToken)} className="bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-[9px] font-black uppercase text-white">Set USDC Token</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase">CreatorToken Address (DailyApp)</label>
                            <input type="text" value={pointers.creatorToken} onChange={e => setPointers({ ...pointers, creatorToken: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-mono text-white" placeholder="0x..." />
                        </div>
                        <button onClick={() => handleUpdatePointer(CONTRACTS.DAILY_APP, DAILY_APP_ABI, 'setCreatorToken', pointers.creatorToken)} className="bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-[9px] font-black uppercase text-white">Set Creator Token</button>
                    </div>

                    {/* Payment Token Whitelist Management */}
                    {/* Payment Token Whitelist Management */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Payment Token Whitelist Management</label>
                        
                        {/* Current Whitelist Display */}
                        <div className="overflow-hidden rounded-xl border border-white/5 bg-black/20">
                            <table className="w-full text-left text-[10px]">
                                <thead className="bg-white/5 text-slate-400 uppercase font-black">
                                    <tr>
                                        <th className="px-4 py-2">Symbol</th>
                                        <th className="px-4 py-2">Chain</th>
                                        <th className="px-4 py-2">Address</th>
                                        <th className="px-4 py-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white">
                                    {tokens.map((token, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-2 font-black">{token.symbol}</td>
                                            <td className="px-4 py-2 text-slate-400">{token.chain_id}</td>
                                            <td className="px-4 py-2 font-mono text-[9px]">{token.address.slice(0,6)}...{token.address.slice(-4)}</td>
                                            <td className="px-4 py-2">
                                                <button 
                                                    onClick={() => {
                                                        const p = { address: token.address, chain_id: token.chain_id };
                                                        handleUpdatePointer(CONTRACTS.DAILY_APP, DAILY_APP_ABI, 'setAllowedToken', [p.address, false]);
                                                        handleSyncTokenToDb('REMOVE_TOKEN_DB', p);
                                                    }}
                                                    className="text-red-400 hover:text-red-300 font-bold uppercase"
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {tokens.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="px-4 py-4 text-center text-slate-500 italic">No custom tokens whitelisted.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Add New Token Form */}
                        <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/5">
                            <p className="text-[9px] font-black text-indigo-400 uppercase">Add New Token</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[8px] text-slate-500 uppercase font-bold">Address</label>
                                    <input type="text" value={newTokenWhitelist.address} onChange={e => setNewTokenWhitelist({...newTokenWhitelist, address: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-mono text-white" placeholder="0x..." />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] text-slate-500 uppercase font-bold">Symbol</label>
                                    <input type="text" value={newTokenWhitelist.symbol} onChange={e => setNewTokenWhitelist({...newTokenWhitelist, symbol: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white" placeholder="USDC" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] text-slate-500 uppercase font-bold">Decimals</label>
                                    <input type="number" value={newTokenWhitelist.decimals} onChange={e => setNewTokenWhitelist({...newTokenWhitelist, decimals: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] text-slate-500 uppercase font-bold">Chain ID</label>
                                    <input type="number" value={newTokenWhitelist.chain_id} onChange={e => setNewTokenWhitelist({...newTokenWhitelist, chain_id: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white" />
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    if (!newTokenWhitelist.address || !newTokenWhitelist.symbol) return toast.error("Missing fields");
                                    handleUpdatePointer(CONTRACTS.DAILY_APP, DAILY_APP_ABI, 'setAllowedToken', [newTokenWhitelist.address, true]);
                                    handleSyncTokenToDb('WHITELIST_TOKEN_DB', {
                                        ...newTokenWhitelist,
                                        decimals: parseInt(newTokenWhitelist.decimals),
                                        chain_id: parseInt(newTokenWhitelist.chain_id)
                                    });
                                }}
                                className="w-full bg-green-600/20 hover:bg-green-600/40 border border-green-600/20 py-2 rounded-xl text-[9px] font-black uppercase text-green-400"
                            >
                                Whitelist & Sync to Database
                            </button>
                        </div>
                        <p className="text-[9px] text-slate-600 italic">Native ETH is enabled by default in the contract. Whitelisting ERC20s here will enable them for Sponsorships and be indexed by the UI.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
