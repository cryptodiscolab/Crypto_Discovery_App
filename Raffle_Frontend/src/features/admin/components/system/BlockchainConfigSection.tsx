import { useState, useEffect } from 'react';
import { useAccount, useSignMessage, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { CONTRACTS, DAILY_APP_ABI, MASTER_X_ABI, RAFFLE_ABI } from '../../../../lib/contracts';
import toast from 'react-hot-toast';
import axios from 'axios';
import { usePriceOracle } from '../../../../hooks/usePriceOracle';
import { useSBT } from '../../../../hooks/useSBT';
import { useCMS } from '../../../../hooks/useCMS';
import { usePoints } from '../../../../shared/context/PointsContext';

// Modular Components
import { EconomicStats } from './config/EconomicStats';
import { RewardSettingsCard } from './config/RewardSettingsCard';
import { RaffleEconSettingsCard } from './config/RaffleEconSettingsCard';
import { MasterXDistributionCard } from './config/MasterXDistributionCard';
import { PoolTreasuryConfig } from './config/PoolTreasuryConfig';
import { EconomicIndicatorsCard } from './config/EconomicIndicatorsCard';
import { MasterXProtocolParamsCard } from './config/MasterXProtocolParamsCard';
import { RevenueBatchManager } from './config/RevenueBatchManager';
import { SystemPointersCard } from './config/SystemPointersCard';

// Types
import { 
    RewardSettings, RaffleFees, RaffleLimits, RaffleXp, 
    EconShares, TierWeights, MasterParams, SponsorSettings, 
    PoolFormData, SystemPointers, TokenWhitelist 
} from '../../types/admin';

export function BlockchainConfigSection() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const { ecosystemSettings } = usePoints();
    const [isSaving, setIsSaving] = useState(false);

    const { totalPoolBalance, refetchAll } = useSBT();
    const { poolSettings, updatePoolSettings, ethPrice: cmsEthPrice } = useCMS();

    // Form States
    const [rewards, setRewards] = useState<RewardSettings>({ daily: '100', referral: '50' });
    const [raffleFees, setRaffleFees] = useState<RaffleFees>({ rake: '500', surcharge: '200' });
    const [raffleLimits, setRaffleLimits] = useState<RaffleLimits>({ maxUser: '10', maxParticipants: '100' });
    const [raffleXp, setRaffleXp] = useState<RaffleXp>({ create: '200', claim: '100', purchase: '15' });
    const [econShares, setEconShares] = useState<EconShares>({ owner: '20', ops: '20', treasury: '50', sbt: '10' });
    const [tierWeights, setTierWeights] = useState<TierWeights>({ diamond: '30', platinum: '25', gold: '20', silver: '15', bronze: '10' });
    const [sponsorSettings, setSponsorSettings] = useState<SponsorSettings>({
        fee: '2',
        minPool: '0.0006',
        reward: '0.00006',
        tasks: '3'
    });
    const [withdrawFee, setWithdrawFee] = useState('100');
    const [withdrawAmount, setWithdrawAmount] = useState('0.1');
    const [poolFormData, setPoolFormData] = useState<PoolFormData>({
        targetUSDC: 5000,
        claimTimestamp: 0
    });

    const [drift, setDrift] = useState({
        rewards: false,
        raffleXp: false,
        tierWeights: false
    });

    const [masterParams, setMasterParams] = useState<MasterParams>({
        tUSDC: '150000',
        mGas: '100',
        pPerTicket: '15',
        desc: ''
    });

    const allowedTokens = (ecosystemSettings as any)?.allowed_tokens || (ecosystemSettings as any)?.whitelisted_tokens || [];
    const tokenAddresses = allowedTokens.map((t: any) => t.address as `0x${string}`);
    const { prices } = usePriceOracle(tokenAddresses);
    
    const getUsdValue = (humanAmount: string, isUsdc = false) => {
        if (!humanAmount) return 0;
        const amount = parseFloat(humanAmount);
        if (isUsdc) return amount;
        
        const ethPrice = (prices as Record<string, number>)['0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'] || 
                         (prices as Record<string, number>)['0x4200000000000000000000000000000000000006'] || 
                         cmsEthPrice || 0;
        return amount * ethPrice;
    };

    const [autoApprove, setAutoApprove] = useState(true);

    const [pointers, setPointers] = useState<SystemPointers>({
        creatorToken: CONTRACTS.CREATOR_TOKEN || '',
        usdcToken: CONTRACTS.USDC || '',
        raffleContract: CONTRACTS.RAFFLE || '',
        dailyApp: CONTRACTS.DAILY_APP || '',
        masterX: CONTRACTS.MASTER_X || ''
    });

    const [newTokenWhitelist, setNewTokenWhitelist] = useState<TokenWhitelist>({
        address: '',
        symbol: '',
        decimals: '18',
        chain_id: '8453'
    });

    // Contract Reads
    const { data: qDaily } = useReadContract({ address: CONTRACTS.DAILY_APP as `0x${string}`, abi: DAILY_APP_ABI, functionName: 'dailyBonusAmount' });
    const { data: qReferral } = useReadContract({ address: CONTRACTS.DAILY_APP as `0x${string}`, abi: DAILY_APP_ABI, functionName: 'baseReferralReward' });
    const { data: qRake } = useReadContract({ address: CONTRACTS.RAFFLE as `0x${string}`, abi: RAFFLE_ABI, functionName: 'rakeBP' });
    const { data: qSurcharge } = useReadContract({ address: CONTRACTS.RAFFLE as `0x${string}`, abi: RAFFLE_ABI, functionName: 'surchargeBP' });
    const { data: qMaxUser } = useReadContract({ address: CONTRACTS.RAFFLE as `0x${string}`, abi: RAFFLE_ABI, functionName: 'maxTicketsPerUser' });
    const { data: qMaxPart } = useReadContract({ address: CONTRACTS.RAFFLE as `0x${string}`, abi: RAFFLE_ABI, functionName: 'maxParticipants' });
    const { data: qXpCreate } = useReadContract({ address: CONTRACTS.RAFFLE as `0x${string}`, abi: RAFFLE_ABI, functionName: 'xpPerCreate' });
    const { data: qXpClaim } = useReadContract({ address: CONTRACTS.RAFFLE as `0x${string}`, abi: RAFFLE_ABI, functionName: 'xpPerClaim' });
    const { data: qXpBuy } = useReadContract({ address: CONTRACTS.RAFFLE as `0x${string}`, abi: RAFFLE_ABI, functionName: 'xpPerTicket' });
    const { data: qShares } = useReadContract({ address: CONTRACTS.MASTER_X as `0x${string}`, abi: MASTER_X_ABI, functionName: 'getShares' });
    const { data: qWeights } = useReadContract({ address: CONTRACTS.MASTER_X as `0x${string}`, abi: MASTER_X_ABI, functionName: 'getTierWeights' });
    const { data: qLastDist } = useReadContract({ address: CONTRACTS.MASTER_X as `0x${string}`, abi: MASTER_X_ABI, functionName: 'lastDistribution' });
    const { data: qWithdrawFee } = useReadContract({ address: CONTRACTS.DAILY_APP as `0x${string}`, abi: DAILY_APP_ABI, functionName: 'withdrawalFeeBP' });
    const { data: qMasterParams } = useReadContract({ address: CONTRACTS.MASTER_X as `0x${string}`, abi: MASTER_X_ABI, functionName: 'params' });

    // Sync contract data to local state
    useEffect(() => {
        if (qDaily) setRewards(prev => ({ ...prev, daily: String(qDaily) }));
        if (qReferral) setRewards(prev => ({ ...prev, referral: String(qReferral) }));
        if (qRake) setRaffleFees(prev => ({ ...prev, rake: String(qRake) }));
        if (qSurcharge) setRaffleFees(prev => ({ ...prev, surcharge: String(qSurcharge) }));
        if (qMaxUser) setRaffleLimits(prev => ({ ...prev, maxUser: String(qMaxUser) }));
        if (qMaxPart) setRaffleLimits(prev => ({ ...prev, maxParticipants: String(qMaxPart) }));
        if (qXpCreate) setRaffleXp(prev => ({ ...prev, create: String(qXpCreate) }));
        if (qXpClaim) setRaffleXp(prev => ({ ...prev, claim: String(qXpClaim) }));
        if (qXpBuy) setRaffleXp(prev => ({ ...prev, purchase: String(qXpBuy) }));
        if (qWithdrawFee) setWithdrawFee(String(qWithdrawFee));
        
        if (qShares) {
            const [owner, ops, treasury, sbt] = qShares as [bigint, bigint, bigint, bigint];
            setEconShares({ owner: owner.toString(), ops: ops.toString(), treasury: treasury.toString(), sbt: sbt.toString() });
        }
        if (qWeights) {
            const [d, p, g, s, b] = qWeights as [bigint, bigint, bigint, bigint, bigint];
            setTierWeights({ diamond: d.toString(), platinum: p.toString(), gold: g.toString(), silver: s.toString(), bronze: b.toString() });
        }
        if (qMasterParams) {
            const [t, g, p, desc] = qMasterParams as [bigint, bigint, bigint, string];
            setMasterParams({ tUSDC: t.toString(), mGas: g.toString(), pPerTicket: p.toString(), desc });
        }
    }, [qDaily, qReferral, qRake, qSurcharge, qMaxUser, qMaxPart, qXpCreate, qXpClaim, qXpBuy, qShares, qWeights, qWithdrawFee, qMasterParams]);

    // Drift Detection
    useEffect(() => {
        const dbRewards = (ecosystemSettings as any)?.points_settings?.find((s: any) => s.activity_key === 'daily_claim')?.points_value;
        const dbXp = (ecosystemSettings as any)?.points_settings?.find((s: any) => s.activity_key === 'raffle_create')?.points_value;
        
        setDrift({
            rewards: dbRewards !== undefined && dbRewards !== parseInt(rewards.daily),
            raffleXp: dbXp !== undefined && dbXp !== parseInt(raffleXp.create),
            tierWeights: false
        });
    }, [rewards, raffleXp, ecosystemSettings]);

    // CMS Pool Sync
    useEffect(() => {
        if (poolSettings) {
            setPoolFormData({
                targetUSDC: poolSettings.targetUSDC || 5000,
                claimTimestamp: poolSettings.claimTimestamp || 0
            });
        }
    }, [poolSettings]);

    const handleSavePoolSettings = async () => {
        setIsSaving(true);
        const tid = toast.loading("Updating Pool Metadata...");
        try {
            await updatePoolSettings({
                target_usdc: poolFormData.targetUSDC,
                claim_timestamp: poolFormData.claimTimestamp
            });
            toast.success("Pool Settings Updated!", { id: tid });
        } catch (e: any) {
            toast.error(e.message, { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDistribute = async () => {
        setIsSaving(true);
        const tid = toast.loading("Executing Distribution...");
        try {
            const hash = await writeContractAsync({
                address: CONTRACTS.MASTER_X as `0x${string}`,
                abi: MASTER_X_ABI,
                functionName: 'distributeRevenue',
            });
            await publicClient!.waitForTransactionReceipt({ hash });
            toast.success("Revenue Distributed!", { id: tid });
            refetchAll();
        } catch (e: any) { 
            toast.error(e.shortMessage || e.message, { id: tid }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleWithdrawTreasury = async (amount: bigint) => {
        setIsSaving(true);
        const tid = toast.loading("Withdrawing Treasury...");
        try {
            const hash = await writeContractAsync({
                address: CONTRACTS.MASTER_X as `0x${string}`,
                abi: MASTER_X_ABI,
                functionName: 'withdrawTreasury',
                args: [amount],
            });
            await publicClient!.waitForTransactionReceipt({ hash });
            toast.success("Funds Withdrawn to Safe!", { id: tid });
            refetchAll();
        } catch (e: any) { 
            toast.error(e.shortMessage || e.message, { id: tid }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleSyncTokenToDb = async (action: string, payload: any) => {
        const tid = toast.loading("Syncing Database...");
        try {
            const message = `${action}: ${payload.symbol || payload.address}`;
            const signature = await signMessageAsync({ message });
            await axios.post('/api/admin-bundle', {
                wallet_address: address,
                signature,
                message,
                action,
                payload
            });
            toast.success("Database Synchronized!", { id: tid });
        } catch (e: any) {
            toast.error(e.message, { id: tid });
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header / Stats */}
            <EconomicStats 
                totalPoolBalance={totalPoolBalance || 0n} 
                rewards={rewards} 
                drift={drift} 
                raffleXp={raffleXp} 
                tierWeights={tierWeights} 
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RewardSettingsCard 
                    rewards={rewards} 
                    setRewards={setRewards} 
                    drift={drift.rewards} 
                />
                
                <RaffleEconSettingsCard 
                    raffleFees={raffleFees} setRaffleFees={setRaffleFees}
                    raffleLimits={raffleLimits} setRaffleLimits={setRaffleLimits}
                    raffleXp={raffleXp} setRaffleXp={setRaffleXp}
                    drift={drift.raffleXp}
                    isSaving={isSaving} setIsSaving={setIsSaving}
                />

                <MasterXDistributionCard 
                    econShares={econShares} setEconShares={setEconShares}
                    tierWeights={tierWeights} setTierWeights={setTierWeights}
                    drift={drift.tierWeights}
                    isSaving={isSaving} setIsSaving={setIsSaving}
                />
            </div>

            <PoolTreasuryConfig 
                totalPoolBalance={totalPoolBalance || 0n}
                poolFormData={poolFormData}
                setPoolFormData={setPoolFormData}
                handleSavePoolSettings={handleSavePoolSettings}
                handleDistribute={handleDistribute}
                handleWithdrawTreasury={handleWithdrawTreasury}
                withdrawAmount={withdrawAmount}
                setWithdrawAmount={setWithdrawAmount}
                isSaving={isSaving}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <EconomicIndicatorsCard 
                    withdrawFee={withdrawFee} setWithdrawFee={setWithdrawFee}
                    sponsorSettings={sponsorSettings} setSponsorSettings={setSponsorSettings}
                    autoApprove={autoApprove} setAutoApprove={setAutoApprove}
                    getUsdValue={getUsdValue}
                    isSaving={isSaving} setIsSaving={setIsSaving}
                />

                <MasterXProtocolParamsCard 
                    masterParams={masterParams} setMasterParams={setMasterParams}
                    isSaving={isSaving} setIsSaving={setIsSaving}
                />
            </div>

            <RevenueBatchManager 
                qLastDist={qLastDist as bigint | undefined}
                handleDistribute={handleDistribute}
                isSaving={isSaving}
            />

            <SystemPointersCard 
                pointers={pointers} setPointers={setPointers}
                tokens={allowedTokens}
                newTokenWhitelist={newTokenWhitelist} setNewTokenWhitelist={setNewTokenWhitelist}
                handleSyncTokenToDb={handleSyncTokenToDb}
                isSaving={isSaving} setIsSaving={setIsSaving}
            />
        </div>
    );
}
